package endpoints

import (
	"database/sql"
	"errors"
	"net/http"
	"time"

	"github.com/AliKefall/prothea/internal/database"
	"github.com/AliKefall/prothea/internal/matchmaking"
	"github.com/AliKefall/prothea/internal/utils"
	"github.com/google/uuid"
)

func (deps *Deps) EnqueueHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req struct {
		TimeControl string `json:"time_control"`
	}

	if err := utils.DecodeJSON(w, r, &req); err != nil {
		utils.RespondWithError(
			w,
			http.StatusBadRequest,
			"enqueue error",
			"Invalid request body",
			"",
			err,
		)
		return
	}

	if req.TimeControl == "" {
		utils.RespondWithError(
			w,
			http.StatusBadRequest,
			"enqueue_error",
			"missing time control parameter",
			"",
			nil,
		)
		return
	}

	timeControl, err := matchmaking.GetTimeControl(req.TimeControl)
	if err != nil {
		utils.RespondWithError(
			w,
			http.StatusBadRequest,
			"enqueue_error",
			"unsupported time control",
			"",
			err,
		)
		return
	}

	userID := ctx.Value(UserIDKey).(uuid.UUID)
	if userID == uuid.Nil {
		utils.RespondWithError(
			w,
			http.StatusUnauthorized,
			"context_error",
			"missing context key",
			"",
			nil,
		)
		return
	}

	user, err := deps.Queries.GetUserByID(ctx, userID)
	if err != nil {
		utils.RespondWithError(w, http.StatusNotFound, "database_error", "user not found", "", nil)
		return
	}

	ratingValue := int32(matchmaking.DefaultRating)
	ratingRow, err := deps.Queries.GetPlayerRating(
		ctx,
		database.GetPlayerRatingParams{
			UserID:     user.ID,
			RatingType: database.RatingType(timeControl.RatingType),
		},
	)
	if err == nil {
		ratingValue = int32(ratingRow.Rating)
	} else if !errors.Is(err, sql.ErrNoRows) {
		utils.RespondWithError(w, http.StatusInternalServerError, "database_error", "rating could not be loaded", "", err)
		return
	}

	entry := matchmaking.QueueEntry{
		UserID:      user.ID,
		Username:    user.Username,
		Rating:      int(ratingValue),
		TimeControl: req.TimeControl,
		JoinedAt:    time.Now().UTC(),
	}

	if err := deps.Matchmaking.EnqueuePlayer(ctx, entry); err != nil {
		utils.RespondWithError(
			w,
			http.StatusBadRequest,
			"enqueue_error",
			err.Error(),
			"",
			err,
		)
		return
	}

	utils.RespondWithJSON(w, http.StatusOK, map[string]string{
		"message": "Player in queue",
	})

}
