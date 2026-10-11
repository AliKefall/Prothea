package endpoints

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/AliKefall/prothea/internal/database"
	"github.com/AliKefall/prothea/internal/elo"
	"github.com/AliKefall/prothea/internal/utils"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type PlayerRatingResponse struct {
	Rating      float64 `json:"rating"`
	GamesPlayed int32   `json:"games_played"`
}

type PlayerRatingsResponse struct {
	Bullet PlayerRatingResponse `json:"bullet"`
	Blitz  PlayerRatingResponse `json:"blitz"`
	Rapid  PlayerRatingResponse `json:"rapid"`
}

type RecentMatchOpponentResponse struct {
	ID       uuid.UUID `json:"id"`
	Username string    `json:"username"`
}

type RecentMatchResult string

const (
	RecentMatchWin       RecentMatchResult = "win"
	RecentMatchLoss      RecentMatchResult = "loss"
	RecentMatchDraw      RecentMatchResult = "draw"
	RecentMatchAbandoned RecentMatchResult = "abandoned"
)

type RecentMatchResponse struct {
	MatchID      uuid.UUID                   `json:"match_id"`
	Opponent     RecentMatchOpponentResponse `json:"opponent"`
	Result       RecentMatchResult           `json:"result"`
	TimeControl  string                      `json:"time_control"`
	RatingType   string                      `json:"rating_type"`
	RatingBefore int32                       `json:"rating_before"`
	RatingAfter  int32                       `json:"rating_after"`
	PlayedAt     time.Time                   `json:"played_at"`
}

type CurrentUserProfileResponse struct {
	UserID        uuid.UUID             `json:"user_id"`
	Username      string                `json:"username"`
	Ratings       PlayerRatingsResponse `json:"ratings"`
	RecentMatches []RecentMatchResponse `json:"recent_matches"`
}

func (deps *Deps) ProfileHandler(w http.ResponseWriter, r *http.Request) {
	value := r.Context().Value(UserIDKey)

	userID, ok := value.(uuid.UUID)
	if !ok {
		utils.RespondWithError(
			w,
			http.StatusUnauthorized,
			"unauthorized",
			"Unauthorized",
			"",
			nil,
		)
		return
	}

	user, err := deps.Queries.GetUserByID(r.Context(), userID)
	if err != nil {
		utils.RespondWithError(
			w,
			http.StatusInternalServerError,
			"database_error",
			"Could not load user",
			"",
			err,
		)
		return
	}

	response, err := deps.loadProfileResponse(r.Context(), user)
	if err != nil {
		utils.RespondWithError(
			w,
			http.StatusInternalServerError,
			"database_error",
			err.Error(),
			"",
			err,
		)
		return
	}
	utils.RespondWithJSON(w, http.StatusOK, response)
}

func (deps *Deps) PlayerProfileHandler(w http.ResponseWriter, r *http.Request) {
	username := strings.TrimSpace(chi.URLParam(r, "username"))
	if username == "" {
		utils.RespondWithError(w, http.StatusBadRequest, "validation_error", "Username is required", "", nil)
		return
	}

	user, err := deps.Queries.GetUserByUsername(r.Context(), username)
	if err != nil {
		if err == sql.ErrNoRows {
			utils.RespondWithError(w, http.StatusNotFound, "not_found", "Player not found", "", nil)
			return
		}
		utils.RespondWithError(w, http.StatusInternalServerError, "database_error", "Could not load player", "", err)
		return
	}

	response, err := deps.loadProfileResponse(r.Context(), user)
	if err != nil {
		utils.RespondWithError(w, http.StatusInternalServerError, "database_error", err.Error(), "", err)
		return
	}
	utils.RespondWithJSON(w, http.StatusOK, response)
}

type PlayerSearchResult struct {
	UserID   uuid.UUID `json:"user_id"`
	Username string    `json:"username"`
}

type PlayerSearchResponse struct {
	Players []PlayerSearchResult `json:"players"`
}

