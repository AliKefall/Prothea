package game

import (
	"context"
	"database/sql"
	"errors"

	"github.com/AliKefall/prothea/internal/database"
	"github.com/google/uuid"
)

var ErrMatchNotFound = errors.New("match not found")

type Service struct {
	DB         *sql.DB
	Queries    *database.Queries
	StateStore StateStore
}

func NewService(
	db *sql.DB,
	queries *database.Queries,
	stateStore StateStore,
) *Service {
	return &Service{
		DB:         db,
		Queries:    queries,
		StateStore: stateStore,
	}
}

func (s *Service) CreateMatch(
	ctx context.Context,
	match Match,
) (database.Match, error) {
	return s.Queries.CreateMatch(
		ctx,
		database.CreateMatchParams{
			ID:                match.ID,
			WhiteID:           match.WhiteID,
			BlackID:           match.BlackID,
			TimeControl:      match.TimeControl,
			WhiteRatingBefore: int32(match.WhiteRatingBefore),
			BlackRatingBefore: int32(match.BlackRatingBefore),
		},
	)
}

func (s *Service) GetMatch(
	ctx context.Context,
	matchID uuid.UUID,
) (database.Match, error) {
	match, err := s.Queries.GetMatch(ctx, matchID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return database.Match{}, ErrMatchNotFound
		}

		return database.Match{}, err
	}

	return match, nil
}

func (s *Service) GetMatchForPlayer(
	ctx context.Context,
	matchID uuid.UUID,
	userID uuid.UUID,
) (database.Match, error) {
	match, err := s.Queries.GetMatchForPlayer(
		ctx,
		database.GetMatchForPlayerParams{
			ID:      matchID,
			WhiteID: userID,
		},
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return database.Match{}, ErrMatchNotFound
		}

		return database.Match{}, err
	}

	return match, nil
}

func (s *Service) GetMatchDetailsForPlayer(
	ctx context.Context,
	matchID uuid.UUID,
	userID uuid.UUID,
) (database.GetMatchDetailsForPlayerRow, error) {
	match, err := s.Queries.GetMatchDetailsForPlayer(
		ctx,
		database.GetMatchDetailsForPlayerParams{
			ID:      matchID,
			WhiteID: userID,
		},
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return database.GetMatchDetailsForPlayerRow{}, ErrMatchNotFound
		}

		return database.GetMatchDetailsForPlayerRow{}, err
	}

	return match, nil
}

func (s *Service) GetActiveMatchForPlayer(
	ctx context.Context,
	userID uuid.UUID,
) (database.Match, error) {
	match, err := s.Queries.GetActiveMatchForPlayer(
		ctx,
		userID,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return database.Match{}, ErrMatchNotFound
		}

		return database.Match{}, err
	}

	return match, nil
}

func (s *Service) GetMatchMoves(
	ctx context.Context,
	matchID uuid.UUID,
) ([]database.MatchMove, error) {
	moves, err := s.Queries.GetMatchMoves(
		ctx,
		matchID,
	)
	if err != nil {
		return nil, err
	}

	return moves, nil
}

func (s *Service) FinishMatch(
	ctx context.Context,
	matchID uuid.UUID,
	result database.MatchResult,
	whiteRatingAfter int,
	blackRatingAfter int,
) (database.Match, error) {
	match, err := s.Queries.FinishMatch(
		ctx,
		database.FinishMatchParams{
			ID:     matchID,
			Result: result,
			WhiteRatingAfter: sql.NullInt32{
				Valid: true,
				Int32: int32(whiteRatingAfter),
			},
			BlackRatingAfter: sql.NullInt32{
				Valid: true,
				Int32: int32(blackRatingAfter),
			},
		},
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return database.Match{}, ErrMatchNotFound
		}

		return database.Match{}, err
	}

	return match, nil
}
