package endpoints

import (
	"errors"
	"net/http"

	"github.com/AliKefall/prothea/internal/game"
	"github.com/AliKefall/prothea/internal/utils"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func (deps *Deps) GetMatchMovesHandler(
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

	// First verify that the user belongs to the match.
	_, err = deps.Game.GetMatchForPlayer(
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
			"Failed to verify match",
			"",
			err,
		)
		return
	}

	moves, err := deps.Game.GetMatchMoves(
		ctx,
		matchID,
	)
	if err != nil {
		utils.RespondWithError(
			w,
			http.StatusInternalServerError,
			"match_moves_error",
			"Failed to get match moves",
			"",
			err,
		)
		return
	}

	utils.RespondWithJSON(
		w,
		http.StatusOK,
		moves,
	)
}
