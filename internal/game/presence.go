package game

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/AliKefall/prothea/internal/websocket"
	"github.com/google/uuid"
)

func (s *Service) HandleUserDisconnected(
	client *websocket.Client,
) {
	if client == nil {
		return
	}

	playerID, err := uuid.Parse(client.UserID)
	if err != nil {
		slog.Warn(
			"ignoring disconnect with invalid player id",
			"user_id" , client.UserID,
		)
		return
	}

	ctx, cancel:= context.WithTimeout(
		context.Background(),
		5 * time.Second,
	)
	defer cancel()

	match, err := s.GetActiveMatchForPlayer(
		ctx,
		playerID,
	)

	if err != nil {
		if errors.Is(err, ErrMatchNotFound) {
			return
		}

		slog.Error(
			"failed to find active match after disconnect",
			"user_id", client.UserID,
			"error", err,
		)

		return
	}

	release, err := s.GameLock.Acquire(
		ctx,
		match.ID,
	)

	if err != nil {
		slog.Error(
			"failed to lock match for disconnect",
			"match_id", match.ID,
			"user_id", client.UserID,
			"error", err,
		)
		return
	}

	defer release()

	state, err := s.StateStore.Get(
		ctx,
		match.ID,
	)

	if err != nil {
		slog.Error(
			"failed to load game state after disconnect",
			"match_id", match.ID,
			"user_id", client.UserID,
			"error", err,
		)
		return
	}

	if !state.IsActive(){
		return
	}

	deadline := time.Now().UTC().Add(
		DefaultDisconnectGracePeriod,
	)

	if err := s.DisconnectStore.Mark(
		ctx,
		match.ID,
		playerID,
		deadline,
	); err != nil {
		slog.Error(
			"failed to mark player disconnected",
			"match_id", match.ID,
			"user_id", client.UserID,
			"error", err,
		)
		return
	}

	slog.Info(
		"player disconnected from game",
		"match_id", match.ID,
		"user_id", playerID,
		"disconnect_deadline", deadline,
	)

}


func (s *Service) HandleUserConnected(
	client *websocket.Client,
) {
	if client == nil {
		return
	}

	playerID, err := uuid.Parse(client.UserID)
	if err != nil {
		slog.Warn(
			"ignoring connect with invalid player id",
			 "user_id", client.UserID,
		)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5 * time.Second)
	defer cancel()

	match, err := s.GetActiveMatchForPlayer(
		ctx,
		playerID,
	)
	if err != nil {
		if errors.Is(err, ErrMatchNotFound) {
			return
		}

		slog.Error(
			"failed to find active match after reconnect",
			"user_id", client.UserID,
			"error", err,
		)
		return
	}

	release, err := s.GameLock.Acquire(
		ctx,
		match.ID,
	)
	if err != nil {
		slog.Error(
			"failed to lock match for reconnect",
			"match_id", match.ID,
			"user_id", client.UserID,
			"error", err,
		)
		return
	}
	defer release()

	state, err := s.StateStore.Get(
		ctx,
		match.ID,
	)
	if err != nil {
		slog.Error(
			"failed to load game state after reconnect",
			"match_id", match.ID,
			"user_id", client.UserID,
			"error", err,
		)
		return
	}

	if !state.IsActive(){
		return
	}
	if err := s.DisconnectStore.Clear(
		ctx,
		match.ID,
		playerID,
	); err != nil {
		slog.Error(
			"failed to clear player disconnect state",
			"match_id", match.ID,
			"user_id", client.UserID,
			"error", err,
		)
		return
	}

	slog.Info(
		"player reconnected to game",
		"match_id", match.ID,
		"user_id", playerID,
	)
}

