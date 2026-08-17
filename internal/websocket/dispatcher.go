package websocket

import "context"

func (h *Hub) dispatch(
	ctx context.Context,
	in inbound,
) {

	handler, ok := h.events[EventType(in.event.Type)]

	if !ok {
		return
	}

	_ = handler(
		ctx,
		in.client,
		in.event,
	)
}
