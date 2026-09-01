package friends

import (
	"context"
	"time"

	"github.com/AliKefall/prothea/internal/database"
	"github.com/AliKefall/prothea/internal/websocket"
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
			UserID:    a,
			FriendID:  b,
			CreatedAt: time.Now().UTC(),
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

	accepter, err := s.queries.GetUserByID(ctx, accepterID)
	if err != nil {
		return err
	}

	requester, err := s.queries.GetUserByID(ctx, requesterID)
	if err != nil {
		return err
	}

	// Backend reference: POST /friends/requests/accept removes the request, creates the friendship,
	// then emits websocket.EventAcceptFriendshipRequest to both users so both friend lists update.
	s.notifyUser(accepterID, websocket.EventAcceptFriendshipRequest, FriendEventPayload{
		ID:       requester.ID.String(),
		Username: requester.Username,
		Online:   true,
	})
	s.notifyUser(requesterID, websocket.EventAcceptFriendshipRequest, FriendEventPayload{
		ID:       accepter.ID.String(),
		Username: accepter.Username,
		Online:   true,
	})

	return nil
}

func (s *Service) AcceptFriendRequestEvent(ctx context.Context, accepterID uuid.UUID) {

}
