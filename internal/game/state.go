package game

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

var (
	ErrGameStateNotFound   = errors.New("game state not found")
	ErrInvalidTurn         = errors.New("invalid turn")
	ErrInvalidGameTime     = errors.New("invalid game time")
	ErrGameTimeExpired     = errors.New("game time expired")
	ErrDrawOfferPending    = errors.New("draw offer already pending")
	ErrDrawOfferNotPending = errors.New("draw offer is not pending")
	ErrNotDrawOfferOwner   = errors.New("player does not own the draw offer")
	ErrDrawOfferOwner      = errors.New("player has already offered draw")

	ErrGameTimeNotExpired = errors.New("game time has not expired")
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

	// This could be a bit confusing, simply what this does is
	// identifies the player who currently has a pending draw offer
	// A nil value means there is no active draw offer.
	DrawOfferBy *uuid.UUID

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

func (s *State) OfferDraw(playerID uuid.UUID) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.Status != StateActive {
		return ErrGameNotActive
	}

	if playerID != s.WhiteID &&
		playerID != s.BlackID {
		return ErrPlayerNotInMatch
	}

	if s.DrawOfferBy != nil {
		return ErrDrawOfferPending
	}

	player := playerID
	s.DrawOfferBy = &player

	return nil
}

func (s *State) CancelDrawOffer(playerID uuid.UUID) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.DrawOfferBy == nil {
		return ErrDrawOfferPending
	}

	if *s.DrawOfferBy != playerID {
		return ErrNotDrawOfferOwner
	}

	s.DrawOfferBy = nil
	return nil
}

func (s *State) AcceptDraw(playerID uuid.UUID) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.Status != StateActive {
		return ErrGameNotActive
	}

	if s.DrawOfferBy == nil {
		return ErrDrawOfferNotPending
	}

	if *s.DrawOfferBy == playerID {
		return ErrDrawOfferOwner
	}

	if playerID != s.WhiteID &&
		playerID != s.BlackID {
		return ErrPlayerNotInMatch
	}

	return nil
}

// This is for if the player decided to take back his draw offer
func (s *State) DeclineDraw(playerID uuid.UUID) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.Status != StateActive {
		return ErrGameNotActive
	}

	if s.DrawOfferBy == nil {
		return ErrDrawOfferNotPending
	}

	// The player declining the offer must be the opponent.
	if *s.DrawOfferBy == playerID {
		return ErrDrawOfferOwner
	}

	if playerID != s.WhiteID &&
		playerID != s.BlackID {
		return ErrPlayerNotInMatch
	}

	s.DrawOfferBy = nil

	return nil
}

