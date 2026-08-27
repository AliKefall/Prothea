package chat

import (
	"context"
	"errors"
	"strings"

	"github.com/AliKefall/prothea/internal/database"
	"github.com/google/uuid"
)

var (
	ErrUsersAreNotFriends = errors.New("users are not friend")
	ErrEmptyMessage       = errors.New("message is empty")
	ErrMessageTooLong     = errors.New("message is too long")
)

const MaxMessageLength = 500

func (s *Service) SendMessage(
	ctx context.Context,
	senderID uuid.UUID,
	recipientID uuid.UUID,
	content string,
) (database.Message, error) {
	content = strings.TrimSpace(content)

	if content == "" {
		return database.Message{}, ErrEmptyMessage
	}

	if len(content) > MaxMessageLength {
		return database.Message{}, ErrEmptyMessage
	}

	a, b := normalizeFriend(senderID, recipientID)
	areFriends, err := s.queries.FriendshipExists(ctx, database.FriendshipExistsParams{
		UserID:   a,
		FriendID: b,
	})

	if err != nil {
		return database.Message{}, err
	}

	if !areFriends {
		return database.Message{}, ErrUsersAreNotFriends
	}

	conversation, err := s.getOrCreateDirectConversation(
		ctx,
		senderID,
		recipientID,
	)
	if err != nil {
		return database.Message{}, err
	}

	return s.createMessage(
		ctx,
		conversation.ID,
		senderID,
		content,
	)
}

func normalizeFriend(a, b uuid.UUID) (uuid.UUID, uuid.UUID) {
	if a.String() < b.String() {
		return a, b
	}
	return b, a
}

func (s *Service) createMessage(
	ctx context.Context,
	conversationID uuid.UUID,
	senderID uuid.UUID,
	content string,
) (database.Message, error) {
	return s.queries.CreateMessage(
		ctx,
		database.CreateMessageParams{
			ID:             uuid.New(),
			ConversationID: conversationID,
			SenderID:       senderID,
			Content:        content,
		},
	)
}

func (s *Service) GetMessage(
	ctx context.Context,
	messageID uuid.UUID,
) (database.Message, error) {
	return s.queries.GetMessage(ctx, messageID)
}

func (s *Service) GetMessages(
	ctx context.Context,
	conversationID uuid.UUID,
	limit int32,
	offset int32,
) ([]database.Message, error) {
	return s.queries.ListMessages(
		ctx,
		database.ListMessagesParams{
			ConversationID: conversationID,
			Limit:          limit,
			Offset:         offset,
		},
	)
}

func (s *Service) EditMessage(
	ctx context.Context,
	messageID uuid.UUID,
	content string,
) (database.Message, error) {
	content = strings.TrimSpace(content)

	if content == "" {
		return database.Message{}, ErrEmptyMessage
	}

	if len(content) > MaxMessageLength {
		return database.Message{}, ErrMessageTooLong
	}

	return s.queries.EditMessage(ctx, database.EditMessageParams{
		ID:      messageID,
		Content: content,
	})
}

func (s *Service) DeleteMessage(
	ctx context.Context,
	messageID uuid.UUID,
) error {
	return s.queries.DeleteMessage(ctx, messageID)
}

func (s *Service) GetLastMessage(
	ctx context.Context,
	conversationID uuid.UUID,
) (database.Message, error) {
	return s.queries.GetLastMessage(
		ctx,
		conversationID,
	)
}
