package matchmaking

import (
	"fmt"
	"strconv"
	"time"

	"github.com/google/uuid"
)

func ttl(value time.Duration) time.Duration {
	if value <= 0 {
		return DefaultQueueTTL
	}
	return value
}

func queueKey(timeControl string) string {
	if timeControl == "" {
		timeControl = "10+0"
	}
	return "matchmaking:queue:" + timeControl
}

func userKey(userID uuid.UUID) string {
	return "matchmaking:user:" + userID.String()
}

// This is kinda bad code. But it gets the job done for now
// NOTE: Change this in production
func parseLuaString(value any) string {
	switch v := value.(type) {
	case string:
		return v
	case []byte:
		return string(v)
	default:
		return fmt.Sprint(v)
	}
}

func parseLuaInt(value any) (int, error) {
	switch v := value.(type) {
	case int:
		return v, nil
	case []byte:
		return strconv.Atoi(string(v))
	case string:
		return strconv.Atoi(v)
	case int64:
		return int(v), nil
	default:
		return 0, fmt.Errorf("unsupported integer value %T", value)
	}

}
