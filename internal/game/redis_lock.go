package game

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

const (
	gameLockPrefix = "game:lock:"
	gameLockTTL    = 5 * time.Second
)

var ErrGameLocked = errors.New("game is currently locked")

type RedisGameLock struct {
	client redis.UniversalClient
}

func NewRedisGameLock(
	client redis.UniversalClient,
) *RedisGameLock {
	return &RedisGameLock{
		client: client,
	}
}

func gameLockKey(matchID uuid.UUID) string {
	return fmt.Sprintf(
		"%s%s",
		gameLockPrefix,
		matchID.String(),
	)
}

func (l *RedisGameLock) Acquire(
	ctx context.Context,
	matchID uuid.UUID,
) (func(), error) {
	if l == nil || l.client == nil {
		return nil, errors.New("redis client is nil")
	}

	token := strconv.FormatInt(
		time.Now().UnixNano(),
		10,
	)

	acquired, err := l.client.SetNX(
		ctx,
		gameLockKey(matchID),
		token,
		gameLockTTL,
	).Result()

	if err != nil {
		return nil, err
	}

	if !acquired {
		return nil, ErrGameLocked
	}

	release := func() {
		// Only delete our own lock.
		const script = `
			if redis.call("GET", KEYS[1]) == ARGV[1] then
				return redis.call("DEL", KEYS[1])
			end

			return 0
		`

		_ = l.client.Eval(
			context.Background(),
			script,
			[]string{gameLockKey(matchID)},
			token,
		).Err()
	}

	return release, nil
}
