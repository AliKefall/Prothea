package websocket

import (
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

	delete(h.clients, client)

	h.active.Add(-1)
}


