package friends

import (
	"context"

	"github.com/AliKefall/prothea/internal/database"
	"github.com/google/uuid"
)

type Requests struct {
	Incoming []database.ListIncomingFriendRequestsByUserIDRow
	Outgoing []database.ListOutgoingFriendRequestsByUserIDRow
}

func (s *Service) ListRequests(
	ctx context.Context,
	userID uuid.UUID,
) (*Requests, error) {
	incoming, err := s.queries.ListIncomingFriendRequestsByUserID(
		ctx,
		userID,
	)
	if err != nil {
		return nil, err
	}

	outgoing, err := s.queries.ListOutgoingFriendRequestsByUserID(
		ctx,
		userID,
	)

	if err != nil {
		return nil, err
	}
	return &Requests{
		Incoming: incoming,
		Outgoing: outgoing,
	}, nil
}
