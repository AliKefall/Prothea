package endpoints

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/AliKefall/prothea/internal/auth"
)

func TestAuthMiddlewareRejectsMissingAndInvalidTokens(t *testing.T) {
	manager, err := auth.NewJWTManager("01234567890123456789012345678901", time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	deps := &Deps{JWT: manager}
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
