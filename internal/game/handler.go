package game

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"time"

	"github.com/AliKefall/prothea/internal/websocket"
	"github.com/google/uuid"
)

type MoveEventPayload struct {
	MatchID   uuid.UUID `json:"match_id"`
	From      string    `json:"from"`
	To        string    `json:"to"`
	Promotion string    `json:"promotion,omitempty"`
}

type MoveEvent struct {
	MatchID     string `json:"match_id"`
	MoveNumber  int    `json:"move_number"`
	PlayerID    string `json:"player_id"`
	From        string `json:"from"`
	To          string `json:"to"`
	Promotion   string `json:"promotion,omitempty"`
	UCI         string `json:"uci"`
	SAN         string `json:"san"`
	FENAfter    string `json:"fen_after"`
	WhiteTimeMs int64  `json:"white_time_ms"`
	BlackTimeMs int64  `json:"black_time_ms"`
	LastMoveAt  string `json:"last_move_at"`
}

func (s *Service) HandleMove(
	ctx context.Context,
	client *websocket.Client,
	event websocket.Event,
) error {
	if client == nil {
		return errors.New("websocket client is nil")
	}

	if client.UserID == "" {
		return errors.New("websocket user id is empty")
	}

	var payload MoveEventPayload

	if err := json.Unmarshal(
		event.Payload,
		&payload,
	); err != nil {
		return err
	}

	if payload.MatchID == uuid.Nil {
		return errors.New("match id is required")
	}

	if payload.From == "" {
		return errors.New("from square is required")
	}

	if payload.To == "" {
		return errors.New("to square is required")
	}

	playerID, err := uuid.Parse(client.UserID)
	if err != nil {
		return errors.New("invalid websocket user id")
	}

	slog.Info(
		"game move received",
		"match_id", payload.MatchID,
		"player_id", playerID,
		"from", payload.From,
		"to", payload.To,
	)

	result, err := s.ApplyMove(
		ctx,
		MoveInput{
			MatchID:   payload.MatchID,
			PlayerID:  playerID,
			From:      payload.From,
			To:        payload.To,
			Promotion: payload.Promotion,
		},
	)
	if err != nil {
		return err
	}

	if client.Hub == nil {
		return errors.New("websocket hub is nil")
	}

	/*
	 * A move can also finish the game.
	 * In that case the server must publish a final result instead
	 * of broadcasting an incomplete game_move event.
	 */
	if result.Finish != nil {
		finish := result.Finish

		finishedPayload := GameFinishedEvent{
			MatchID: result.MatchID.String(),

			Result:   string(finish.Result),
			WinnerID: finish.WinnerID.String(),
			LoserID:  finish.LoserID.String(),

			Reason: finish.Reason,

			WhiteRatingBefore: finish.WhiteRatingBefore,
			WhiteRatingAfter:  finish.WhiteRatingAfter,

			BlackRatingBefore: finish.BlackRatingBefore,
			BlackRatingAfter:  finish.BlackRatingAfter,

			CreatedAt: time.Now().UTC().Format(time.RFC3339Nano),
		}

		finishedEvent, err := websocket.NewEvent(
			websocket.EventGameFinished,
			finishedPayload,
		)
		if err != nil {
			return err
		}

		if err := client.Hub.SendToUser(
			result.WhiteID.String(),
			finishedEvent,
		); err != nil {
			return err
		}

		if err := client.Hub.SendToUser(
			result.BlackID.String(),
			finishedEvent,
		); err != nil {
			return err
		}

		slog.Info(
			"game finished",
			"match_id", result.MatchID,
			"result", finish.Result,
			"reason", finish.Reason,
			"winner_id", finish.WinnerID,
			"loser_id", finish.LoserID,
			"white_rating_before", finish.WhiteRatingBefore,
			"white_rating_after", finish.WhiteRatingAfter,
			"black_rating_before", finish.BlackRatingBefore,
			"black_rating_after", finish.BlackRatingAfter,
		)

		return nil
	}

	/*
	 * Only a regular accepted move reaches this branch.
	 * The board and clocks are updated from the authoritative
	 * values calculated by the game service.
	 */
	outgoingPayload := MoveEvent{
		MatchID:     result.MatchID.String(),
		MoveNumber:  result.MoveNumber,
		PlayerID:    result.PlayerID.String(),
		From:        result.From,
		To:          result.To,
		Promotion:   result.Promotion,
		UCI:         result.UCI,
		SAN:         result.SAN,
		FENAfter:    result.FENAfter,
		WhiteTimeMs: result.WhiteTimeMs,
		BlackTimeMs: result.BlackTimeMs,
		LastMoveAt:  result.LastMoveAt.Format(time.RFC3339Nano),
	}

	outgoingEvent, err := websocket.NewEvent(
		websocket.EventGameMove,
		outgoingPayload,
	)
	if err != nil {
		return err
	}

	if err := client.Hub.SendToUser(
		result.WhiteID.String(),
		outgoingEvent,
	); err != nil {
		return err
	}

	if err := client.Hub.SendToUser(
		result.BlackID.String(),
		outgoingEvent,
	); err != nil {
		return err
	}

	slog.Info(
		"game move applied",
		"match_id", result.MatchID,
		"move_number", result.MoveNumber,
		"player_id", result.PlayerID,
		"san", result.SAN,
		"uci", result.UCI,
	)

	return nil
}

