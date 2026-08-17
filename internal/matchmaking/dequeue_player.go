package matchmaking

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

func (s *Service) DequeuePlayer(ctx context.Context, userID uuid.UUID, timeControl string) error {
	if s == nil || s.Redis == nil {
		return errors.New("Matchmaking redis client is nil ")
	}
	if userID == uuid.Nil {
		return errors.New("user_id is required")
	}

	script, err := luaScripts.ReadFile("lua/dequeue.lua")
	if err != nil {
		return err
	}

	removed, err := s.Redis.Eval(ctx, string(script), []string{
		"matchmaking:queue:" + timeControl,
		"matchmaking:user:" + userID.String(),
	}).Int()

	if err != nil {
		return err
	}
	if removed == 0{
		return ErrNotQueued
	}
	return nil
}
