package friends

import (
	"log/slog"

	"github.com/AliKefall/prothea/internal/websocket"
	"github.com/google/uuid"
)

type FriendEventPayload struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Online   bool   `json:"online,omitempty"`
	InGame   bool   `json:"in_game,omitempty"`
}

func (s *Service) notifyUser(userID uuid.UUID, eventType websocket.EventType, payload FriendEventPayload) {
	if s.hub == nil {
		return
	}

	event, err := websocket.NewEvent(eventType, payload)
	if err != nil {
		slog.Warn("failed to build friend websocket event", slog.Any("error", err))
		return
	}

	if err := s.hub.SendToUser(userID.String(), event); err != nil {
		slog.Warn("failed to deliver friend websocket event", slog.String("user_id", userID.String()), slog.Any("error", err))
	}
}
