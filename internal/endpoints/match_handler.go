package endpoints

import (
	"errors"
	"net/http"
	"time"

	"github.com/AliKefall/prothea/internal/game"
	"github.com/AliKefall/prothea/internal/utils"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type MatchResponse struct {
	ID string `json:"id"`

	WhiteID       string `json:"white_id"`
	WhiteUsername string `json:"white_username"`
	WhiteRating   int32  `json:"white_rating"`

	BlackID       string `json:"black_id"`
	BlackUsername string `json:"black_username"`
	BlackRating   int32  `json:"black_rating"`

	TimeControl string `json:"time_control"`

	Result string `json:"result"`

	CreatedAt  string  `json:"created_at"`
	FinishedAt *string `json:"finished_at,omitempty"`
}

func (deps *Deps) GetMatchHandler(
	w http.ResponseWriter,
	r *http.Request,
) {
	ctx := r.Context()

	userIDValue := ctx.Value(UserIDKey)

	userID, ok := userIDValue.(uuid.UUID)
	if !ok || userID == uuid.Nil {
		utils.RespondWithError(
			w,
			http.StatusUnauthorized,
			"context_error",
			"Missing user id",
			"",
			nil,
		)
		return
	}

	matchID, err := uuid.Parse(
		chi.URLParam(r, "matchId"),
	)
	if err != nil {
		utils.RespondWithError(
			w,
			http.StatusBadRequest,
			"match_error",
			"Invalid match id",
			"",
			err,
		)
		return
	}

	match, err := deps.Game.GetMatchDetailsForPlayer(
		ctx,
		matchID,
		userID,
	)
	if err != nil {
		if errors.Is(err, game.ErrMatchNotFound) {
			utils.RespondWithError(
				w,
				http.StatusNotFound,
				"match_not_found",
				"Match not found",
				"",
				nil,
			)
			return
		}

		utils.RespondWithError(
			w,
			http.StatusInternalServerError,
			"match_error",
			"Failed to get match",
			"",
			err,
		)
		return
	}

	response := MatchResponse{
		ID: match.ID.String(),

		WhiteID:       match.WhiteID.String(),
		WhiteUsername: match.WhiteUsername,
		WhiteRating:   match.WhiteRatingBefore,

		BlackID:       match.BlackID.String(),
		BlackUsername: match.BlackUsername,
		BlackRating:   match.BlackRatingBefore,

		TimeControl: match.TimeControl,

		Result: string(match.Result),

		CreatedAt: match.CreatedAt.Format(time.RFC3339),
	}

	if match.FinishedAt.Valid {
		finishedAt := match.FinishedAt.Time.Format(time.RFC3339)
		response.FinishedAt = &finishedAt
	}

	utils.RespondWithJSON(
		w,
		http.StatusOK,
		response,
	)
}
