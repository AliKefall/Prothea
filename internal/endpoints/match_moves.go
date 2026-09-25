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

// In the earlier version of this endpoint I took the data from
// database.MatchMove struct which is kinda irrelevant with the frontends
// expectations if send like that it converts the data as pascal case
// which is not how we work. So this struct here to convert the json data
// nothing more.
type MatchMovesResponse struct {
	ID          int64  `json:"id"`
	MatchID     string `json:"match_id"`
	MoveNumber  int    `json:"move_number"`
	PlayerID    string `json:"player_id"`
	SAN         string `json:"san"`
	UCI         string `json:"uci"`
	FENAfter    string `json:"fen_after"`
	WhiteTimeMs int64  `json:"white_time_ms"`
	BlackTimeMs int64  `json:"black_time_ms"`
	CreatedAt   string `json:"created_at"`
}

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

	response := make([]MatchMovesResponse, 0, len(moves))

	for _, move := range moves {
		response = append(response, MatchMovesResponse{
			ID: move.ID,
			MatchID: matchID.String(),
			MoveNumber: int(move.MoveNumber),
			PlayerID: move.PlayerID.String(),
			SAN: move.San,
			UCI: move.Uci,
			FENAfter: move.FenAfter,
			WhiteTimeMs: move.WhiteTimeMs,
			BlackTimeMs: move.BlackTimeMs,
			CreatedAt: move.CreatedAt.Format(time.RFC3339Nano),
		})
	}

	utils.RespondWithJSON(
		w,
		http.StatusOK,
		response,
	)

}
