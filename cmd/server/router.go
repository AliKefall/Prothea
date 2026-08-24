package main

import (
	"log"
	"net/http"
	"net/url"

	"github.com/AliKefall/prothea/internal/endpoints"
	"github.com/AliKefall/prothea/internal/ratelimiter"
	"github.com/AliKefall/prothea/internal/utils"
	"github.com/AliKefall/prothea/internal/websocket"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/google/uuid"
)

func newRouter(config *ServerConfig, deps *endpoints.Deps) http.Handler {
	router := chi.NewRouter()
	router.Use(cors.Handler(cors.Options{
		AllowedOrigins: config.AllowedOrigins,
		AllowOriginFunc: func(r *http.Request, origin string) bool {
			u, err := url.Parse(origin)
			if err != nil {
				return false
			}
			if (u.Hostname() == "localhost" || u.Hostname() == "127.0.0.1") && (u.Scheme == "http" || u.Scheme == "https") {
				return true
			}
			for _, allowed := range config.AllowedOrigins {
				if allowed == origin {
					return true
				}
			}
			return false
		},
		AllowedMethods:   []string{"GET", "OPTIONS", "POST", "DELETE", "PUT", "PATCH"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		ExposedHeaders:   []string{"X-Request-Id"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	log.Printf("Allowed origins: %#v", config.AllowedOrigins)
	router.Use(middleware.Logger)
	router.Use(middleware.Recoverer)
	router.Use(securityHeaderMiddleware)
	rateLimiter, err := ratelimiter.NewRedisTokenBucketLimiter(deps.RedisClient, 20, 10)
	if err != nil {
		log.Fatalf("Ratelimiter init failed: %v", err)
	}
	router.Use(ratelimiter.MiddlewareRateLimiter(rateLimiter))

	router.With(deps.AuthMiddleware).Get("/ws", func(w http.ResponseWriter, r *http.Request) {
		uid, ok := r.Context().Value(endpoints.UserIDKey).(uuid.UUID)
		if !ok || uid == uuid.Nil {
			utils.RespondWithError(w, http.StatusUnauthorized, "websocket_error", "Invalid user context", "", nil)
			return
		}

		user, err := deps.Queries.GetUserByID(r.Context(), uid)
		if err != nil {
			utils.RespondWithError(w, http.StatusUnauthorized, "database_error", "User not found", "", err)
			return
		}
		websocket.ServeWS(deps.Hub, w, r, uid.String(), user.Username, nil)
	})

	router.Group(func(pr chi.Router) {
		pr.Use(deps.AuthMiddleware)
		pr.Get("/friends", deps.HandleListFriends)
		pr.Get("/friends/requests", deps.HandleListFriendRequests)
		pr.Post("/friends/requests", deps.HandleSendFriendRequest)
		pr.Post("/friends/requests/accept", deps.HandleAcceptFriendRequest)
		pr.Post("/friends/requests/reject", deps.HandleRejectFriendRequest)

	})
	router.Route("/auth", func(ar chi.Router) {
		ar.Post("/register", deps.RegisterHandler)
		ar.Post("/login", deps.LoginHandler)
		ar.Post("/refresh", deps.RefreshHandler)
		ar.Post("/logout", deps.LogoutHandler)
	})

	return router
}

func securityHeaderMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		headers := w.Header()
		headers.Set("X-Content-Type-Options", "nosniff")
		headers.Set("X-Frame-Options", "DENY")
		headers.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		headers.Set("Cross-Origin-Resource-Policy", "same-site")
		headers.Set("Cross-Origin-Opener-Policy", "same-origin")
		headers.Set("Cross-Origin-Embedder-Policy", "credentialless")
		if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
			headers.Set("Strict-Transport-Security", "max-age=31536000; includeSubdomains")
		}
		next.ServeHTTP(w, r)
	})
}
