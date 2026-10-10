package game

import (
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestStateApplyMoveUpdatesTurnAndClock(t *testing.T) {
	white, black := uuid.New(), uuid.New()
	now := time.Now()
	state := &State{WhiteID: white, BlackID: black, Turn: ColorWhite, Status: StateActive, WhiteTimeMs: 10_000, BlackTimeMs: 10_000, IncrementMs: 2_000, LastMoveAt: now}
	if err := state.ApplyMove(white, "next-fen", now.Add(3*time.Second)); err != nil {
		t.Fatalf("ApplyMove() error = %v", err)
	}
	if state.Turn != ColorBlack || state.FEN != "next-fen" || state.WhiteTimeMs != 9_000 {
		t.Fatalf("unexpected state after move: %+v", state)
	}
	if err := state.ApplyMove(white, "", now.Add(4*time.Second)); !errors.Is(err, ErrInvalidTurn) {
		t.Fatalf("out-of-turn move error = %v", err)
	}
}

func TestStateApplyMoveFinishesOnClockExpiry(t *testing.T) {
	white := uuid.New()
	now := time.Now()
	state := &State{WhiteID: white, BlackID: uuid.New(), Turn: ColorWhite, Status: StateActive, WhiteTimeMs: 1_000, LastMoveAt: now}
	if err := state.ApplyMove(white, "", now.Add(2*time.Second)); !errors.Is(err, ErrGameTimeExpired) {
		t.Fatalf("ApplyMove() error = %v", err)
	}
	if state.Status != StateFinished || state.WhiteTimeMs != 0 {
		t.Fatalf("clock expiry did not finish game: %+v", state)
	}
}

func TestDrawOfferLifecycle(t *testing.T) {
	white, black := uuid.New(), uuid.New()
	state := &State{WhiteID: white, BlackID: black, Status: StateActive}
	if err := state.OfferDraw(white); err != nil {
		t.Fatalf("OfferDraw() error = %v", err)
	}
	if err := state.AcceptDraw(white); !errors.Is(err, ErrDrawOfferOwner) {
		t.Fatalf("owner accept error = %v", err)
	}
	if err := state.DeclineDraw(black); err != nil {
		t.Fatalf("DeclineDraw() error = %v", err)
	}
	if state.DrawOfferBy != nil {
		t.Fatal("declined draw offer should be cleared")
	}
}
