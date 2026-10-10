package endpoints

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/AliKefall/prothea/internal/auth"
	"github.com/AliKefall/prothea/internal/database"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

type loginDBConfig struct {
	userID, email, username, passwordHash string
	createSessionErr                      error
}

var (
	loginDriversMu sync.RWMutex
	loginDrivers   = map[string]loginDBConfig{}
	loginDriverSeq atomic.Uint64
)

type loginDriver struct{ name string }
type loginConn struct{ config loginDBConfig }
type loginRows struct {
	columns []string
	values  []driver.Value
	used    bool
}

func (d loginDriver) Open(name string) (driver.Conn, error) {
	loginDriversMu.RLock()
	config, ok := loginDrivers[name]
	loginDriversMu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("unknown test database %q", name)
	}
	return loginConn{config: config}, nil
}
func (loginConn) Prepare(string) (driver.Stmt, error) {
	return nil, errors.New("Prepare not supported")
}
func (loginConn) Close() error              { return nil }
func (loginConn) Begin() (driver.Tx, error) { return nil, errors.New("transactions not supported") }
func (c loginConn) QueryContext(_ context.Context, query string, _ []driver.NamedValue) (driver.Rows, error) {
	switch {
	case strings.Contains(query, "FROM users"):
		if c.config.userID == "" {
			return &loginRows{columns: []string{"id", "email", "username", "password", "created_at", "updated_at"}}, nil
		}
		return &loginRows{
			columns: []string{"id", "email", "username", "password", "created_at", "updated_at"},
			values:  []driver.Value{c.config.userID, c.config.email, c.config.username, c.config.passwordHash, time.Now(), time.Now()},
		}, nil
	case strings.Contains(query, "INSERT INTO sessions"):
		if c.config.createSessionErr != nil {
			return nil, c.config.createSessionErr
		}
		return &loginRows{
			columns: []string{"id", "user_id", "refresh_token_hash", "user_agent", "ip_address", "created_at", "expires_at", "max_expires_at", "last_used_at", "revoked_at"},
			values:  []driver.Value{uuid.NewString(), c.config.userID, "refresh-hash", "test-agent", "127.0.0.1", time.Now(), time.Now().Add(time.Hour), time.Now().Add(24 * time.Hour), time.Now(), nil},
		}, nil
	default:
		return nil, fmt.Errorf("unexpected query: %s", query)
	}
}
func (r *loginRows) Columns() []string { return r.columns }
func (r *loginRows) Close() error      { return nil }
func (r *loginRows) Next(dest []driver.Value) error {
	if r.used {
		return io.EOF
	}
	r.used = true
	if len(r.values) == 0 {
		return io.EOF
	}
	copy(dest, r.values)
	return nil
}

type loginRedisStore struct {
	key, value string
	expiration time.Duration
	err        error
}

func (s *loginRedisStore) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) *redis.StatusCmd {
	s.key, s.value, s.expiration = key, fmt.Sprint(value), expiration
	cmd := redis.NewStatusCmd(ctx)
	if s.err != nil {
		cmd.SetErr(s.err)
	} else {
		cmd.SetVal("OK")
	}
	return cmd
}

