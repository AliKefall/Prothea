package elo

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

var ErrInvalidMatchResult = errors.New("invalid match result")

type Service struct {
	Repository *Repository
}

// NewService creates a new Elo service.
func NewService(
	repository *Repository,
) *Service {
	return &Service{
		Repository: repository,
	}
}

// Result represents the outcome of a match from White's perspective.
type Result float64

const (
	ResultWhiteWin Result = 1.0
	ResultDraw     Result = 0.5
	ResultBlackWin Result = 0.0
)

// MatchRatings contains the rating state of both players
// before and after the match.
type MatchRatings struct {
	WhiteBefore Rating
	BlackBefore Rating

	WhiteAfter Rating
	BlackAfter Rating
}

// CalculateMatch calculates the new ratings for both players.
//
// The calculation uses each player's rating before the match
// and the opponent's rating before the match.
func (s *Service) CalculateMatch(
	white Rating,
	black Rating,
	result Result,
) (MatchRatings, error) {
	switch result {
	case ResultWhiteWin, ResultDraw, ResultBlackWin:
	default:
		return MatchRatings{}, ErrInvalidMatchResult
	}

	whiteAfter := Update(
		white,
		MatchResult{
			Opponent: black,
			Score:    float64(result),
		},
	)

	blackAfter := Update(
		black,
		MatchResult{
			Opponent: white,
			Score:    1.0 - float64(result),
		},
	)

	return MatchRatings{
		WhiteBefore: white,
		BlackBefore: black,

		WhiteAfter: whiteAfter,
		BlackAfter: blackAfter,
	}, nil
}

// UpdateMatch loads both players' ratings, calculates the new ratings,
// and persists the complete rating update in a single transaction.
func (s *Service) UpdateMatch(
	ctx context.Context,
	matchID uuid.UUID,
	whiteID uuid.UUID,
	blackID uuid.UUID,
	ratingType RatingType,
	result Result,
) (MatchRatings, error) {
	if s == nil || s.Repository == nil {
		return MatchRatings{}, errors.New(
			"elo service is not initialized",
		)
	}

	// Load White's current rating.
	white, err := s.Repository.GetRating(
		ctx,
		whiteID,
		ratingType,
	)
	if err != nil {
		return MatchRatings{}, err
	}

	// Load Black's current rating.
	black, err := s.Repository.GetRating(
		ctx,
		blackID,
		ratingType,
	)
	if err != nil {
		return MatchRatings{}, err
	}

	// Calculate both players' new ratings using their
	// pre-match rating values.
	matchRatings, err := s.CalculateMatch(
		white,
		black,
		result,
	)
	if err != nil {
		return MatchRatings{}, err
	}

	// Persist both rating updates and both history records
	// atomically in one database transaction.
	if err := s.Repository.UpdateMatch(
		ctx,
		matchID,
		ratingType,
		whiteID,
		blackID,
		matchRatings.WhiteBefore,
		matchRatings.BlackBefore,
		matchRatings.WhiteAfter,
		matchRatings.BlackAfter,
	); err != nil {
		return MatchRatings{}, err
	}

	return matchRatings, nil
}
