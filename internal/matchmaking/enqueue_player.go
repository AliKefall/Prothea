package matchmaking

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

func (s *Service) EnqueuePlayer(ctx context.Context, entry QueueEntry) error {
	if s == nil || s.Redis == nil {
		return errors.New("Matchmaking redis client is nil ")
	}

	if entry.UserID == uuid.Nil {
		return errors.New("user_id is required")
	}

	if entry.JoinedAt.IsZero() {
		entry.JoinedAt = time.Now().UTC()
	}

	if entry.TimeControl == "" {
		return errors.New("time control is missing")
	}

	script, err := luaScripts.ReadFile("lua/enqueue.lua")
	if err != nil {
		return err
	}

	result, err := s.Redis.Eval(ctx, string(script), []string{
		"matchmaking:queue:" + entry.TimeControl,
		"matchmaking:user:" + entry.UserID.String(),
	}, entry.UserID.String(), entry.Username, entry.Rating, entry.JoinedAt, entry.TimeControl, int(s.QueueTTL.Seconds())).Result()

	if err != nil {
		if err.Error() == "already_queued" || err.Error() == "ERR already_queued" {
			return ErrAlreadyQueued
		}
		return err
	}
	if fmt.Sprint(result) != "ok" {
		return fmt.Errorf("unexpected enqueue result: %v", result)
	}
	return nil
}
