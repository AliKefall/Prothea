package friends

import (
	"context"

	"github.com/AliKefall/prothea/internal/database"
	"github.com/google/uuid"
)

func (s *Service) RejectFriendRequest(
	ctx context.Context,
	rejecterID uuid.UUID,
	requesterID uuid.UUID,
) error {

	if rejecterID == requesterID {
		return ErrSelfRequest
	}

	err := s.queries.DeleteFriendRequest(
		ctx,
		database.DeleteFriendRequestParams{
			RequesterID: requesterID,
		},
	)

	if err != nil {
		return err
	}

	return nil

}
