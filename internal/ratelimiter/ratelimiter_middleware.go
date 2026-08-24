package ratelimiter

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/AliKefall/prothea/internal/utils"
)

type RateLimiter interface {
	Allow(ctx context.Context, key string, now time.Time) (bool, error)
}

const rateLimitTimeout = 200 * time.Millisecond

func MiddlewareRateLimiter(limiter RateLimiter) func(http.Handler) http.Handler{
	return func(h http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := utils.GetClientIP(r) + ":" + r.URL.Path

			ctx, cancel := context.WithTimeout(r.Context(), rateLimitTimeout)
			defer cancel()

			ok, err := limiter.Allow(ctx, key, time.Now())
			if err != nil {
				log.Printf("rate limiter backend error for key = %q: %v", key, err)
				h.ServeHTTP(w, r)
				return
			}
			if !ok {
				w.Header().Set("Retry-After", "1")
				http.Error(w, "Too many requests", http.StatusTooManyRequests)
				return
			}
			h.ServeHTTP(w, r)
		})
	}
}
