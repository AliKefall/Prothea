package endpoints

import (
	"errors"
	"net/http"

	"github.com/AliKefall/prothea/internal/matchmaking"
	"github.com/AliKefall/prothea/internal/utils"
	"github.com/google/uuid"
)

func (deps *Deps) DequeueHandler(w http.ResponseWriter, r *http.Request) {
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

	var req struct {
		TimeControl string `json:"time_control"`
	}

	if err := utils.DecodeJSON(w, r, &req); err != nil {
		utils.RespondWithError(
			w,
			http.StatusBadRequest,
			"dequeue_error",
			"JSON body could not be parsed",
			"",
			err,
		)
		return
	}

	if req.TimeControl == "" {
		utils.RespondWithError(
			w,
			http.StatusBadRequest,
			"dequeue_error",
			"Time control is required",
			"",
			nil,
		)
		return
	}

	err := deps.Matchmaking.DequeuePlayer(
		ctx,
		userID,
		req.TimeControl,
	)

	if err != nil {
		if errors.Is(err, matchmaking.ErrNotQueued) {
			utils.RespondWithError(
				w,
				http.StatusNotFound,
				"dequeue_error",
				"Player is not in the matchmaking queue",
				"",
				err,
			)
			return
		}

		utils.RespondWithError(
			w,
			http.StatusInternalServerError,
			"dequeue_error",
			"Failed to dequeue player",
			"",
			err,
		)
		return
	}

	utils.RespondWithJSON(w, http.StatusOK, map[string]string{
		"message": "Dequeue successful",
	})
}
