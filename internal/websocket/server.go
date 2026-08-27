package websocket

import (
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/AliKefall/prothea/internal/utils"
	"github.com/gorilla/websocket"
)

var (
	allowedOrigins = make(map[string]struct{})
)

func init() {
	for origin := range strings.SplitSeq(os.Getenv("WS_ALLOWED_ORIGINS"), ",") {
		origin = strings.TrimSpace(origin)
		if origin != "" {
			allowedOrigins[origin] = struct{}{}
		}

	}
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")

		if os.Getenv("APP_ENV") == "development" {
			return true
		}

		_, ok := allowedOrigins[origin]
		return ok
	},
}

func ServeWS(
	hub *Hub,
	w http.ResponseWriter,
	r *http.Request,
	userID string,
	username string,
	onConnected func(*Client),
) {
	if hub == nil {
		slog.Error(
			"websocket hub unavailable",
			slog.String("component", "websocket"),
			slog.String("remote_ip", utils.GetClientIP(r)),
		)
		http.Error(w, "Websocket hub is unavailable", http.StatusServiceUnavailable)
		return
	}

	if hub.active.Load() > 20000 {
		slog.Warn(
			"websocket server busy",
			slog.String("component", "websocket"),
			slog.Any("active connections", hub.active.Load()),
			slog.String("remote_ip", utils.GetClientIP(r)),
		)
		http.Error(w, "Server is busy", http.StatusServiceUnavailable)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error(
			"websocket upgrade fail",
			slog.String("component", "websocket"),
			slog.String("user", username),
			slog.String("user_id", userID),
			slog.String("remote_ip", utils.GetClientIP(r)),
			slog.Any("error", err),
		)
		return
	}

	client := NewClient(conn, hub, userID, username)

	select {
	case hub.register <- client:
	case <-time.After(3 * time.Second):
		slog.Info("websocket request canceled before register", "component", "websocket", "user", username, "user_id", userID, "error", r.Context().Err())
		_ = conn.Close()
		return
	case <-r.Context().Done():
		conn.Close()
		return
	}

	slog.Info(
		"websocket connected",
		slog.String("component", "websocket"),
		slog.String("user", username),
		slog.String("user_id", userID),
		slog.String("remote_ip", utils.GetClientIP(r)),
	)

	if onConnected != nil {
		onConnected(client)
	}

	go func() {
		defer func() {
			if rec := recover(); rec != nil {
				slog.Error(
					"panic in websocket write pump",
					slog.String("component", "websocket"),
					slog.String("user", username),
					slog.String("user_id", userID),
					slog.Any("error", rec),
				)
			}
		}()
		client.WritePump()
	}()

	go func() {
		defer func() {
			if rec := recover(); rec != nil {
				slog.Error(
					"panic in websocket write pump",
					slog.String("component", "websocket"),
					slog.String("user", username),
					slog.String("user_id", userID),
					slog.Any("error", rec),
				)
			}
		}()
		client.ReadPump()
	}()
}
