package endpoints

import (
	"database/sql"

	"github.com/AliKefall/prothea/internal/auth"
	"github.com/AliKefall/prothea/internal/database"
	"github.com/AliKefall/prothea/internal/friends"
	"github.com/redis/go-redis/v9"
)

type Deps struct {
	DB *sql.DB
	Queries     *database.Queries
	RedisClient *redis.Client
	Hasher      *auth.PasswordHasher
	JWT         *auth.JWTManager
	Friends *friends.Service
}
