package chat

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/AliKefall/prothea/internal/websocket"
	"github.com/google/uuid"
)

var (
	ErrInvalidRecipientID = errors.New("invalid recipient id")
	ErrEmptyMessage = errors.New("message can not be empty")
)

type Service struct{
	hub *websocket.Hub
}

func NewService(hub *websocket.Hub) *Service{
	return &Service{
		hub: hub,
	}
}

func (s *Service) HandleSendMessage(
	ctx context.Context,
	client *websocket.Client,
	event websocket.Event,
)error{
	var input SendMessageInput

	if err := json.Unmarshal(event.Payload, &input); err != nil {
		return err
	}

	input.RecipientID = strings.TrimSpace(input.RecipientID)
	input.Content = strings.TrimSpace(input.Content)

	if input.RecipientID == ""{
		return ErrInvalidRecipientID
	}

	if input.Content == "" {
		return ErrEmptyMessage
	}

	if _, err := uuid.Parse(input.RecipientID); err != nil {
		return ErrInvalidRecipientID
	}

	messageID := uuid.NewString()

	payload := MessagePayload{
		MessageID: messageID,
		SenderID: client.UserID,
		SenderUsername: client.Username,
		RecipientID: input.RecipientID,
		Content: input.Content,
	}

	message, err := websocket.NewEvent(
		websocket.EventChatMessage,
		payload,
	)

	if err != nil {
		return err
	}

	return s.hub.SendToUser(
		input.RecipientID,
		message,
	)

}
