package websocket

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"time"

	"github.com/gorilla/websocket"
)

const (
	maxMessageSize = 16 * 1024

	pongWait = 75 * time.Second

	pingPeriod = 25 * time.Second

	writeWait = 10 * time.Second

	sendBufferSize = 256
)

type Client struct {
	Conn *websocket.Conn

	Hub *Hub

	UserID string

	Username string

	Send chan []byte

	ctx context.Context

	cancel context.CancelFunc
}

func NewClient(
	conn *websocket.Conn,
	hub *Hub,
	userID string,
	username string,
) *Client {

	ctx, cancel := context.WithCancel(context.Background())

	return &Client{
		Conn: conn,

		Hub: hub,

		UserID: userID,

		Username: username,

		Send: make(chan []byte, sendBufferSize),

		ctx: ctx,

		cancel: cancel,
	}
}

func (c *Client) Close() {

	c.cancel()

	if err := c.Conn.Close(); err != nil {

		slog.Error(
			"failed to close websocket connection",
			slog.Any("error", err),
		)
	}
}

func (c *Client) ReadPump() {

	defer func() {

		if c.Hub != nil {
			c.Hub.unregister <- c
		}

		c.Close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)

	c.Conn.SetReadDeadline(time.Now().Add(pongWait))

	c.Conn.SetPongHandler(func(string) error {

		return c.Conn.SetReadDeadline(
			time.Now().Add(pongWait),
		)
	})

	for {

		select {

		case <-c.ctx.Done():
			return

		default:
		}

		var event Event

		if err := c.Conn.ReadJSON(&event); err != nil {

			if websocket.IsUnexpectedCloseError(
				err,
				websocket.CloseGoingAway,
				websocket.CloseAbnormalClosure,
			) {

				slog.Error(
					"websocket read error",
					slog.String("component", "websocket"),
					slog.String("user", c.Username),
					slog.String("user_id", c.UserID),
					slog.Any("error", err),
				)
			}

			return
		}

		c.Hub.inbound <- inbound{
			client: c,
			event:  event,
		}
	}
}

func (c *Client) WritePump() {

	ticker := time.NewTicker(pingPeriod)

	defer func() {

		ticker.Stop()

		c.Close()
	}()

	for {

		select {

		case <-c.ctx.Done():
			return

		case payload, ok := <-c.Send:

			_ = c.Conn.SetWriteDeadline(
				time.Now().Add(writeWait),
			)

			if !ok {

				_ = c.Conn.WriteMessage(
					websocket.CloseMessage,
					nil,
				)

				return
			}

			if err := c.Conn.WriteMessage(
				websocket.TextMessage,
				payload,
			); err != nil {
				slog.Error(
					"websocket write error",
					slog.String("component", "websocket"),
					slog.String("user", c.Username),
					slog.String("user_id", c.UserID),
					slog.Any("error", err),
				)
				return
			}

		case <-ticker.C:

			_ = c.Conn.SetWriteDeadline(
				time.Now().Add(writeWait),
			)

			if err := c.Conn.WriteMessage(
				websocket.PingMessage,
				nil,
			); err != nil {
				slog.Error(
					"websocket ping error",
					slog.String("component", "websocket"),
					slog.String("user", c.Username),
					slog.String("user_id", c.UserID),
					slog.Any("error", err),
				)
				return
			}
		}
	}
}

func (c *Client) SendEvent(event Event) error {

	data, err := json.Marshal(event)
	if err != nil {
		return err
	}

	return c.SendRaw(data)
}

func (c *Client) SendRaw(data []byte) error {

	select {

	case c.Send <- data:
		return nil

	default:
		return errors.New("client send buffer full")
	}
}
