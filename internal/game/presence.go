package game

import (
	"context"
	"encoding/json"
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
			"user_id", client.UserID,
		)
		return
	}

	ctx, cancel := context.WithTimeout(
		context.Background(),
		5*time.Second,
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

	if !state.IsActive() {
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

	presenceEvent, err := newGamePresenceEvent(
		websocket.EventGamePlayerDisconnected,
		match.ID,
		playerID,
		deadline,
	)
	if err != nil {
		slog.Error(
			"failed to create disconnect presence event",
			"match_id", match.ID,
			"player_id", playerID,
			"error", err,
		)

		return
	}

	for _, targetID := range []uuid.UUID{
		state.WhiteID,
		state.BlackID,
	} {
		if err := client.Hub.SendToUser(
			targetID.String(),
			presenceEvent,
		); err != nil {
			slog.Warn(
				"failed to send disconnect presence event",
				"match_id", match.ID,
				"target_id", targetID,
				"disconnected_player_id", playerID,
				"error", err,
			)
		}
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

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
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

	if !state.IsActive() {
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

	presenceEvent, err := newGamePresenceEvent(
	websocket.EventGamePlayerReconnected,
	match.ID,
	playerID,
	time.Time{},
)
if err != nil {
	slog.Error(
		"failed to create reconnect presence event",
		"match_id", match.ID,
		"player_id", playerID,
		"error", err,
	)

	return
}

for _, targetID := range []uuid.UUID{
	state.WhiteID,
	state.BlackID,
} {
	if err := client.Hub.SendToUser(
		targetID.String(),
		presenceEvent,
	); err != nil {
		slog.Warn(
			"failed to send reconnect presence event",
			"match_id", match.ID,
			"target_id", targetID,
			"reconnected_player_id", playerID,
			"error", err,
		)
	}
}

	slog.Info(
		"player reconnected to game",
		"match_id", match.ID,
		"user_id", playerID,
	)
}

// sync handler for presence

type PresenceSyncRequestPayload struct {
	MatchID uuid.UUID `json:"match_id"`
}

type PresenceSyncPayload struct {
	MatchID              string `json:"match_id"`
	DisconnectedPlayerID string `json:"disconnected_player_id,omitempty"`
	Deadline             string `json:"deadline,omitempty"`
}

func (s *Service) HandlePresenceSync(
	ctx context.Context,
	client *websocket.Client,
	event websocket.Event,
) error {
	if client == nil {
		return errors.New(
			"websocket client is nil",
		)
	}

	if client.Hub == nil {
		return errors.New(
			"websocket hub is nil",
		)
	}

	playerID, err := uuid.Parse(client.UserID)
	if err != nil {
		return errors.New(
			"invalid websocket user id",
		)
	}

	var payload PresenceSyncRequestPayload

	if err := json.Unmarshal(
		event.Payload,
		&payload,
	); err != nil {
		return err
	}

	if payload.MatchID == uuid.Nil {
		return errors.New(
			"match id is required",
		)
	}

	state, err := s.StateStore.Get(
		ctx,
		payload.MatchID,
	)

	if err != nil {
		return err
	}

	if playerID != state.WhiteID && playerID != state.BlackID {
		return ErrPlayerNotInMatch
	}

	var opponentID uuid.UUID

	switch playerID {
	case state.WhiteID:
		opponentID = state.BlackID

	case state.BlackID:
		opponentID = state.WhiteID

	default:
		return ErrPlayerNotInMatch
	}

	response := PresenceSyncPayload{
		MatchID: payload.MatchID.String(),
	}

	deadline, err := s.DisconnectStore.GetDeadline(
		ctx,
		payload.MatchID,
		opponentID,
	)

	switch {
	case err == nil:
		response.DisconnectedPlayerID = opponentID.String()
		response.Deadline = deadline.Format(time.RFC3339Nano)

	case errors.Is(err, ErrDisconnectNotFound):
		// No player is currently disconnected

	default:
		return err

	}

	syncEvent, err := websocket.NewEvent(
		websocket.EventGamePresenceSync,
		response,
	)

	if err != nil {
		return err
	}

	return client.Hub.SendToUser(
		playerID.String(),
		syncEvent,
	)

}

type GamePresenceEvent struct {
	MatchID  string `json:"match_id"`
	PlayerID string `json:"player_id"`
	Deadline string `json:"deadline"`
}

func newGamePresenceEvent(
	eventType websocket.EventType,
	matchID uuid.UUID,
	playerID uuid.UUID,
	deadline time.Time,
) (websocket.Event, error) {
	payload := GamePresenceEvent{
		MatchID:  matchID.String(),
		PlayerID: playerID.String(),
	}

	if !deadline.IsZero() {
		payload.Deadline = deadline.Format(
			time.RFC3339Nano,
		)
	}

	return websocket.NewEvent(eventType, payload)
}
