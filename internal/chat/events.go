package chat

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log/slog"
	"time"

	"github.com/AliKefall/prothea/internal/websocket"
	"github.com/google/uuid"
)

type SendMessagePayload struct {
	RecipientID string `json:"recipient_id"`
	Content     string `json:"content"`
}

type MessagePayload struct {
	ID             string `json:"id"`
	ConversationID string `json:"conversation_id"`
	SenderID       string `json:"sender_id"`
	RecipientID    string `json:"recipient_id,omitempty"`
	Content        string `json:"content"`
	CreatedAt      string `json:"created_at"`
}

type ErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (s *Service) HandleSendMessage(ctx context.Context, client *websocket.Client, event websocket.Event) error {
	senderID, err := uuid.Parse(client.UserID)
	if err != nil || senderID == uuid.Nil {
		return sendChatError(client, "unauthorized", "invalid user context")
	}

	var payload SendMessagePayload
	if err := json.Unmarshal(event.Payload, &payload); err != nil {
		return sendChatError(client, "invalid_payload", "invalid chat payload")
	}

	recipientID, err := uuid.Parse(payload.RecipientID)
	if err != nil || recipientID == uuid.Nil {
		return sendChatError(client, "invalid_recipient", "recipient_id is invalid")
	}

	message, err := s.SendMessage(ctx, senderID, recipientID, payload.Content)
	if err != nil {
		return s.handleSendMessageError(client, err)
	}

	response := MessagePayload{
		ID:             message.ID.String(),
		ConversationID: message.ConversationID.String(),
		SenderID:       message.SenderID.String(),
		RecipientID:    recipientID.String(),
		Content:        message.Content,
		CreatedAt:      message.CreatedAt.UTC().Format(time.RFC3339Nano),
	}

	outgoing, err := websocket.NewEvent(websocket.EventChatMessage, response)
	if err != nil {
		slog.Error("failed to create chat websocket event", slog.Any("error", err))
		return err
	}

	if s.hub == nil {
		return client.SendEvent(outgoing)
	}

	if err := s.hub.SendToUser(senderID.String(), outgoing); err != nil {
		slog.Warn("failed to deliver chat message to sender", slog.Any("error", err))
	}
	if err := s.hub.SendToUser(recipientID.String(), outgoing); err != nil {
		slog.Warn("failed to deliver chat message to recipient", slog.Any("error", err))
	}

	return nil
}

func (s *Service) handleSendMessageError(client *websocket.Client, err error) error {
	switch {
	case errors.Is(err, ErrEmptyMessage):
		return sendChatError(client, "empty_message", "message is empty")
	case errors.Is(err, ErrMessageTooLong):
		return sendChatError(client, "message_too_long", "message is too long")
	case errors.Is(err, ErrUsersAreNotFriends):
		return sendChatError(client, "not_friends", "recipient is not your friend")
	case errors.Is(err, ErrCannotMessageSelf):
		return sendChatError(client, "invalid_recipient", "cannot send message to yourself")
	case errors.Is(err, sql.ErrNoRows):
		return sendChatError(client, "not_found", "chat resource was not found")
	default:
		slog.Error("failed to send chat message", slog.Any("error", err))
		return sendChatError(client, "internal_error", "could not send message")
	}
}

func sendChatError(client *websocket.Client, code string, message string) error {
	event, err := websocket.NewEvent(websocket.EventChatError, ErrorPayload{Code: code, Message: message})
	if err != nil {
		return err
	}
	return client.SendEvent(event)
}
