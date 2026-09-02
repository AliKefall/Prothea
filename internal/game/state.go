package game

import (
	"errors"
	"sync"

	"github.com/google/uuid"
)

var (
	ErrGameStateNotFound = errors.New("game state not found")
	ErrInvalidTurn       = errors.New("invalid turn")
)

type Color string

const (
	ColorWhite Color = "w"
	ColorBlack Color = "b"
)

type State struct {
	MatchID uuid.UUID

	WhiteID uuid.UUID
	BlackID uuid.UUID

	FEN string

	Turn Color

	WhiteTimeMs int64
	BlackTimeMs int64

	mu sync.RWMutex
}

func (s *State) currentPlayerID() uuid.UUID {
	if s.Turn == ColorWhite {
		return s.WhiteID
	}

	return s.BlackID
}

func (s *State) CurrentPlayerID() uuid.UUID {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return s.currentPlayerID()
}

func (s *State) IsPlayerTurn(playerID uuid.UUID) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return s.currentPlayerID() == playerID
}

func (s *State) ApplyTurn(
	playerID uuid.UUID,
	fen string,
	whiteTimeMs int64,
	blackTimeMs int64,
) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if playerID != s.currentPlayerID() {
		return ErrInvalidTurn
	}

	s.FEN = fen
	s.WhiteTimeMs = whiteTimeMs
	s.BlackTimeMs = blackTimeMs

	if s.Turn == ColorWhite {
		s.Turn = ColorBlack
	} else {
		s.Turn = ColorWhite
	}

	return nil
}
