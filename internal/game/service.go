package game

import (
	"context"
	"database/sql"
	"errors"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/AliKefall/prothea/internal/database"
	"github.com/AliKefall/prothea/internal/elo"
	"github.com/google/uuid"
)

const StartingFEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

var ErrMatchNotFound = errors.New("match not found")

type Service struct {
	DB            *sql.DB
	Queries       *database.Queries
	StateStore    StateStore
	MoveValidator MoveValidator
	GameLock      *RedisGameLock
	EloService    *elo.Service
}

type GameFinishedEvent struct {
	MatchID  string `json:"match_id"`
	Result   string `json:"result"`
	WinnerID string `json:"winner_id"`
	LoserID  string `json:"loser_id"`

	Reason string `json:"reason"`

	WhiteRatingBefore int `json:"white_rating_before"`
	WhiteRatingAfter  int `json:"white_rating_after"`

	BlackRatingBefore int `json:"black_rating_before"`
	BlackRatingAfter  int `json:"black_rating_after"`

	CreatedAt string `json:"created_at"`
}

// NewService creates a new game service with all required dependencies.
func NewService(
	db *sql.DB,
	queries *database.Queries,
	stateStore StateStore,
	moveValidator MoveValidator,
	gameLock *RedisGameLock,
	eloService *elo.Service,
) *Service {
	return &Service{
		DB:            db,
		Queries:       queries,
		StateStore:    stateStore,
		MoveValidator: moveValidator,
		GameLock:      gameLock,
		EloService:    eloService,
	}
}

// CreateMatch persists a new match and creates its initial game state.
func (s *Service) CreateMatch(
	ctx context.Context,
	match Match,
) (database.Match, error) {
	if s == nil || s.Queries == nil {
		return database.Match{}, errors.New(
			"game service is not initialized",
		)
	}

	createdMatch, err := s.Queries.CreateMatch(
		ctx,
		database.CreateMatchParams{
			ID:                match.ID,
			WhiteID:           match.WhiteID,
			BlackID:           match.BlackID,
			TimeControl:       match.TimeControl,
			WhiteRatingBefore: int32(match.WhiteRatingBefore),
			BlackRatingBefore: int32(match.BlackRatingBefore),
		},
	)
	if err != nil {
		return database.Match{}, err
	}

	// Create the initial in-memory game state in Redis.
	if err := s.createInitialState(ctx, match); err != nil {
		return createdMatch, err
	}

	return createdMatch, nil
}

// createInitialState initializes the Redis state for a newly created match.
func (s *Service) createInitialState(
	ctx context.Context,
	match Match,
) error {
	if s.StateStore == nil {
		return errors.New(
			"game state store is not initialized",
		)
	}

	// Convert the time control, for example 10+5,
	// into the initial clock time and increment in milliseconds.
	initialTimeMs, incrementMs, err := parseTimeControl(
		match.TimeControl,
	)
	if err != nil {
		return err
	}

	state := &State{
		MatchID: match.ID,

		WhiteID: match.WhiteID,
		BlackID: match.BlackID,

		FEN:    StartingFEN,
		Turn:   ColorWhite,
		Status: StateActive,

		WhiteTimeMs: initialTimeMs,
		BlackTimeMs: initialTimeMs,

		IncrementMs: incrementMs,

		// The clock starts when the initial game state is created.
		LastMoveAt: time.Now().UTC(),
	}

	return s.StateStore.Set(
		ctx,
		state,
	)
}

// GetMatch returns a match by its ID.
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

// GetMatchForPlayer returns a match only if the user is one of its players.
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

// GetMatchDetailsForPlayer returns detailed match information
// while also enforcing player-level authorization.
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

// GetActiveMatchForPlayer returns the player's currently active match.
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

// GetMatchMoves returns all moves played in a match.
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

