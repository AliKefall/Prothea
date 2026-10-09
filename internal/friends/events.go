package friends

import (
	"context"
	"log/slog"
	"time"

	"github.com/AliKefall/prothea/internal/websocket"
	"github.com/google/uuid"
)

type FriendEventPayload struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Online   bool   `json:"online,omitempty"`
	InGame   bool   `json:"in_game,omitempty"`
}

func (s *Service) HandleUserConnected(client *websocket.Client) {
	s.broadcastPresence(client, true)
}

func (s *Service) HandleUserDisconnected(client *websocket.Client) {
	s.broadcastPresence(client, false)
}

func (s *Service) broadcastPresence(client *websocket.Client, online bool) {
	if client == nil || s.hub == nil || s.hub.IsUserConnected(client.UserID) != online {
		return
	}

	userID, err := uuid.Parse(client.UserID)
	if err != nil {
		slog.Warn("ignoring friend presence with invalid user id", "user_id", client.UserID)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	friends, err := s.queries.ListFriendsByUserID(ctx, userID)
	if err != nil {
		slog.Warn("failed to load friends for presence update", "user_id", client.UserID, "error", err)
		return
	}

	eventType := websocket.EventFriendOffline
	if online {
		eventType = websocket.EventFriendOnline
	}
	event, err := websocket.NewEvent(eventType, FriendEventPayload{
		ID:       userID.String(),
		Username: client.Username,
		Online:   online,
	})
	if err != nil {
		slog.Warn("failed to create friend presence event", "user_id", client.UserID, "error", err)
		return
	}

	for _, friend := range friends {
		if !s.hub.IsUserConnected(friend.ID.String()) {
			continue
		}
		if err := s.hub.SendToUser(friend.ID.String(), event); err != nil {
			slog.Warn("failed to deliver friend presence update", "friend_id", friend.ID, "user_id", client.UserID, "error", err)
		}
	}
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
