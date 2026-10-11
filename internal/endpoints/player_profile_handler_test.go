package endpoints

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/AliKefall/prothea/internal/database"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func TestSearchPlayersRequiresAuthenticatedUser(t *testing.T) {
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/players/search?q=ab", nil)
	(&Deps{}).SearchPlayersHandler(w, r)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusUnauthorized)
	}
}

func TestSearchPlayersSkipsShortQueries(t *testing.T) {
	deps := &Deps{}
	r := httptest.NewRequest(http.MethodGet, "/players/search?q=a", nil)
	r = r.WithContext(context.WithValue(r.Context(), UserIDKey, uuid.New()))
	w := httptest.NewRecorder()
	deps.SearchPlayersHandler(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	var response PlayerSearchResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response.Players == nil || len(response.Players) != 0 {
		t.Fatalf("short query returned unexpected results: %+v", response.Players)
	}
}

func TestSearchPlayersReturnsMatchingProfiles(t *testing.T) {
	playerID := uuid.New()
	deps := newLoginTestDeps(t, loginDBConfig{
		searchResults: []database.SearchPlayersRow{{ID: playerID, Username: "Alice"}},
	}, &loginRedisStore{})
	r := httptest.NewRequest(http.MethodGet, "/players/search?q=ali", nil)
	r = r.WithContext(context.WithValue(r.Context(), UserIDKey, uuid.New()))
	w := httptest.NewRecorder()
	deps.SearchPlayersHandler(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	var response PlayerSearchResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(response.Players) != 1 || response.Players[0].UserID != playerID || response.Players[0].Username != "Alice" {
		t.Fatalf("unexpected search response: %+v", response.Players)
	}
}

func TestPlayerProfileHandlerReturnsNotFound(t *testing.T) {
	deps := newLoginTestDeps(t, loginDBConfig{}, &loginRedisStore{})
	r := httptest.NewRequest(http.MethodGet, "/players/missing", nil)
	routeContext := chi.NewRouteContext()
	routeContext.URLParams.Add("username", "missing")
	r = r.WithContext(context.WithValue(r.Context(), chi.RouteCtxKey, routeContext))
	w := httptest.NewRecorder()
	deps.PlayerProfileHandler(w, r)
	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
}

func TestPlayerProfileHandlerReturnsRatingsAndMatchHistory(t *testing.T) {
	playerID := uuid.New()
	deps := newLoginTestDeps(t, loginDBConfig{userID: playerID.String(), username: "Alice", email: "alice@example.com"}, &loginRedisStore{})
	r := httptest.NewRequest(http.MethodGet, "/players/Alice", nil)
	routeContext := chi.NewRouteContext()
	routeContext.URLParams.Add("username", "Alice")
	r = r.WithContext(context.WithValue(r.Context(), chi.RouteCtxKey, routeContext))
	w := httptest.NewRecorder()
	deps.PlayerProfileHandler(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	var response CurrentUserProfileResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response.UserID != playerID || response.Username != "Alice" || response.RecentMatches == nil {
		t.Fatalf("unexpected profile response: %+v", response)
	}
}
