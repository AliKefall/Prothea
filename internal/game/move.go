package game

import (
	"errors"
	"time"

	"github.com/AliKefall/prothea/internal/database"
	"github.com/google/uuid"
)

var (
	ErrInvalidMove      = errors.New("invalid move")
	ErrPlayerNotInMatch = errors.New("player is not part of match")
	ErrGameNotActive    = errors.New("game is not active")
	ErrNotPlayerTurn    = errors.New("not player turn")
)

type MoveInput struct {
	MatchID  uuid.UUID
	PlayerID uuid.UUID
	From     string
	To       string
	Promotion string
}

type FinishResult struct {
	Result database.MatchResult

	WinnerID uuid.UUID
	LoserID  uuid.UUID

	Reason string

	WhiteRatingBefore int
	WhiteRatingAfter  int

	BlackRatingBefore int
	BlackRatingAfter  int
}

type MoveResult struct {
	MatchID uuid.UUID

	WhiteID uuid.UUID
	BlackID uuid.UUID

	MoveNumber int
	PlayerID   uuid.UUID

	From      string
	To        string
	Promotion string

	UCI string
	SAN string

	FENAfter string

	WhiteTimeMs int64
	BlackTimeMs int64

	LastMoveAt time.Time

	Finish *FinishResult
}
