package matchmaking

import (
	"embed"
	"errors"
	"time"

	"github.com/redis/go-redis/v9"
)

var (
	//go:embed lua/*.lua
	luaScripts embed.FS

	ErrAlreadyQueued = errors.New("player is aldready queued")
	ErrNotQueued     = errors.New("player is not queued")
)

const (
	DefaultQueueTTL       = 5 * time.Minute
	DefaultPollInterval   = time.Second
	DefaultRatingWindow   = 25
	DefaultWindowGrowth   = 25
	DefaultMaxWindow      = 500
	DefaultMatchBatchSize = 25
	DefaultRating         = 1500
)

type Service struct {
	Redis        redis.Cmdable
	QueueTTL     time.Duration
	RatingWindow int
	WindowGrowth int
	MaxWindow    int
}

func NewMatchmakingService(redisClient redis.Cmdable) *Service {
	return &Service{
		Redis:        redisClient,
		QueueTTL:     DefaultQueueTTL,
		RatingWindow: DefaultRatingWindow,
		WindowGrowth: DefaultWindowGrowth,
		MaxWindow:    DefaultMaxWindow,
	}
}
