package friends

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/AliKefall/prothea/internal/database"
	"github.com/google/uuid"
)

func (s *Service) SendFriendRequest(ctx context.Context, requesterID uuid.UUID, targetID uuid.UUID) error {
	if requesterID == targetID {
		return ErrSelfRequest
	}

	target, err := s.queries.GetUserByID(ctx, targetID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrUserNotFound
		}
		return err
	}

	a, b := normalizeFriendPair(requesterID, target.ID)

	alreadyFriends, err := s.queries.FriendshipExists(
		ctx,
		database.FriendshipExistsParams{
			UserID:   a,
			FriendID: b,
		},
	)
	if err != nil {
		return err
	}

	if alreadyFriends {
		return ErrAlreadyFriends
	}

	requestExists, err := s.queries.FriendRequestExists(
		ctx,
		database.FriendRequestExistsParams{
			RequesterID: requesterID,
		},
	)

	if err != nil {
		return err
	}

	if requestExists {
		return ErrRequestAlreadyExists
	}

	rows, err := s.queries.CreateFriendRequest(
		ctx,
		database.CreateFriendRequestParams{
			RequesterID: requesterID,
			TargetID:    target.ID,
			CreatedAt:   time.Now().UTC(),
		},
	)

	if err != nil {
		return err
	}

	if rows == 0 {
		return ErrRequestAlreadyExists
	}

	return nil
}

func normalizeFriendPair(a uuid.UUID, b uuid.UUID)(uuid.UUID, uuid.UUID) {
	if bytes.Compare(a[:], b[:]) < 0 {
		return a, b
	}
	return b, a
}