func newLoginTestDeps(t *testing.T, config loginDBConfig, store *loginRedisStore) *Deps {
	t.Helper()
	name := fmt.Sprintf("login-test-%d", loginDriverSeq.Add(1))
	loginDriversMu.Lock()
	loginDrivers[name] = config
	loginDriversMu.Unlock()
	sql.Register(name, loginDriver{name: name})
	t.Cleanup(func() {
		loginDriversMu.Lock()
		delete(loginDrivers, name)
		loginDriversMu.Unlock()
	})
	db, err := sql.Open(name, name)
	if err != nil {
		t.Fatalf("sql.Open() error = %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return &Deps{
		DB:                db,
		Queries:           database.New(db),
		LoginSessionStore: store,
		Hasher:            auth.NewPasswordHasher(),
		JWT:               auth.NewJWTManager("login-test-secret", time.Minute),
	}
}

func TestLoginHandlerSuccessfulLogin(t *testing.T) {
	userID := uuid.New()
	hash, err := auth.NewPasswordHasher().Hash("Correct!Horse9")
	if err != nil {
		t.Fatalf("Hash() error = %v", err)
	}
	store := &loginRedisStore{}
	deps := newLoginTestDeps(t, loginDBConfig{userID: userID.String(), email: "player@example.com", username: "player", passwordHash: hash}, store)
	r := httptest.NewRequest(http.MethodPost, "/auth/login", strings.NewReader(`{"email":" PLAYER@Example.com ","password":"Correct!Horse9"}`))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	deps.LoginHandler(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	var response struct {
		AccessToken string `json:"access_token"`
		User        struct {
			UserID   string `json:"user_id"`
			Email    string `json:"email"`
			Username string `json:"username"`
		} `json:"user"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	claims, err := deps.JWT.Verify(response.AccessToken)
	if err != nil || claims.UserID != userID.String() {
		t.Fatalf("invalid access token claims: %+v, %v", claims, err)
	}
	if response.User.UserID != userID.String() || response.User.Email != "player@example.com" || response.User.Username != "player" {
		t.Fatalf("unexpected user response: %+v", response.User)
	}
	cookie := w.Result().Cookies()
	if len(cookie) != 1 || cookie[0].Name != "refresh_token" || !cookie[0].HttpOnly {
		t.Fatalf("refresh cookie missing or insecure: %+v", cookie)
	}
	if store.key == "" || !strings.HasPrefix(store.key, "sess:") || store.value != userID.String() || store.expiration <= 0 {
		t.Fatalf("session cache not populated: %+v", store)
	}
}

func TestLoginHandlerRejectsMissingCredentials(t *testing.T) {
	deps := &Deps{}
	r := httptest.NewRequest(http.MethodPost, "/auth/login", strings.NewReader(`{"email":"  ","password":""}`))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	deps.LoginHandler(w, r)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestLoginHandlerRejectsMalformedJSON(t *testing.T) {
	deps := &Deps{}
	r := httptest.NewRequest(http.MethodPost, "/auth/login", strings.NewReader(`{"email":`))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	deps.LoginHandler(w, r)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestLoginHandlerRejectsUnknownEmail(t *testing.T) {
	deps := newLoginTestDeps(t, loginDBConfig{}, &loginRedisStore{})
	r := httptest.NewRequest(http.MethodPost, "/auth/login", strings.NewReader(`{"email":"unknown@example.com","password":"Strong!123"}`))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	deps.LoginHandler(w, r)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
}

func TestLoginHandlerRejectsInvalidCredentials(t *testing.T) {
	userID := uuid.New()
	hash, err := auth.NewPasswordHasher().Hash("Correct!Horse9")
	if err != nil {
		t.Fatalf("Hash() error = %v", err)
	}
	store := &loginRedisStore{}
	deps := newLoginTestDeps(t, loginDBConfig{userID: userID.String(), email: "player@example.com", username: "player", passwordHash: hash}, store)
	r := httptest.NewRequest(http.MethodPost, "/auth/login", strings.NewReader(`{"email":"player@example.com","password":"wrong"}`))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	deps.LoginHandler(w, r)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	if store.key != "" {
		t.Fatal("invalid credentials must not create a session")
	}
}

func TestLoginHandlerDoesNotCreateSessionWhenDatabaseFails(t *testing.T) {
	userID := uuid.New()
	hash, err := auth.NewPasswordHasher().Hash("Correct!Horse9")
	if err != nil {
		t.Fatalf("Hash() error = %v", err)
	}
	store := &loginRedisStore{}
	deps := newLoginTestDeps(t, loginDBConfig{userID: userID.String(), email: "player@example.com", username: "player", passwordHash: hash, createSessionErr: errors.New("database unavailable")}, store)
	r := httptest.NewRequest(http.MethodPost, "/auth/login", strings.NewReader(`{"email":"player@example.com","password":"Correct!Horse9"}`))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	deps.LoginHandler(w, r)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	if store.key != "" {
		t.Fatal("failed database session creation must not write Redis session")
	}
}

func TestLoginHandlerReportsSessionCacheFailure(t *testing.T) {
	userID := uuid.New()
	hash, err := auth.NewPasswordHasher().Hash("Correct!Horse9")
	if err != nil {
		t.Fatalf("Hash() error = %v", err)
	}
	store := &loginRedisStore{err: errors.New("redis unavailable")}
	deps := newLoginTestDeps(t, loginDBConfig{userID: userID.String(), email: "player@example.com", username: "player", passwordHash: hash}, store)
	r := httptest.NewRequest(http.MethodPost, "/auth/login", strings.NewReader(`{"email":"player@example.com","password":"Correct!Horse9"}`))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	deps.LoginHandler(w, r)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
}
