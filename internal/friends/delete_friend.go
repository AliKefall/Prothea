package friends

import (
	"context"

	"github.com/AliKefall/prothea/internal/database"
	"github.com/google/uuid"
)

func (s *Service) DeleteFriend(
	ctx context.Context,
	userID uuid.UUID,
	friendID uuid.UUID,
) error {
	if userID == friendID {
		return ErrSelfRequest
	}

	a, b := normalizeFriendPair(userID, friendID)

	err := s.queries.DeleteFriendship(
		ctx,
		database.DeleteFriendshipParams{
			UserID:   a,
			FriendID: b,
		},
	)

	if err != nil {
		return err
	}

	return nil
}
