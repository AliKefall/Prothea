package endpoints

import (
	"net/http"

	"github.com/AliKefall/prothea/internal/utils"
	"github.com/google/uuid"
)

func (deps *Deps) DequeueHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	userID := ctx.Value(UserIDKey).(uuid.UUID)
	if userID == uuid.Nil {
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
		utils.RespondWithError(w, http.StatusBadRequest, "dequeue_error", "Json body could not be parsed", "", err)
		return
	}

	deps.Matchmaking.DequeuePlayer(ctx, userID, req.TimeControl)

	utils.RespondWithJSON(w, http.StatusOK, map[string]string{
		"message": "Dequeue successful",
	})
}
