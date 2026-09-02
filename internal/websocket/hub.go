package websocket

import (
	"fmt"
	"log/slog"
	"sync"
	"sync/atomic"
)

type inbound struct {
	client *Client
	event  Event
}

type Hub struct {
	mu sync.RWMutex

	clients map[*Client]struct{}

	register chan *Client

	unregister chan *Client

	inbound chan inbound

	events map[EventType]EventHandler

	active atomic.Int64
}

func NewHub() *Hub {

	h := &Hub{

		clients: make(map[*Client]struct{}),

		register: make(chan *Client, 256),

		unregister: make(chan *Client, 256),

		inbound: make(chan inbound, 1024),

		events: make(map[EventType]EventHandler),
	}

	return h
}

func (h *Hub) Register(
	event EventType,
	handler EventHandler,
) {
	h.events[event] = handler
}

func (h *Hub) registerClient(
	client *Client,
) {
	h.mu.Lock()
	defer h.mu.Unlock()

	h.clients[client] = struct{}{}

	h.active.Add(1)
}

func (h *Hub) unregisterClient(
	client *Client,
) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if _, ok := h.clients[client]; !ok {
		return
	}

	delete(h.clients, client)
	h.active.Add(-1)
}

// If user  have more than one websocket connection this one sends this to every last one of them
// Absolutely unnecessary right now I am still testing this and gonna need it soon enough.
func (h *Hub) SendToUser(
	userID string,
	event Event,
) error {
	h.mu.RLock()
	defer h.mu.RUnlock()

	found := false

	for client := range h.clients {
		if client.UserID != userID {
			continue
		}

		found = true

		slog.Info(
			"sending websocket event",
			"user_id", userID,
			"event_type", event.Type,
		)

		if err := client.SendEvent(event); err != nil {
			slog.Error(
				"failed to send websocket event",
				"user_id", userID,
				"event_type", event.Type,
				"error", err,
			)

			return err
		}

		slog.Info(
			"websocket event sent",
			"user_id", userID,
			"event_type", event.Type,
		)
	}

	if !found {
		return fmt.Errorf("user %s is not connected", userID)
	}

	return nil
}
