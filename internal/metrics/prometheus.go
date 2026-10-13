package metrics

import (
	"strconv"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

var (
	once     sync.Once
	instance *Metrics
)

type Metrics struct {
	httpRequestTotal    *prometheus.CounterVec
	httpRequestDuration *prometheus.HistogramVec
	httpInFlight        prometheus.Gauge

	wsConnectionsActive prometheus.Gauge
	wsConnectionsTotal  *prometheus.CounterVec
	wsMessagesTotal     *prometheus.CounterVec
}

func NewMetrics() *Metrics {
	once.Do(func() {
		m := &Metrics{
			httpRequestTotal: prometheus.NewCounterVec(
				prometheus.CounterOpts{
					Namespace: "prothea",
					Subsystem: "http",
					Name:      "requests_total",
					Help:      "Total number of HTTP requests.",
				},
				[]string{"method", "route", "status"},
			),

			httpRequestDuration: prometheus.NewHistogramVec(
				prometheus.HistogramOpts{
					Namespace: "prothea",
					Subsystem: "http",
					Name:      "request_duration_seconds",
					Help:      "HTTP request duration in seconds.",
					Buckets:   prometheus.DefBuckets,
				},
				[]string{"method", "route"},
			),

			httpInFlight: prometheus.NewGauge(
				prometheus.GaugeOpts{
					Namespace: "prothea",
					Subsystem: "http",
					Name:      "requests_in_flight",
					Help:      "Current number of in-flight HTTP requests.",
				},
			),

			wsConnectionsActive: prometheus.NewGauge(
				prometheus.GaugeOpts{
					Namespace: "prothea",
					Subsystem: "ws",
					Name:      "connections_active",
					Help:      "Current number of active WebSocket connections.",
				},
			),

			wsConnectionsTotal: prometheus.NewCounterVec(
				prometheus.CounterOpts{
					Namespace: "prothea",
					Subsystem: "ws",
					Name:      "connections_total",
					Help:      "Total number of WebSocket connection outcomes.",
				},
				[]string{"result"},
			),

			wsMessagesTotal: prometheus.NewCounterVec(
				prometheus.CounterOpts{
					Namespace: "prothea",
					Subsystem: "ws",
					Name:      "messages_total",
					Help:      "Total number of WebSocket messages.",
				},
				[]string{"direction", "type"},
			),
		}

		prometheus.MustRegister(
			m.httpRequestTotal,
			m.httpRequestDuration,
			m.httpInFlight,
			m.wsConnectionsActive,
			m.wsConnectionsTotal,
			m.wsMessagesTotal,
		)

		instance = m
	})

	return instance
}

func (m *Metrics) ObserveHTTP(
	method string,
	route string,
	status int,
	duration time.Duration,
) {
	if m == nil {
		return
	}

	if route == "" {
		route = "unknown"
	}

	m.httpRequestTotal.
		WithLabelValues(
			method,
			route,
			strconv.Itoa(status),
		).
		Inc()

	m.httpRequestDuration.
		WithLabelValues(method, route).
		Observe(duration.Seconds())
}

func (m *Metrics) IncInFlight() {
	if m != nil {
		m.httpInFlight.Inc()
	}
}

func (m *Metrics) DecInFlight() {
	if m != nil {
		m.httpInFlight.Dec()
	}
}

func (m *Metrics) ObserveWSConnection(result string) {
	if m == nil {
		return
	}

	m.wsConnectionsTotal.
		WithLabelValues(result).
		Inc()
}

func (m *Metrics) IncWSConnections() {
	if m != nil {
		m.wsConnectionsActive.Inc()
	}
}

func (m *Metrics) DecWSConnections() {
	if m != nil {
		m.wsConnectionsActive.Dec()
	}
}

func (m *Metrics) ObserveWSMessage(
	direction string,
	messageType string,
) {
	if m == nil {
		return
	}
	if direction != "received" && direction != "sent" {
		direction = "unknown"
	}
	if !knownWebSocketMessageType(messageType) {
		messageType = "unknown"
	}

	m.wsMessagesTotal.
		WithLabelValues(direction, messageType).
		Inc()
}

func knownWebSocketMessageType(messageType string) bool {
	switch messageType {
	case "chat_send", "chat_message", "chat_error",
		"friend_request", "friendship_accepted", "friendship_rejected", "friend_online", "friend_offline",
		"game_move", "game_resign", "game_finished", "game_draw_offer", "game_draw_accept", "game_draw_reject",
		"game_player_disconnected", "game_player_reconnected", "game_presence_sync_request", "game_presence_sync",
		"match_found":
		return true
	default:
		return false
	}
}
