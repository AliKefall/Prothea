package ratelimiter

import (
	"context"
	_ "embed"
	"fmt"
	"github.com/redis/go-redis/v9"
	"time"
)

//go:embed lua/token_bucket.lua
var tokenBucketLua string

type RedisTokenBucketLimiter struct {
	client     redis.UniversalClient
	capacity   float64
	refillRate float64
	ttl        time.Duration
	luaScript  *redis.Script
}

func NewRedisTokenBucketLimiter(client redis.UniversalClient, capacity int, refillPerSec float64) (*RedisTokenBucketLimiter, error) {
	if capacity <= 0 {
		return nil, fmt.Errorf("ratelimiter: capacity must be positive, got %d", capacity)
	}
	if refillPerSec <= 0 {
		return nil, fmt.Errorf("ratelimiter: refillPerSec mut be positive, got %f", refillPerSec)
	}

	ttl := time.Duration(float64(capacity)/refillPerSec*2) * time.Second
	if ttl < time.Minute {
		ttl = time.Minute
	}

	return &RedisTokenBucketLimiter{
		client:     client,
		capacity:   float64(capacity),
		refillRate: refillPerSec,
		ttl:        ttl,
		luaScript:  redis.NewScript(tokenBucketLua),
	}, nil
}

func (l *RedisTokenBucketLimiter) Allow(ctx context.Context, key string, now time.Time) (bool, error) {
	redisKey := "rate_token:" + key

	result, err := l.luaScript.Run(
		ctx,
		l.client,
		[]string{redisKey},
		l.capacity,
		l.refillRate,
		now.UnixMilli(),
		int64(l.ttl.Seconds()),
	).Int()
	if err != nil {
		return false, fmt.Errorf("ratelimiter: script failed for key %q: %w", key, err)

	}
	return result == 1, nil
}