func (deps *Deps) SearchPlayersHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(UserIDKey).(uuid.UUID)
	if !ok {
		utils.RespondWithError(w, http.StatusUnauthorized, "unauthorized", "Unauthorized", "", nil)
		return
	}
	query := strings.TrimSpace(r.URL.Query().Get("q"))
	response := PlayerSearchResponse{Players: make([]PlayerSearchResult, 0)}
	if len([]rune(query)) < 2 {
		utils.RespondWithJSON(w, http.StatusOK, response)
		return
	}
	players, err := deps.Queries.SearchPlayers(r.Context(), database.SearchPlayersParams{
		Query: query, ExcludeUserID: userID, Limit: 10,
	})
	if err != nil {
		utils.RespondWithError(w, http.StatusInternalServerError, "database_error", "Could not search players", "", err)
		return
	}
	for _, player := range players {
		response.Players = append(response.Players, PlayerSearchResult{UserID: player.ID, Username: player.Username})
	}
	utils.RespondWithJSON(w, http.StatusOK, response)
}

func (deps *Deps) loadProfileResponse(ctx context.Context, user database.User) (CurrentUserProfileResponse, error) {
	ratings, err := deps.Queries.GetPlayerRatings(ctx, user.ID)
	if err != nil {
		return CurrentUserProfileResponse{}, errors.New("Could not load player ratings")
	}
	matches, err := deps.Queries.GetPlayerRecentMatches(ctx, user.ID)
	if err != nil {
		return CurrentUserProfileResponse{}, errors.New("Could not load recent matches")
	}

	response := CurrentUserProfileResponse{
		UserID:   user.ID,
		Username: user.Username,
		Ratings: PlayerRatingsResponse{
			Bullet: PlayerRatingResponse{},
			Blitz:  PlayerRatingResponse{},
			Rapid:  PlayerRatingResponse{},
		},
		RecentMatches: make([]RecentMatchResponse, 0, len(matches)),
	}

	for _, rating := range ratings {
		item := PlayerRatingResponse{
			Rating:      rating.Rating,
			GamesPlayed: rating.GamesPlayed,
		}

		switch rating.RatingType {
		case database.RatingTypeBullet:
			response.Ratings.Bullet = item

		case database.RatingTypeBlitz:
			response.Ratings.Blitz = item

		case database.RatingTypeRapid:
			response.Ratings.Rapid = item
		}
	}

	for _, match := range matches {
		ratingType, _ := elo.RatingTypeFromTimeControl(match.TimeControl)
		var opponent RecentMatchOpponentResponse
		var ratingBefore int32
		var ratingAfter int32
		var result RecentMatchResult

		if match.WhiteID == user.ID {
			opponent = RecentMatchOpponentResponse{
				ID:       match.BlackID,
				Username: match.BlackUsername,
			}

			ratingBefore = match.WhiteRatingBefore
			ratingAfter = ratingBefore

			if match.WhiteRatingAfter.Valid {
				ratingAfter = match.WhiteRatingAfter.Int32
			}

			switch match.Result {
			case database.MatchResultWhite:
				result = RecentMatchWin

			case database.MatchResultBlack:
				result = RecentMatchLoss

			case database.MatchResultDraw:
				result = RecentMatchDraw

			case database.MatchResultAbandoned:
				result = RecentMatchAbandoned
			}
		} else {
			opponent = RecentMatchOpponentResponse{
				ID:       match.WhiteID,
				Username: match.WhiteUsername,
			}

			ratingBefore = match.BlackRatingBefore
			ratingAfter = ratingBefore

			if match.BlackRatingAfter.Valid {
				ratingAfter = match.BlackRatingAfter.Int32
			}

			switch match.Result {
			case database.MatchResultBlack:
				result = RecentMatchWin

			case database.MatchResultWhite:
				result = RecentMatchLoss

			case database.MatchResultDraw:
				result = RecentMatchDraw

			case database.MatchResultAbandoned:
				result = RecentMatchAbandoned
			}
		}

		var playedAt time.Time

		if match.FinishedAt.Valid {
			playedAt = match.FinishedAt.Time
		}

		response.RecentMatches = append(
			response.RecentMatches,
			RecentMatchResponse{
				MatchID:      match.ID,
				Opponent:     opponent,
				Result:       result,
				TimeControl:  match.TimeControl,
				RatingType:   string(ratingType),
				RatingBefore: ratingBefore,
				RatingAfter:  ratingAfter,
				PlayedAt:     playedAt,
			},
		)
	}

	return response, nil
}
