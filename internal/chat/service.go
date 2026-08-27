package chat

import (
	"context"
	"database/sql"
	"errors"

	"github.com/AliKefall/prothea/internal/database"
	"github.com/google/uuid"
)

type Service struct{
	db *sql.DB
	queries *database.Queries
}

func NewService(
	db *sql.DB,
	queries *database.Queries,
) *Service {
	return &Service{
		db: db,
		queries: queries,
	}
}

func (s *Service) getOrCreateDirectConversation(
	ctx context.Context,
	userA uuid.UUID,
	userB uuid.UUID,
) (database.Conversation, error) {
	if userA == userB {
		return database.Conversation{}, errors.New("can not create conversation with yourself")

	}

	conversation, err := s.queries.FindDirectConversation(ctx, database.FindDirectConversationParams{
		UserID: userA,
		UserID_2: userB,
	})

	if err == nil {
		return conversation, nil
	}

	if !errors.Is(err, sql.ErrNoRows) {
		return database.Conversation{}, err
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return database.Conversation{}, err
	}

	defer func(){
		_ = tx.Rollback()
	}()

	qtx := s.queries.WithTx(tx)

	conversationID := uuid.New()

	conversation, err = qtx.CreateConversation(ctx, database.CreateConversationParams{
		ID: conversationID,
		Type: "direct",
	})

	if err != nil {
		return database.Conversation{}, err
	}

	if _, err := qtx.AddConversationMember(ctx, database.AddConversationMemberParams{
		ConversationID: conversationID,
		UserID: userA,
	}); err != nil {
		return database.Conversation{}, err
	}

	if _, err := qtx.AddConversationMember(ctx, database.AddConversationMemberParams{
		ConversationID: conversationID,
		UserID: userA,
	}); err != nil {
		return database.Conversation{}, err
	}

	if _, err := qtx.AddConversationMember(ctx, database.AddConversationMemberParams{
		ConversationID: conversationID,
		UserID: userB,
	}); err != nil {
		return database.Conversation{}, err
	}

	if err := tx.Commit(); err != nil {
		return database.Conversation{}, err
	}

	return conversation, nil
}