type ResignEventPayload struct {
	MatchID uuid.UUID `json:"match_id"`
}

func (s *Service) HandlerResign(
	ctx context.Context,
	client *websocket.Client,
	event websocket.Event,
) error {
	if client == nil {
		return errors.New("websocket client is nil")
	}

	if client.UserID == "" {
		return errors.New("websocket user id is empty")
	}

	var payload ResignEventPayload

	if err := json.Unmarshal(
		event.Payload,
		&payload,
	); err != nil {
		return err
	}

	if payload.MatchID == uuid.Nil {
		return errors.New("match id is required")
	}

	playerID, err := uuid.Parse(client.UserID)
	if err != nil {
		return errors.New("invalid websocket user id")
	}

	slog.Info(
		"game resignation received",
		"match_id", payload.MatchID,
		"player_id", playerID,
	)

	finish, err := s.Resign(
		ctx,
		payload.MatchID,
		playerID,
	)

	if err != nil {
		return err
	}

	if client.Hub == nil {
		return errors.New("websocket hub is nil")
	}

	finishedPayload := GameFinishedEvent{
		MatchID: payload.MatchID.String(),

		Result:   string(finish.Result),
		WinnerID: finish.WinnerID.String(),
		LoserID:  finish.LoserID.String(),

		Reason: finish.Reason,

		WhiteRatingBefore: finish.WhiteRatingBefore,
		WhiteRatingAfter:  finish.WhiteRatingAfter,

		BlackRatingBefore: finish.BlackRatingBefore,
		BlackRatingAfter:  finish.BlackRatingAfter,

		CreatedAt: time.Now().UTC().Format(
			time.RFC3339Nano,
		),
	}

	finishedEvent, err := websocket.NewEvent(
		websocket.EventGameFinished,
		finishedPayload,
	)
	if err != nil {
		return err
	}

	if err := client.Hub.SendToUser(
		finish.WinnerID.String(),
		finishedEvent,
	); err != nil {
		return err
	}

	if err := client.Hub.SendToUser(
		finish.LoserID.String(),
		finishedEvent,
	); err != nil {
		return err
	}

	slog.Info(
		"game resigned",
		"match_id", payload.MatchID,
		"player_id", playerID,
		"winner_id", finish.WinnerID,
		"loser_id", finish.LoserID,
		"white_rating_before", finish.WhiteRatingBefore,
		"white_rating_after", finish.WhiteRatingAfter,
		"black_rating_before", finish.BlackRatingBefore,
		"black_rating_after", finish.BlackRatingAfter,
	)

	return nil
}

type DrawEventPayload struct {
	MatchID uuid.UUID `json:"match_id"`
}

