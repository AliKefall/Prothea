package friends

import (
	"context"

	"github.com/AliKefall/prothea/internal/database"
	"github.com/google/uuid"
)

func (s *Service) AcceptFriendRequest(
	ctx context.Context,
	accepterID uuid.UUID,
	requesterID uuid.UUID,
) error {
	if accepterID == requesterID {
		return ErrSelfRequest
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}

	defer func() {
		_ = tx.Rollback()
	}()

	qtx := s.queries.WithTx(tx)

	err = qtx.DeleteFriendRequest(
		ctx,
		database.DeleteFriendRequestParams{
			RequesterID: requesterID,
			TargetID:    accepterID,
		},
	)

	if err != nil {
		return err
	}

	a, b := normalizeFriendPair(accepterID, requesterID)

	rows, err := qtx.CreateFriendship(
		ctx,
		database.CreateFriendshipParams{
			UserID:   a,
			FriendID: b,
		},
	)

	if err != nil {
		return err
	}

	if rows == 0 {
		return ErrAlreadyFriends
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	return nil
}

func (s *Service) AcceptFriendRequestEvent(ctx context.Context, accepterID uuid.UUID) {

}
