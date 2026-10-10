package endpoints

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/AliKefall/prothea/internal/auth"
)

func TestAuthMiddlewareRejectsMissingAndInvalidTokens(t *testing.T) {
	deps := &Deps{JWT: auth.NewJWTManager("test-secret", time.Minute)}
	nextCalled := false
	handler := deps.AuthMiddleware(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { nextCalled = true }))
	for _, token := range []string{"", "not-a-jwt"} {
		r := httptest.NewRequest(http.MethodGet, "/private", nil)
		if token != "" {
			r.Header.Set("Authorization", "Bearer "+token)
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		if w.Code != http.StatusUnauthorized {
			t.Errorf("token %q status = %d", token, w.Code)
		}
	}
	if nextCalled {
		t.Fatal("protected handler ran for rejected credentials")
	}
}
