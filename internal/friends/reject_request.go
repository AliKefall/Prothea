package friends

import (
	"context"

	"github.com/AliKefall/prothea/internal/database"
	"github.com/AliKefall/prothea/internal/websocket"
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
			TargetID:    rejecterID,
		},
	)

	if err != nil {
		return err
	}

	rejecter, err := s.queries.GetUserByID(ctx, rejecterID)
	if err != nil {
		return err
	}

	// Backend reference: POST /friends/requests/reject deletes the pending row and emits
	// websocket.EventRejectFriendshipRequest so the sender can clear its outgoing request.
	s.notifyUser(requesterID, websocket.EventRejectFriendshipRequest, FriendEventPayload{
		ID:       rejecter.ID.String(),
		Username: rejecter.Username,
	})

	return nil

}
