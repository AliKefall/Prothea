package openings

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/AliKefall/prothea/internal/websocket"
)

type openingRequest struct {
	MatchID string   `json:"match_id"`
	Moves   []string `json:"moves"`
}

type openingResponse struct {
	MatchID  string   `json:"match_id"`
	LineKey  string   `json:"line_key"`
	Analysis Analysis `json:"analysis"`
}

func (w *Worker) HandleWebSocketRequest(_ context.Context, client *websocket.Client, event websocket.Event) error {
	if client == nil || client.UserID == "" {
		return errors.New("authenticated websocket client is required")
	}
	var request openingRequest
	if err := json.Unmarshal(event.Payload, &request); err != nil {
		return err
	}
	if request.MatchID == "" {
		return errors.New("match id is required")
	}
	if len(request.Moves) > 200 {
		return errors.New("opening request exceeds the supported move count")
	}
	for _, move := range request.Moves {
		if len(move) > 16 {
			return errors.New("opening request contains an invalid move")
		}
	}
	lineKey := request.MatchID + "|" + strings.Join(request.Moves, " ")
	response, err := websocket.NewEvent(websocket.EventOpeningAnalysis, openingResponse{
		MatchID:  request.MatchID,
		LineKey:  lineKey,
		Analysis: w.AnalyzeMoves(request.Moves),
	})
	if err != nil {
		return err
	}
	return client.SendEvent(response)
}
