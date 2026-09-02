package game

import (
	"time"

	"github.com/google/uuid"
)

type Status string

const (
	StatusPending Status = "pending"
	StatusWhiteWon Status = "white"
	StatusBlackWon Status = "black"
	StatusDraw Status = "draw"
	StatusAbondened Status = "abandoned"
)

type Match struct{
	ID uuid.UUID
	WhiteID uuid.UUID
	BlackID uuid.UUID

	TimeControl string

	WhiteRatingBefore int
	BlackRatingBefore int

	WhiteRatingAfter *int
	BlackRatingAfter *int

	Result Status

	CreatedAt time.Time
	FinishedAt *time.Time
}

type Move struct{
	ID uuid.UUID

	MatchID uuid.UUID
	MoveNumber int
	PlayerID uuid.UUID

	SAN string
	UCI string

	FENAfter string

	WhiteTimeMs int64
	BlackTimeMs int64

	Createdat time.Time
}
