package friends

import (
	"context"

	"github.com/AliKefall/prothea/internal/database"
	"github.com/google/uuid"
)

func (s *Service) ListFriends(
	ctx context.Context,
	userID uuid.UUID,
) ([]database.ListFriendsByUserIDRow, error) {
	friends, err := s.queries.ListFriendsByUserID(
		ctx,
		userID,
	)
	if err != nil {
		return nil, err
	}
	return friends, nil
}
