package game

import (
	"context"

	"github.com/google/uuid"
)

type StateStore interface {
	Get(
		ctx context.Context,
		matchID uuid.UUID,
	) (*State, error)

	Set(
		ctx context.Context,
		state *State,
	) error

	Delete(
		ctx context.Context,
		matchID uuid.UUID,
	) error
}
