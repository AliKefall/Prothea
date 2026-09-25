package game

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

//NOTE: There is a huge problem in here which you will see in prod
// This whole system is an open source for race condition, depending
// on the scale of this project add any of the these three ways.
// 1- redis transaction/lua, optimistic locking or something similar

const (
	gameStateKeyPrefix = "game:state:"
	gameTimeoutKey     = "game:timeouts"
)

type RedisStateStore struct {
	client redis.UniversalClient
}

func NewRedisStateStore(
	client redis.UniversalClient,
) *RedisStateStore {
	return &RedisStateStore{
		client: client,
	}
}

func gameStateKey(matchID uuid.UUID) string {
	return fmt.Sprintf(
		"%s%s",
		gameStateKeyPrefix,
		matchID.String(),
	)
}

func (s *RedisStateStore) Get(
	ctx context.Context,
	matchID uuid.UUID,
) (*State, error) {
	if s == nil || s.client == nil {
		return nil, errors.New("redis client is full")
	}

	data, err := s.client.Get(
		ctx,
		gameStateKey(matchID),
	).Bytes()

	if err != nil {
		if errors.Is(err, redis.Nil) {
			return nil, ErrGameStateNotFound
		}
		return nil, err
	}

	var state State

	if err := json.Unmarshal(data, &state); err != nil {
		return nil, fmt.Errorf(
			"decode game state: %w",
			err,
		)
	}

	return &state, nil
}

func (s *RedisStateStore) Delete(
	ctx context.Context,
	matchID uuid.UUID,
) error {
	if s == nil || s.client == nil {
		return errors.New("redis client is nil")
	}

	pipe := s.client.TxPipeline()

	pipe.Del(
		ctx,
		gameStateKey(matchID),
	)

	pipe.ZRem(
		ctx,
		gameTimeoutKey,
		matchID.String(),
	)

	_, err := pipe.Exec(ctx)

	return err
}

func (s *RedisStateStore) Set(
	ctx context.Context,
	state *State,
) error {
	if s == nil || s.client == nil {
		return errors.New("redis client is nil")
	}

	if state == nil {
		return errors.New("game state is nil")
	}

	data, err := json.Marshal(state)
	if err != nil {
		return fmt.Errorf(
			"encode game state: %w",
			err,
		)
	}

	pipe := s.client.TxPipeline()

	pipe.Set(
		ctx,
		gameStateKey(state.MatchID),
		data,
		0,
	)

	if state.Status == StateActive {
		var remainingMs int64

		switch state.Turn {
		case ColorWhite:
			remainingMs = state.WhiteTimeMs

		case ColorBlack:
			remainingMs = state.BlackTimeMs

		default:
			return errors.New("invalid game turn")
		}

		if remainingMs < 0 {
			remainingMs = 0
		}

		deadlineMs := state.LastMoveAt.UnixMilli() + remainingMs

		pipe.ZAdd(
			ctx,
			gameTimeoutKey,
			redis.Z{
				Score:  float64(deadlineMs),
				Member: state.MatchID.String(),
			},
		)
	} else {
		pipe.ZRem(
			ctx,
			gameTimeoutKey,
			state.MatchID.String(),
		)
	}

	_, err = pipe.Exec(ctx)
	return err
}

func (s *RedisStateStore) ExpiredMatchIDs(
	ctx context.Context,
	now time.Time,
	limit int,
) ([]uuid.UUID, error) {
	if s == nil || s.client == nil {
		return nil, errors.New("redis client is nil")
	}

	if limit <= 0 {
		limit = 100
	}

	values, err := s.client.ZRangeByScore(
		ctx,
		gameTimeoutKey,
		&redis.ZRangeBy{
			Min:   "-inf", //Same thing as float("-Inf") in python.
			Max:   strconv.FormatInt(now.UnixMilli(), 10),
			Count: int64(limit),
		},
	).Result()
	if err != nil {
		return nil, err
	}

	ids := make([]uuid.UUID, 0, len(values))

	for _, value := range values {
		matchID, err := uuid.Parse(value)
		if err != nil {
			continue
		}

		ids = append(ids, matchID)
	}

	return ids, nil
}
