package elo

import (
	"math"
	"testing"
)

func TestUpdateMovesRatingTowardResult(t *testing.T) {
	current := NewRating()
	opponent := NewRating()
	won := Update(current, MatchResult{Opponent: opponent, Score: 1})
	lost := Update(current, MatchResult{Opponent: opponent, Score: 0})
	if !(won.Value > current.Value && lost.Value < current.Value) {
		t.Fatalf("expected win/loss to move rating in opposite directions: win=%v loss=%v", won.Value, lost.Value)
	}
	if won.GamesPlayed != current.GamesPlayed+1 || math.IsNaN(won.RD) {
		t.Fatalf("unexpected updated rating: %+v", won)
	}
}

func TestRatingProvisionalBoundary(t *testing.T) {
	rating := NewRating()
	if !rating.IsProvisional() {
		t.Fatal("new rating should be provisional")
	}
	rating.GamesPlayed = ProvisionalGames
	if rating.IsProvisional() {
		t.Fatal("rating at provisional game threshold should be established")
	}
}
