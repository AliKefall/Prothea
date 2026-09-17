package endpoints

import (
	"net/http"
	"time"

	"github.com/AliKefall/prothea/internal/database"
	"github.com/AliKefall/prothea/internal/utils"
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
	MatchID      uuid.UUID                    `json:"match_id"`
	Opponent     RecentMatchOpponentResponse `json:"opponent"`
	Result       RecentMatchResult            `json:"result"`
	TimeControl  string                       `json:"time_control"`
	RatingBefore int32                        `json:"rating_before"`
	RatingAfter  int32                        `json:"rating_after"`
	PlayedAt     time.Time                    `json:"played_at"`
}

type CurrentUserProfileResponse struct {
	UserID        uuid.UUID             `json:"user_id"`
	Username      string                `json:"username"`
	Email         string                `json:"email"`
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

	user, err := deps.Queries.GetUserByID(
		r.Context(),
		userID,
	)
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

	ratings, err := deps.Queries.GetPlayerRatings(
		r.Context(),
		userID,
	)
	if err != nil {
		utils.RespondWithError(
			w,
			http.StatusInternalServerError,
			"database_error",
			"Could not load player ratings",
			"",
			err,
		)
		return
	}

	matches, err := deps.Queries.GetPlayerRecentMatches(
		r.Context(),
		database.GetPlayerRecentMatchesParams{
			WhiteID: userID,
			Limit:   10,
		},
	)
	if err != nil {
		utils.RespondWithError(
			w,
			http.StatusInternalServerError,
			"database_error",
			"Could not load recent matches",
			"",
			err,
		)
		return
	}

	response := CurrentUserProfileResponse{
		UserID:   user.ID,
		Username: user.Username,
		Email:    user.Email,
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
		var opponent RecentMatchOpponentResponse
		var ratingBefore int32
		var ratingAfter int32
		var result RecentMatchResult

		if match.WhiteID == userID {
			opponent = RecentMatchOpponentResponse{
				ID:       match.BlackID,
				Username: match.BlackUsername,
			}

			ratingBefore = match.WhiteRatingBefore

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
				RatingBefore: ratingBefore,
				RatingAfter:  ratingAfter,
				PlayedAt:      playedAt,
			},
		)
	}

	utils.RespondWithJSON(
		w,
		http.StatusOK,
		response,
	)
}

