package game

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

// Grace period is equals to after x time amount this player
// is considered disconnected and allegedly lose their match.
const (
	// We are using ZSET so this one is that structures key
	gameDisconnectKey = "game:disconnects"

	DefaultDisconnectGracePeriod = 30 * time.Second
	DefaultDisconnectBatchSize   = 100
)

var ErrDisconnectNotFound = errors.New("disconnect entry not found")

type DisconnectEntry struct {
	MatchID  uuid.UUID
	PlayerID uuid.UUID
	Deadline time.Time
}

type DisconnectStore interface {
	Mark(
		ctx context.Context,
		matchID uuid.UUID,
		playerID uuid.UUID,
		deadline time.Time,
	) error

	Clear(
		ctx context.Context,
		matchID uuid.UUID,
		playerID uuid.UUID,
	) error

	IsDisconnected(
		ctx context.Context,
		matchID uuid.UUID,
		playerID uuid.UUID,
	) (bool, error)

	Expired(
		ctx context.Context,
		now time.Time,
		limit int,
	) ([]DisconnectEntry, error)

	GetDeadline(
		ctx context.Context,
		matchID uuid.UUID,
		playerID uuid.UUID,
	) (time.Time, error)
}

type RedisDisconnectStore struct {
	client redis.UniversalClient
}

func NewRedisDisconnectStore(
	client redis.UniversalClient,
) *RedisDisconnectStore {
	return &RedisDisconnectStore{
		client: client,
	}
}

func disconnectMember(
	matchID uuid.UUID,
	playerID uuid.UUID,
) string {
	return fmt.Sprintf(
		"%s:%s",
		matchID.String(),
		playerID.String(),
	)
}

func (s *RedisDisconnectStore) Mark(
	ctx context.Context,
	matchID uuid.UUID,
	playerID uuid.UUID,
	deadline time.Time,
) error {
	if s == nil || s.client == nil {
		return errors.New("redis client is nil")
	}

	if matchID == uuid.Nil {
		return errors.New("match id is nil")
	}

	if playerID == uuid.Nil {
		return errors.New("player id is nil")
	}

	if deadline.IsZero() {
		return errors.New("disconnect deadline is zero")
	}

	return s.client.ZAdd(
		ctx,
		gameDisconnectKey,
		redis.Z{
			Score: float64(deadline.UnixMilli()),
			Member: disconnectMember(
				matchID,
				playerID,
			),
		},
	).Err()
}

func (s *RedisDisconnectStore) Clear(
	ctx context.Context,
	matchID uuid.UUID,
	playerID uuid.UUID,
) error {
	if s == nil || s.client == nil {
		return errors.New("redis client is nil")
	}

	return s.client.ZRem(
		ctx,
		gameDisconnectKey,
		disconnectMember(
			matchID,
			playerID,
		),
	).Err()
}

func (s *RedisDisconnectStore) IsDisconnected(
	ctx context.Context,
	matchID uuid.UUID,
	playerID uuid.UUID,
) (bool, error) {
	_, err := s.GetDeadline(
		ctx,
		matchID,
		playerID,
	)

	if errors.Is(err, ErrDisconnectNotFound) {
		return false, nil
	}

	if err != nil {
		return false, err
	}

	return true, nil
}

func (s *RedisDisconnectStore) Expired(
	ctx context.Context,
	now time.Time,
	limit int,
) ([]DisconnectEntry, error) {
	if s == nil || s.client == nil {
		return nil, errors.New("redis client is nil")
	}

	if limit <= 0 {
		limit = DefaultDisconnectBatchSize
	}

	values, err := s.client.ZRangeByScore(
		ctx,
		gameDisconnectKey,
		&redis.ZRangeBy{
			Min:   "-inf",
			Max:   strconv.FormatInt(now.UnixMilli(), 10),
			Count: int64(limit),
		},
	).Result()

	if err != nil {
		return nil, err
	}

	result := make([]DisconnectEntry, 0, len(values))

	for _, value := range values {
		parts := strings.SplitN(value, ":", 2)

		if len(parts) != 2 {
			continue
		}

		matchID, err := uuid.Parse(parts[0])
		if err != nil {
			continue
		}

		playerID, err := uuid.Parse(parts[1])
		if err != nil {
			continue
		}

		score, err := s.client.ZScore(
			ctx,
			gameDisconnectKey,
			value,
		).Result()

		if err != nil {
			if errors.Is(err, redis.Nil) {
				continue
			}

			return nil, err
		}

		result = append(result, DisconnectEntry{
			MatchID:  matchID,
			PlayerID: playerID,
			Deadline: time.UnixMilli(int64(score)),
		})
	}

	return result, nil
}

func (s *RedisDisconnectStore) GetDeadline(
	ctx context.Context,
	matchID uuid.UUID,
	playerID uuid.UUID,
) (time.Time, error) {
	if s == nil || s.client == nil {
		return time.Time{}, errors.New(
			"redis client is nil",
		)
	}

	score, err := s.client.ZScore(
		ctx,
		gameDisconnectKey,
		disconnectMember(matchID, playerID),
	).Result()

	if errors.Is(err, redis.Nil) {
		return time.Time{},	ErrDisconnectNotFound
	}

	if err != nil {
		return time.Time{}, err
	}

	return time.UnixMilli(int64(score)).UTC(), nil
}


