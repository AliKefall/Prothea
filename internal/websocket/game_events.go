package websocket

var (
	EventGameMove       EventType = "game_move"
	EventGameResign     EventType = "game_resign"
	EventGameFinished   EventType = "game_finished"
	EventGameDrawOffer  EventType = "game_draw_offer"
	EventGameDrawAccept EventType = "game_draw_accept"
	EventGameDrawReject EventType = "game_draw_reject"
)