// FinishMatch marks a pending match as finished.
//
// Rating values may be nil because the rating system has not necessarily
// calculated the final ratings yet. In that case, NULL is stored in the DB.
func (s *Service) FinishMatch(
	ctx context.Context,
	matchID uuid.UUID,
	result database.MatchResult,
	whiteRatingAfter *int,
	blackRatingAfter *int,
) (database.Match, error) {
	var whiteRating sql.NullInt32

	if whiteRatingAfter != nil {
		whiteRating = sql.NullInt32{
			Valid: true,
			Int32: int32(*whiteRatingAfter),
		}
	}

	var blackRating sql.NullInt32

	if blackRatingAfter != nil {
		blackRating = sql.NullInt32{
			Valid: true,
			Int32: int32(*blackRatingAfter),
		}
	}

	match, err := s.Queries.FinishMatch(
		ctx,
		database.FinishMatchParams{
			ID:     matchID,
			Result: result,

			WhiteRatingAfter: whiteRating,
			BlackRatingAfter: blackRating,
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

// ApplyMove validates and applies a player move.
//
// The method is responsible for the complete application-level move flow:
//  1. Acquire the distributed game lock.
//  2. Load the current game state from Redis.
//  3. Validate player membership and turn.
//  4. Validate the chess move.
//  5. Apply the move to the game state.
//  6. Persist the updated state to Redis.
//  7. Persist the move to PostgreSQL.
//  8. Return the authoritative move result.
func (s *Service) ApplyMove(
	ctx context.Context,
	input MoveInput,
) (MoveResult, error) {
	if s.GameLock == nil {
		return MoveResult{}, errors.New(
			"game lock is not initialized",
		)
	}

	// Lock the entire move operation so concurrent requests
	// cannot update the same game state at the same time.
	release, err := s.GameLock.Acquire(
		ctx,
		input.MatchID,
	)
	if err != nil {
		return MoveResult{}, err
	}
	defer release()

	if s == nil {
		return MoveResult{}, errors.New(
			"game service is nil",
		)
	}

	if s.StateStore == nil {
		return MoveResult{}, errors.New(
			"game state store is nil",
		)
	}

	if s.MoveValidator == nil {
		return MoveResult{}, errors.New(
			"move validator is nil",
		)
	}

	// Load the authoritative game state from Redis.
	state, err := s.StateStore.Get(
		ctx,
		input.MatchID,
	)
	if err != nil {
		return MoveResult{}, err
	}

	// Do not allow moves after the game has finished or been abandoned.
	if !state.IsActive() {
		return MoveResult{}, ErrGameNotActive
	}

	// Make sure the player belongs to this match.
	if state.WhiteID != input.PlayerID &&
		state.BlackID != input.PlayerID {
		return MoveResult{}, ErrPlayerNotInMatch
	}

	// Make sure it is currently this player's turn.
	if !state.IsPlayerTurn(input.PlayerID) {
		return MoveResult{}, ErrNotPlayerTurn
	}

	// Validate the move against the current authoritative FEN.
	validatedMove, err := s.MoveValidator.Validate(
		ctx,
		state.FEN,
		input.From,
		input.To,
		input.Promotion,
	)
	if err != nil {
		return MoveResult{}, err
	}

	now := time.Now().UTC()

	// Apply the move to the authoritative game state.
	//
	// State.ApplyMove also handles:
	// - clock calculation
	// - increment
	// - turn switching
	// - game expiration
	// - FEN update
	if err := state.ApplyMove(
		input.PlayerID,
		validatedMove.FENAfter,
		now,
	); err != nil {
		// The player ran out of time before completing the move.
		if errors.Is(err, ErrGameTimeExpired) {
			var result database.MatchResult
			var winnerID uuid.UUID
			var loserID uuid.UUID

			// The player whose clock expired loses the game.
			switch input.PlayerID {
			case state.WhiteID:
				result = database.MatchResultBlack
				winnerID = state.BlackID
				loserID = state.WhiteID

			case state.BlackID:
				result = database.MatchResultWhite
				winnerID = state.WhiteID
				loserID = state.BlackID

			default:
				return MoveResult{}, ErrPlayerNotInMatch
			}

			// We need the match's time control to determine
			// whether this is a bullet, blitz, or rapid rating.
			match, err := s.GetMatch(
				ctx,
				input.MatchID,
			)
			if err != nil {
				return MoveResult{}, err
			}

			ratingType, err := elo.RatingTypeFromTimeControl(
				match.TimeControl,
			)
			if err != nil {
				return MoveResult{}, err
			}

			var eloResult elo.Result

			switch result {
			case database.MatchResultWhite:
				eloResult = elo.ResultWhiteWin

			case database.MatchResultBlack:
				eloResult = elo.ResultBlackWin

			default:
				return MoveResult{}, errors.New(
					"invalid timeout match result",
				)
			}

			// Calculate and persist the new ratings.
			ratings, err := s.EloService.UpdateMatch(
				ctx,
				input.MatchID,
				state.WhiteID,
				state.BlackID,
				ratingType,
				eloResult,
			)
			if err != nil {
				return MoveResult{}, err
			}

			whiteRatingBefore := int(
				math.Round(ratings.WhiteBefore.Value),
			)

			whiteRatingAfter := int(
				math.Round(ratings.WhiteAfter.Value),
			)

			blackRatingBefore := int(
				math.Round(ratings.BlackBefore.Value),
			)

			blackRatingAfter := int(
				math.Round(ratings.BlackAfter.Value),
			)

			// Mark the match as finished and store the new ratings.
			if _, err := s.FinishMatch(
				ctx,
				input.MatchID,
				result,
				&whiteRatingAfter,
				&blackRatingAfter,
			); err != nil {
				return MoveResult{}, err
			}

			// Persist the finished state to Redis.
			if err := s.StateStore.Set(
				ctx,
				state,
			); err != nil {
				return MoveResult{}, err
			}

			return MoveResult{
				MatchID: input.MatchID,

				WhiteID: state.WhiteID,
				BlackID: state.BlackID,

				Finish: &FinishResult{
					Result: result,

					WinnerID: winnerID,
					LoserID:  loserID,

					Reason: "timeout",

					WhiteRatingBefore: whiteRatingBefore,
					WhiteRatingAfter:  whiteRatingAfter,

					BlackRatingBefore: blackRatingBefore,
					BlackRatingAfter:  blackRatingAfter,
				},
			}, nil
		}
	}

	// Get the latest move number so the new move can be stored
	// with the next sequential move number.
	lastMove, err := s.Queries.GetLastMatchMove(
		ctx,
		input.MatchID,
	)

	moveNumber := int32(1)

	if err == nil {
		moveNumber = lastMove.MoveNumber + 1
	} else if !errors.Is(err, sql.ErrNoRows) {
		return MoveResult{}, err
	}

	// Persist the updated authoritative state to Redis.
	if err := s.StateStore.Set(
		ctx,
		state,
	); err != nil {
		return MoveResult{}, err
	}

	// Persist the accepted move to PostgreSQL.
	createdMove, err := s.Queries.CreateMatchMove(
		ctx,
		database.CreateMatchMoveParams{
			MatchID:     input.MatchID,
			MoveNumber:  moveNumber,
			PlayerID:    input.PlayerID,
			San:         validatedMove.SAN,
			Uci:         validatedMove.UCI,
			FenAfter:    validatedMove.FENAfter,
			WhiteTimeMs: state.WhiteTimeMs,
			BlackTimeMs: state.BlackTimeMs,
		},
	)
	if err != nil {
		return MoveResult{}, err
	}

	// Return the authoritative result that will be broadcast
	// to both players through the WebSocket layer.
	return MoveResult{
		MatchID: input.MatchID,

		WhiteID: state.WhiteID,
		BlackID: state.BlackID,

		MoveNumber: int(createdMove.MoveNumber),

		PlayerID: input.PlayerID,

		From:      input.From,
		To:        input.To,
		Promotion: input.Promotion,

		UCI:      validatedMove.UCI,
		SAN:      validatedMove.SAN,
		FENAfter: validatedMove.FENAfter,

		WhiteTimeMs: state.WhiteTimeMs,
		BlackTimeMs: state.BlackTimeMs,
		LastMoveAt:  state.LastMoveAt,
	}, nil
}

func (s *Service) FinishGame(
	ctx context.Context,
	state *State,
	result database.MatchResult,
	reason string,
) (FinishResult, error) {
	if s == nil {
		return FinishResult{}, errors.New("game service is nil")
	}

	if state == nil {
		return FinishResult{}, ErrGameStateNotFound
	}

	if !state.IsActive() {
		return FinishResult{}, ErrGameNotActive
	}

	if s.EloService == nil {
		return FinishResult{}, errors.New(
			"elo service is not initialized",
		)
	}

	if s.StateStore == nil {
		return FinishResult{}, errors.New(
			"game state store is not initialized",
		)
	}

	match, err := s.GetMatch(
		ctx,
		state.MatchID,
	)
	if err != nil {
		return FinishResult{}, err
	}

	ratingType, err := elo.RatingTypeFromTimeControl(
		match.TimeControl,
	)
	if err != nil {
		return FinishResult{}, err
	}

	var eloResult elo.Result

	switch result {
	case database.MatchResultWhite:
		eloResult = elo.ResultWhiteWin

	case database.MatchResultBlack:
		eloResult = elo.ResultBlackWin

	case database.MatchResultDraw:
		eloResult = elo.ResultDraw

	default:
		return FinishResult{}, errors.New(
			"invalid game finish result",
		)
	}

	ratings, err := s.EloService.UpdateMatch(
		ctx,
		state.MatchID,
		state.WhiteID,
		state.BlackID,
		ratingType,
		eloResult,
	)
	if err != nil {
		return FinishResult{}, err
	}

	whiteRatingBefore := int(
		math.Round(ratings.WhiteBefore.Value),
	)

	whiteRatingAfter := int(
		math.Round(ratings.WhiteAfter.Value),
	)

	blackRatingBefore := int(
		math.Round(ratings.BlackBefore.Value),
	)

	blackRatingAfter := int(
		math.Round(ratings.BlackAfter.Value),
	)

	if _, err := s.FinishMatch(
		ctx,
		state.MatchID,
		result,
		&whiteRatingAfter,
		&blackRatingAfter,
	); err != nil {
		return FinishResult{}, err
	}

	state.Finish()

	if err := s.StateStore.Set(
		ctx,
		state,
	); err != nil {
		return FinishResult{}, err
	}

	var winnerID uuid.UUID
	var loserID uuid.UUID

	switch result {
	case database.MatchResultWhite:
		winnerID = state.WhiteID
		loserID = state.BlackID

	case database.MatchResultBlack:
		winnerID = state.BlackID
		loserID = state.WhiteID
	}

	return FinishResult{
		Result: result,

		WinnerID: winnerID,
		LoserID:  loserID,

		Reason: reason,

		WhiteRatingBefore: whiteRatingBefore,
		WhiteRatingAfter:  whiteRatingAfter,

		BlackRatingBefore: blackRatingBefore,
		BlackRatingAfter:  blackRatingAfter,
	}, nil
}

func (s *Service) Resign(
	ctx context.Context,
	matchID uuid.UUID,
	playerID uuid.UUID,
) (FinishResult, error) {
	if s == nil {
		return FinishResult{}, errors.New(
			"game service is null",
		)
	}

	if s.GameLock == nil {
		return FinishResult{}, errors.New(
			"game lock is not initialized",
		)
	}

	if s.StateStore == nil {
		return FinishResult{}, errors.New(
			"game state store is not initialized",
		)
	}

	release, err := s.GameLock.Acquire(
		ctx,
		matchID,
	)

	if err != nil {
		return FinishResult{}, err
	}
	defer release()

	state, err := s.StateStore.Get(
		ctx,
		matchID,
	)
	if err != nil {
		return FinishResult{}, err
	}

	if !state.IsActive() {
		return FinishResult{}, ErrGameNotActive
	}

	if state.WhiteID != playerID &&
		state.BlackID != playerID {
		return FinishResult{}, ErrPlayerNotInMatch
	}

	var result database.MatchResult

	switch playerID {
	case state.WhiteID:
		result = database.MatchResultBlack

	case state.BlackID:
		result = database.MatchResultWhite

	default:
		return FinishResult{}, ErrPlayerNotInMatch
	}

	return s.FinishGame(
		ctx,
		state,
		result,
		"resignation",
	)

}

func (s *Service) OfferDraw(
	ctx context.Context,
	matchID uuid.UUID,
	playerID uuid.UUID,
) error {
	if s == nil {
		return errors.New("game service is nil")
	}

	if s.GameLock == nil {
		return errors.New("game lock is not initialized")
	}

	if s.StateStore == nil {
		return errors.New("game state store is not initialized")
	}

	release, err := s.GameLock.Acquire(
		ctx,
		matchID,
	)
	if err != nil {
		return err
	}

	defer release()

	state, err := s.StateStore.Get(
		ctx,
		matchID,
	)
	if err != nil {
		return err
	}

	if !state.IsActive() {
		return ErrGameNotActive
	}

	if err := state.OfferDraw(playerID); err != nil {
		return err
	}

	return s.StateStore.Set(
		ctx,
		state,
	)
}

func (s *Service) AccepDraw(
	ctx context.Context,
	matchID uuid.UUID,
	playerID uuid.UUID,
) (FinishResult, error) {
	if s == nil {
		return FinishResult{}, errors.New("game service is nil")
	}
	if s.GameLock == nil {
		return FinishResult{}, errors.New(
			"game lock is not initialized",
		)
	}

	if s.StateStore == nil {
		return FinishResult{}, errors.New(
			"game state store is not initialized",
		)
	}

	release, err := s.GameLock.Acquire(
		ctx,
		matchID,
	)
	if err != nil {
		return FinishResult{}, err
	}
	defer release()

	state, err := s.StateStore.Get(
		ctx,
		matchID,
	)

	if err != nil {
		return FinishResult{}, err
	}
	if !state.IsActive() {
		return FinishResult{}, ErrGameNotActive
	}

	if err := state.AcceptDraw(playerID); err != nil {
		return FinishResult{}, err
	}

	return s.FinishGame(
		ctx,
		state,
		database.MatchResultDraw,
		"agreement",
	)
}

func (s *Service) RejectDraw(
	ctx context.Context,
	matchID uuid.UUID,
	playerID uuid.UUID,
) error {
	if s == nil {
		return errors.New("game service is nil")
	}

	if s.GameLock == nil {
		return errors.New("game lock is not initialized")
	}

	if s.StateStore == nil {
		return errors.New("game state store is not initialized")
	}

	release, err := s.GameLock.Acquire(
		ctx,
		matchID,
	)
	if err != nil {
		return err
	}
	defer release()

	state, err := s.StateStore.Get(
		ctx,
		matchID,
	)

	if err != nil {
		return err
	}

	if !state.IsActive(){
		return ErrGameNotActive
	}

	if err := state.CancelDrawOffer(playerID); err != nil {
		return err
	}
	return s.StateStore.Set(
		ctx,
		state,
	)
}

// parseTimeControl converts a chess time control such as "10+5"
// into initial time and increment values in milliseconds.
//
// Examples:
//   - 10+0 -> 600000 ms initial time, 0 ms increment
//   - 5+3  -> 300000 ms initial time, 3000 ms increment
func parseTimeControl(
	timeControl string,
) (int64, int64, error) {
	parts := strings.Split(timeControl, "+")
	if len(parts) != 2 {
		return 0, 0, errors.New(
			"invalid time control",
		)
	}

	minutes, err := strconv.ParseInt(
		parts[0],
		10,
		64,
	)
	if err != nil || minutes <= 0 {
		return 0, 0, errors.New(
			"invalid base time",
		)
	}

	increment, err := strconv.ParseInt(
		parts[1],
		10,
		64,
	)
	if err != nil || increment < 0 {
		return 0, 0, errors.New(
			"invalid increment",
		)
	}

	initialTimeMs := minutes * 60 * 1000
	incrementMs := increment * 1000

	return initialTimeMs, incrementMs, nil
}
