package ratelimiter

import (
	"context"
	"log"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/AliKefall/prothea/internal/utils"
)

type RateLimiter interface {
	Allow(ctx context.Context, key string, now time.Time) (bool, error)
}

const rateLimitTimeout = 200 * time.Millisecond

func MiddlewareRateLimiter(limiter RateLimiter) func(http.Handler) http.Handler {
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

// MiddlewareAuthRateLimiter keys authentication attempts by the network peer,
// rather than client-supplied forwarding headers that can be spoofed.
func MiddlewareAuthRateLimiter(limiter RateLimiter) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := r.RemoteAddr
			if host, _, err := net.SplitHostPort(ip); err == nil {
				ip = host
			}
			key := strings.Join([]string{"auth", ip, r.URL.Path}, ":")
			ctx, cancel := context.WithTimeout(r.Context(), rateLimitTimeout)
			defer cancel()
			ok, err := limiter.Allow(ctx, key, time.Now())
			if err != nil {
				log.Printf("authentication rate limiter backend error for peer = %q: %v", ip, err)
				http.Error(w, "Authentication service temporarily unavailable", http.StatusServiceUnavailable)
				return
			}
			if !ok {
				w.Header().Set("Retry-After", "10")
				http.Error(w, "Too many authentication attempts", http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
