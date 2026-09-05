package elo

import (
	"context"
	"database/sql"
	"errors"

	"github.com/AliKefall/prothea/internal/database"
	"github.com/google/uuid"
)

type Repository struct {
	DB      *sql.DB
	Queries *database.Queries
}

func NewRepository(
	db *sql.DB,
	queries *database.Queries,
) *Repository {
	return &Repository{
		DB:      db,
		Queries: queries,
	}
}

// GetRating loads a player's rating for a specific rating pool.
func (r *Repository) GetRating(
	ctx context.Context,
	userID uuid.UUID,
	ratingType RatingType,
) (Rating, error) {
	row, err := r.Queries.GetPlayerRating(
		ctx,
		database.GetPlayerRatingParams{
			UserID:     userID,
			RatingType: database.RatingType(ratingType),
		},
	)
	if err != nil {
		return Rating{}, err
	}

	return Rating{
		Value:       row.Rating,
		RD:          row.Rd,
		Volatility:  row.Volatility,
		GamesPlayed: int(row.GamesPlayed),
	}, nil
}

// UpdateRating persists a player's new rating state.
func (r *Repository) UpdateRating(
	ctx context.Context,
	userID uuid.UUID,
	ratingType RatingType,
	rating Rating,
) (database.PlayerRating, error) {
	return r.Queries.UpdatePlayerRating(
		ctx,
		database.UpdatePlayerRatingParams{
			UserID:      userID,
			RatingType:  database.RatingType(ratingType),
			Rating:      rating.Value,
			Rd:          rating.RD,
			Volatility:  rating.Volatility,
			GamesPlayed: int32(rating.GamesPlayed),
		},
	)
}

// CreateRatingHistory stores the rating transition after a completed match.
func (r *Repository) CreateRatingHistory(
	ctx context.Context,
	userID uuid.UUID,
	matchID uuid.UUID,
	ratingType RatingType,
	oldRating Rating,
	newRating Rating,
) error {
	return r.Queries.CreateRatingHistory(
		ctx,
		database.CreateRatingHistoryParams{
			UserID:        userID,
			MatchID:       matchID,
			RatingType:    database.RatingType(ratingType),
			OldRating:     oldRating.Value,
			NewRating:     newRating.Value,
			OldRd:         oldRating.RD,
			NewRd:         newRating.RD,
			OldVolatility: oldRating.Volatility,
			NewVolatility: newRating.Volatility,
		},
	)
}

// UpdateMatch persists both players' new ratings and their rating history
// in a single database transaction.
//
// If any operation fails, the entire transaction is rolled back.
func (r *Repository) UpdateMatch(
	ctx context.Context,
	matchID uuid.UUID,
	ratingType RatingType,
	whiteID uuid.UUID,
	blackID uuid.UUID,
	whiteBefore Rating,
	blackBefore Rating,
	whiteAfter Rating,
	blackAfter Rating,
) error {
	if r == nil || r.DB == nil || r.Queries == nil {
		return errors.New("elo repository is not initialized")
	}

	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}

	defer func() {
		_ = tx.Rollback()
	}()

	qtx := r.Queries.WithTx(tx)

	_, err = qtx.UpdatePlayerRating(
		ctx,
		database.UpdatePlayerRatingParams{
			UserID:      whiteID,
			RatingType:  database.RatingType(ratingType),
			Rating:      whiteAfter.Value,
			Rd:          whiteAfter.RD,
			Volatility:  whiteAfter.Volatility,
			GamesPlayed: int32(whiteAfter.GamesPlayed),
		},
	)
	if err != nil {
		return err
	}

	_, err = qtx.UpdatePlayerRating(
		ctx,
		database.UpdatePlayerRatingParams{
			UserID:      blackID,
			RatingType:  database.RatingType(ratingType),
			Rating:      blackAfter.Value,
			Rd:          blackAfter.RD,
			Volatility:  blackAfter.Volatility,
			GamesPlayed: int32(blackAfter.GamesPlayed),
		},
	)
	if err != nil {
		return err
	}

	if err := qtx.CreateRatingHistory(
		ctx,
		database.CreateRatingHistoryParams{
			UserID:        whiteID,
			MatchID:       matchID,
			RatingType:    database.RatingType(ratingType),
			OldRating:     whiteBefore.Value,
			NewRating:     whiteAfter.Value,
			OldRd:         whiteBefore.RD,
			NewRd:         whiteAfter.RD,
			OldVolatility: whiteBefore.Volatility,
			NewVolatility: whiteAfter.Volatility,
		},
	); err != nil {
		return err
	}

	if err := qtx.CreateRatingHistory(
		ctx,
		database.CreateRatingHistoryParams{
			UserID:        blackID,
			MatchID:       matchID,
			RatingType:    database.RatingType(ratingType),
			OldRating:     blackBefore.Value,
			NewRating:     blackAfter.Value,
			OldRd:         blackBefore.RD,
			NewRd:         blackAfter.RD,
			OldVolatility: blackBefore.Volatility,
			NewVolatility: blackAfter.Volatility,
		},
	); err != nil {
		return err
	}

	return tx.Commit()
}
