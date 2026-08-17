package endpoints

import (
	"bufio"
	"context"
	"database/sql"
	"errors"
	"net"
	"net/http"
	"time"

	"github.com/AliKefall/prothea/internal/auth"
	"github.com/AliKefall/prothea/internal/database"
	"github.com/AliKefall/prothea/internal/utils"
	"github.com/google/uuid"
)

type contextKey string

const (
	UserIDKey    contextKey = "user_id"
	SessionIDKey contextKey = "session_id"
)

func (deps *Deps) AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token, err := auth.GetBearer(r)
		if err != nil {
			// Fallback for websocket clients
			token = r.URL.Query().Get("token")

			if token == "" {
				utils.RespondWithError(w, http.StatusUnauthorized, "token_error", "missing token", "", nil)
				return
			}

		}
		ctx := r.Context()

		claims, err := deps.JWT.Verify(token)
		if err != nil {
			utils.RespondWithError(w, http.StatusUnauthorized, "token_error", "invalid token", "", nil)
			return
		}

		blackKey := "bl:" + token
		exists, err := deps.RedisClient.Exists(ctx, blackKey).Result()
		if err == nil && exists == 1 {
			utils.RespondWithError(w, http.StatusUnauthorized, "token_error", "token revoked", "", nil)
			return
		}

		sessionUUID, err := uuid.Parse(claims.SessionID)
		if err != nil {
			utils.RespondWithError(w, http.StatusUnauthorized, "session_error", "invalid session id", "", nil)
			return
		}

		session, err := deps.Queries.GetSessionByID(ctx, sessionUUID)
		if err != nil {
			utils.RespondWithError(w, http.StatusUnauthorized, "session_error", "session not found", "", err)
			return
		}

		now := time.Now().UTC()

		if session.RevokedAt.Valid {
			utils.RespondWithError(w, http.StatusUnauthorized, "session_error", "session revoked", "", nil)
			return
		}

		if now.After(session.ExpiresAt) {
			utils.RespondWithError(w, http.StatusUnauthorized, "session_error", "session expired", "", nil)
			return
		}

		if now.After(session.MaxExpiresAt) {
			utils.RespondWithError(w, http.StatusUnauthorized, "session_error", "session lifetime exceeded", "", nil)
			return
		}

		go func(sessionID uuid.UUID) {
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer cancel()

			_ = deps.Queries.UpdateSessionLastUsed(ctx, database.UpdateSessionLastUsedParams{
				ID: sessionID,
				LastUsedAt: sql.NullTime{
					Valid: true,
					Time:  now,
				},
			})

		}(session.ID)

		ctx = context.WithValue(ctx, UserIDKey, session.UserID)
		ctx = context.WithValue(ctx, SessionIDKey, session.ID)

		rw := &responseWriter{
			ResponseWriter: w,
			status:         http.StatusOK,
		}
		next.ServeHTTP(rw, r.WithContext(ctx))

	})
}

type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

// Websocket will use this middleware that is the very reason
// why we need to write our own hijacker and response writer.
func (rw *responseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {

	hijacker, ok := rw.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, errors.New(
			"underlying ResponseWriter does not support hijacking",
		)
	}

	return hijacker.Hijack()
}

func (rw *responseWriter) Write(b []byte) (int, error) {

	if rw.status == 0 {
		rw.status = http.StatusOK
	}

	return rw.ResponseWriter.Write(b)
}

// streaming support
func (rw *responseWriter) Flush() {

	flusher, ok := rw.ResponseWriter.(http.Flusher)
	if !ok {
		return
	}

	flusher.Flush()
}

// HTTP/2 server push support
func (rw *responseWriter) Push(
	target string,
	opts *http.PushOptions,
) error {

	pusher, ok := rw.ResponseWriter.(http.Pusher)
	if !ok {
		return http.ErrNotSupported
	}

	return pusher.Push(target, opts)
}
