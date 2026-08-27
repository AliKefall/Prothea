package chat

import (
	"context"

	"github.com/AliKefall/prothea/internal/database"
	"github.com/google/uuid"
)

func (s *Service) GetConversation(
	ctx context.Context,
	conversationID uuid.UUID,
) (database.Conversation, error) {
	return s.queries.GetConversation(
		ctx,
		conversationID,
	)
}

func (s *Service) GetConversationMemeber(
	ctx context.Context,
	conversationID uuid.UUID,
)([]database.User, error ) {
	return s.queries.GetConversationMembers(
		ctx,
		conversationID,
	)
}

func (s *Service) IsConversationMember(
	ctx context.Context,
	conversationID uuid.UUID,
	userID uuid.UUID,
) (bool, error ) {
	return s.queries.IsConversationMember(
		ctx,
		database.IsConversationMemberParams{
			ConversationID: conversationID,
			UserID: userID,
		},
	)
}

func (s *Service) ListConversations (
	ctx context.Context,
	userID uuid.UUID,
)([]database.Conversation, error) {
	return s.queries.ListConversations(
		ctx,
		userID,
	)
}
