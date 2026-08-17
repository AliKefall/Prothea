package websocket

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type EventType string

type Event struct {
	ID        string          `json:"id,omitempty"`
	Type      string          `json:"type"`
	Payload   json.RawMessage `json:"payload"`
	CreatedAt time.Time       `json:"created_at"`
}

type EventHandler func(
	context.Context,
	*Client,
	Event,
) error

func NewEvent(event EventType, payload any) (Event, error) {
	raw, err := json.Marshal(payload)
	if err != nil {
		return Event{}, err
	}

	return Event{
		ID:        uuid.NewString(),
		Type:      string(event),
		Payload:   raw,
		CreatedAt: time.Now().UTC(),
	}, nil

}
