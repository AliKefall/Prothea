package websocket

import (
	"context"
	"log/slog"
)

func (h *Hub) dispatch(
	ctx context.Context,
	in inbound,
) {
	handler, ok := h.events[EventType(in.event.Type)]

	if !ok {
		slog.Warn(
			"unknown websocket event",
			"event_type", in.event.Type,
			"user_id", in.client.UserID,
		)
		return
	}

	if err := handler(
		ctx,
		in.client,
		in.event,
	); err != nil {
		slog.Error(
			"websocket event handler failed",
			"event_type", in.event.Type,
			"user_id", in.client.UserID,
			"error", err,
		)
	}
}