func (s *Service) HandleDrawOffer(
	ctx context.Context,
	client *websocket.Client,
	event websocket.Event,
) error {

	var payload DrawEventPayload

	if err := json.Unmarshal(event.Payload, &payload); err != nil {
		return err
	}

	if payload.MatchID == uuid.Nil {
		return errors.New("match id is required")
	}

	playerID, err := uuid.Parse(client.UserID)
	if err != nil {
		return errors.New("invalid websocket user id")
	}

	if err := s.OfferDraw(
		ctx,
		payload.MatchID,
		playerID,
	); err != nil {
		return err
	}

	state, err := s.StateStore.Get(
		ctx,
		payload.MatchID,
	)

	if err != nil {
		return err
	}

	// Notify only the opponent

	var opponentID uuid.UUID

	switch playerID {
	case state.WhiteID:
		opponentID = state.BlackID
	case state.BlackID:
		opponentID = state.WhiteID
	default:
		return ErrPlayerNotInMatch
	}

	offerEvent, err := websocket.NewEvent(
		websocket.EventGameDrawOffer,
		payload,
	)
	if err != nil {
		return err
	}

	return client.Hub.SendToUser(
		opponentID.String(),
		offerEvent,
	)

}

func (s *Service) HandleDrawAccept(
	ctx context.Context,
	client *websocket.Client,
	event websocket.Event,
) error {
	if client == nil {
		return errors.New("websocket client is nil")
	}

	if client.UserID == "" {
		return errors.New("websocket user id is empty")
	}

	var payload DrawEventPayload

	if err := json.Unmarshal(event.Payload, &payload); err != nil {
		return err
	}

	if payload.MatchID == uuid.Nil {
		return errors.New("match id is required")
	}

	playerID, err := uuid.Parse(client.UserID)
	if err != nil {
		return errors.New("invalid websocket user id")
	}

	if client.Hub == nil {
		return errors.New("websocket hub is nil")
	}

	finish, err := s.AcceptDraw(
		ctx,
		payload.MatchID,
		playerID,
	)

	if err != nil {
		return err
	}

	finishPayload := GameFinishedEvent{
		MatchID: payload.MatchID.String(),

		Result:   string(finish.Result),
		WinnerID: finish.WinnerID.String(),
		LoserID:  finish.LoserID.String(),

		Reason: finish.Reason,

		WhiteRatingBefore: finish.WhiteRatingBefore,
		WhiteRatingAfter:  finish.WhiteRatingAfter,

		BlackRatingBefore: finish.BlackRatingBefore,
		BlackRatingAfter:  finish.BlackRatingAfter,

		CreatedAt: time.Now().UTC().Format(time.RFC3339Nano),
	}

	finishedEvent, err := websocket.NewEvent(
		websocket.EventGameFinished,
		finishPayload,
	)

	if err != nil {
		return err
	}

	state, err := s.StateStore.Get(
		ctx,
		payload.MatchID,
	)
	if err != nil {
		return err
	}

	if err := client.Hub.SendToUser(
		state.WhiteID.String(),
		finishedEvent,
	); err != nil {
		return err
	}

	if err := client.Hub.SendToUser(
		state.BlackID.String(),
		finishedEvent,
	); err != nil {
		return err
	}

	slog.Info(
		"draw accepted",
		"match_id", payload.MatchID,
		"player_id", playerID,
	)

	return nil
}

func (s *Service) HandleDrawDecline(
	ctx context.Context,
	client *websocket.Client,
	event websocket.Event,
) error {
	if client == nil {
		return errors.New("websocket client is nil")
	}

	if client.UserID == "" {
		return errors.New("websocket user id is empty")
	}

	var payload DrawEventPayload

	if err := json.Unmarshal(event.Payload, &payload); err != nil {
		return err
	}

	if payload.MatchID == uuid.Nil {
		return errors.New("match id is required")
	}

	playerID, err := uuid.Parse(client.UserID)
	if err != nil {
		return errors.New("invalid websocket user id")
	}

	if client.Hub == nil {
		return errors.New("websocket hub is nil")
	}

	if err := s.RejectDraw(
		ctx,
		payload.MatchID,
		playerID,
	); err != nil {
		return err
	}

	state, err := s.StateStore.Get(
		ctx,
		payload.MatchID,
	)

	if err != nil {
		return err
	}

	var opponentID uuid.UUID

	switch playerID{
	case state.WhiteID:
		opponentID = state.BlackID
	case state.BlackID:
		opponentID = state.WhiteID

	default:
		return ErrPlayerNotInMatch
	}

	declineEvent, err := websocket.NewEvent(
		websocket.EventGameDrawReject,
		payload,
	)

	if err != nil {
		return err
	}

	return client.Hub.SendToUser(
		opponentID.String(),
		declineEvent,
	)


}
