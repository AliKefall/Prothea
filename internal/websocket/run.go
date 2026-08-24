package websocket

import "context"

func (h *Hub) Run(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case client := <-h.register:
		case client := <-h.unregister:
			h.unregisterClient(client)
		case in := <-h.inbound:
			h.dispatch(ctx, in)
		}
	}
}
