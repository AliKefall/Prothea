package matchmaking

import (
	"time"

	"github.com/google/uuid"
)

type QueueEntry struct {
	UserID      uuid.UUID `json:"user_id"`
	Username    string    `json:"username"`
	Rating      int       `json:"rating"`
	TimeControl string    `json:"time_control"`
	JoinedAt    time.Time `json:"joined_at"`
}

type MatchFound struct{
	ID uuid.UUID `json:"id"`
	WhiteUsername string `json:"white_username"`
	WhiteID uuid.UUID `json:"white_id"`
	BlackUsername string `json:"black_username"`
	BlackID uuid.UUID `json:"black_id"`
	WhiteRating int `json:"white_rating"`
	BlackRating int `json:"black_rating"`
	TimeControl string `json:"time_control"`
	CreatedAt time.Time `json:"created_at"`
}
