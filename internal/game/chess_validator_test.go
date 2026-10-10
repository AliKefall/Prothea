package game

import (
	"context"
	"testing"
)

func TestChessValidatorAcceptsLegalMove(t *testing.T) {
	move, err := NewChessValidator().Validate(context.Background(), "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "e2", "e4", "")
	if err != nil {
		t.Fatalf("Validate() error = %v", err)
	}
	if move.UCI != "e2e4" || move.SAN != "e4" || move.FENAfter == "" {
		t.Fatalf("unexpected validated move: %+v", move)
	}
}

func TestChessValidatorRejectsIllegalMove(t *testing.T) {
	_, err := NewChessValidator().Validate(context.Background(), "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "e2", "e5", "")
	if err != ErrInvalidMove {
		t.Fatalf("Validate() error = %v, want %v", err, ErrInvalidMove)
	}
}
