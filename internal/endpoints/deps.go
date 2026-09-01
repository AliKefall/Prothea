package endpoints

import (
	"database/sql"
	"net/http"

	"github.com/AliKefall/prothea/internal/auth"
	"github.com/AliKefall/prothea/internal/chat"
	"github.com/AliKefall/prothea/internal/database"
	"github.com/AliKefall/prothea/internal/friends"
	"github.com/AliKefall/prothea/internal/matchmaking"
	"github.com/AliKefall/prothea/internal/websocket"
	"github.com/redis/go-redis/v9"
)

type Deps struct {
	DB          *sql.DB
	Queries     *database.Queries
	RedisClient *redis.Client
	Hasher      *auth.PasswordHasher
	JWT         *auth.JWTManager
	Friends     *friends.Service
	Matchmaking *matchmaking.Service
	Hub         *websocket.Hub
	Chat        *chat.Service
}

func (deps *Deps) MustUserIDString(r *http.Request) (string, error) {
	userID, err := deps.mustUserID(r)
	if err != nil {
		return "", err
	}
	return userID.String(), nil
}
