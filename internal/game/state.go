package game

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

var (
	ErrGameStateNotFound = errors.New("game state not found")
	ErrInvalidTurn       = errors.New("invalid turn")
	ErrInvalidGameTime   = errors.New("invalid game time")
	ErrGameTimeExpired   = errors.New("game time expired")
)

type Color string

const (
	ColorWhite Color = "w"
	ColorBlack Color = "b"
)

type StateStatus string

const (
	StateActive    StateStatus = "active"
	StateFinished  StateStatus = "finished"
	StateAbandoned StateStatus = "abandoned"
)

type State struct {
	MatchID uuid.UUID

	WhiteID uuid.UUID
	BlackID uuid.UUID

	FEN    string
	Turn   Color
	Status StateStatus

	WhiteTimeMs int64
	BlackTimeMs int64

	IncrementMs int64

	LastMoveAt time.Time

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

func (s *State) IsActive() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return s.Status == StateActive
}

func (s *State) ApplyMove(
	playerID uuid.UUID,
	fen string,
	now time.Time,
) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.Status != StateActive {
		return ErrGameNotActive
	}

	if playerID != s.currentPlayerID() {
		return ErrInvalidTurn
	}

	elapsedMs := now.Sub(s.LastMoveAt).Milliseconds()

	if elapsedMs < 0 {
		return ErrInvalidGameTime
	}

	switch s.Turn {
	case ColorWhite:
		s.WhiteTimeMs -= elapsedMs

		if s.WhiteTimeMs <= 0 {
			s.WhiteTimeMs = 0
			s.LastMoveAt = now
			s.Status = StateFinished

			return ErrGameTimeExpired
		}

		s.WhiteTimeMs += s.IncrementMs

	case ColorBlack:
		s.BlackTimeMs -= elapsedMs

		if s.BlackTimeMs <= 0 {
			s.BlackTimeMs = 0
			s.LastMoveAt = now
			s.Status = StateFinished

			return ErrGameTimeExpired
		}

		s.BlackTimeMs += s.IncrementMs

	default:
		return ErrInvalidTurn
	}

	s.FEN = fen
	s.LastMoveAt = now

	if s.Turn == ColorWhite {
		s.Turn = ColorBlack
	} else {
		s.Turn = ColorWhite
	}

	return nil
}

func (s *State) Finish() {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.Status = StateFinished
}

func (s *State) Abandon() {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.Status = StateAbandoned
}
