package game

import (
	"context"
)

type MoveValidator interface {
	Validate(
		ctx context.Context,
		fen string,
		from string,
		to string,
		promotion string,
	) (ValidatedMove, error)
}

type ValidatedMove struct {
	SAN      string
	UCI      string
	FENAfter string
}
