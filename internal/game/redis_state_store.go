package game

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

//NOTE: There is a huge problem in here which you will see in prod
// This whole system is an open source for race condition, depending
// on the scale of this project add any of the these three ways.
// 1- redis transaction/lua, optimistic locking or something similar


const gameStateKeyPrefix = "game:state:"

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

	return s.client.Set(
		ctx,
		gameStateKey(state.MatchID),
		data,
		0,
	).Err()
}

func (s *RedisStateStore) Delete(
	ctx context.Context,
	matchID uuid.UUID,
) error {
	if s == nil || s.client == nil {
		return errors.New("redis client is nil")
	}

	return s.client.Del(
		ctx,
		gameStateKey(matchID),
	).Err()
}
