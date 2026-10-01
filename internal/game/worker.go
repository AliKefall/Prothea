package game

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/AliKefall/prothea/internal/websocket"
	"github.com/google/uuid"
)

const (
	DefaultTimeoutPollInterval = 500 * time.Millisecond
	DefaultTimeoutBatchSize    = 100
)

type Worker struct {
	Service         *Service
	StateStore      *RedisStateStore
	Hub             *websocket.Hub
	DisconnectStore DisconnectStore

	PollInterval time.Duration
	BatchSize    int
}

func (w *Worker) Run(ctx context.Context) {
	ticker := time.NewTicker(
		w.pollInterval(),
	)

	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return

		case <-ticker.C:
			w.process(ctx)
		}
	}
}

func (w *Worker) process(
	ctx context.Context,
) {
	if w.Service == nil {
		slog.Error(
			"game worker service is nil",
		)
		return
	}

	if w.StateStore == nil {
		slog.Error(
			"game worker state store is nil",
		)
		return
	}

	if w.DisconnectStore == nil {
		slog.Error(
			"game worker disconnect store is nil",
		)
		return
	}

	if w.Hub == nil {
		slog.Error(
			"game worker websocket hub is nil",
		)
		return
	}

	now := time.Now().UTC()

	w.processTimeouts(
		ctx,
		now,
	)

	w.processDisconnects(
		ctx,
		now,
	)
}

func (w *Worker) processTimeouts(
	ctx context.Context,
	now time.Time,
) {
	matchIDs, err := w.StateStore.ExpiredMatchIDs(
		ctx,
		now,
		w.batchSize(),
	)
	if err != nil {
		slog.Error(
			"failed to get expired game matches",
			"error", err,
		)
		return
	}

	for _, matchID := range matchIDs {
		w.processMatch(
			ctx,
			matchID,
		)
	}
}

func (w *Worker) processDisconnects(
	ctx context.Context,
	now time.Time,
) {
	entries, err := w.DisconnectStore.Expired(
		ctx,
		now,
		w.batchSize(),
	)
	if err != nil {
		slog.Error(
			"failed to get expired disconnects",
			"error", err,
		)
		return
	}

	for _, entry := range entries {
		w.processDisconnect(
			ctx,
			entry,
		)
	}
}

func (w *Worker) processDisconnect(
	ctx context.Context,
	entry DisconnectEntry,
) {
	result, err := w.Service.ExpireDisconnect(
		ctx,
		entry.MatchID,
		entry.PlayerID,
	)
	if err != nil {
		switch {
		case errors.Is(err, ErrDisconnectNotFound):
			return

		case errors.Is(err, ErrGameNotActive):
			return

		case errors.Is(err, ErrPlayerNotInMatch):
			slog.Warn(
				"disconnect entry belongs to player outside match",
				"match_id", entry.MatchID,
				"player_id", entry.PlayerID,
			)
			return

		case errors.Is(err, ErrGameLocked):
			return

		default:
			slog.Error(
				"failed to process game abandonment",
				"match_id", entry.MatchID,
				"player_id", entry.PlayerID,
				"error", err,
			)

			return
		}
	}

	event, err := newGameFinishedEvent(
		result.MatchID,
		result.Finish,
	)
	if err != nil {
		slog.Error(
			"failed to create abandonment event",
			"match_id", result.MatchID,
			"player_id", result.DisconnectedPlayerID,
			"error", err,
		)
		return
	}

	if err := w.Hub.SendToUser(
		result.WhiteID.String(),
		event,
	); err != nil {
		slog.Warn(
			"failed to notify white player after abandonment",
			"match_id", result.MatchID,
			"user_id", result.WhiteID,
			"error", err,
		)
	}

	if err := w.Hub.SendToUser(
		result.BlackID.String(),
		event,
	); err != nil {
		slog.Warn(
			"failed to notify black player after abandonment",
			"match_id", result.MatchID,
			"user_id", result.BlackID,
			"error", err,
		)
	}

	slog.Info(
		"game abandonment processed",
		"match_id", result.MatchID,
		"disconnected_player_id", result.DisconnectedPlayerID,
		"result", result.Finish.Result,
		"winner_id", result.Finish.WinnerID,
		"loser_id", result.Finish.LoserID,
	)
}

func (w *Worker) processMatch(
	ctx context.Context,
	matchID uuid.UUID,
) {
	result, err := w.Service.ExpireTimeout(
		ctx,
		matchID,
	)

	if err != nil {
		switch {
		case errors.Is(err, ErrGameTimeNotExpired):
			return
		case errors.Is(err, ErrGameNotActive):
			return
		case errors.Is(err, ErrGameLocked):
			return
		default:
			slog.Error(
				"failed to expire gmae timeout",
				"match_id", matchID,
				"error", err,
			)

			return
		}
	}

	event, err := newGameFinishedEvent(
		result.MatchID,
		result.Finish,
	)

	if err != nil {
		slog.Error(
			"failed to create timeout event",
			"match_id", matchID,
			"error", err,
		)
		return
	}

	if err := w.Hub.SendToUser(
		result.WhiteID.String(),
		event,
	); err != nil {
		slog.Warn(
			"failed to notify white player after timeout",
			"match_id", matchID,
			"user_id", result.WhiteID,
			"error", err,
		)
	}

	if err := w.Hub.SendToUser(
		result.BlackID.String(),
		event,
	); err != nil {
		slog.Warn(
			"failed to notify white player after timeout",
			"match_id", matchID,
			"user_id", result.BlackID,
			"error", err,
		)
	}

	slog.Info(
		"game timeout processed",
		"match_id", matchID,
		"result", result.Finish.Result,
		"winner_id", result.Finish.WinnerID,
		"loser_id", result.Finish.LoserID,
	)
}

func newGameFinishedEvent(
	matchID uuid.UUID,
	finish FinishResult,
) (websocket.Event, error) {
	payload := GameFinishedEvent{
		MatchID: matchID.String(),

		Result:   string(finish.Result),
		WinnerID: finish.WinnerID.String(),
		LoserID:  finish.LoserID.String(),

		Reason: finish.Reason,

		WhiteRatingBefore: finish.WhiteRatingBefore,
		WhiteRatingAfter:  finish.WhiteRatingAfter,

		BlackRatingBefore: finish.BlackRatingBefore,
		BlackRatingAfter:  finish.BlackRatingAfter,

		CreatedAt: time.Now().Format(
			time.RFC3339Nano,
		),
	}

	return websocket.NewEvent(
		websocket.EventGameFinished,
		payload,
	)
}

func (w *Worker) pollInterval() time.Duration {
	if w.PollInterval <= 0 {
		return DefaultTimeoutPollInterval
	}

	return w.PollInterval
}

func (w *Worker) batchSize() int {
	if w.BatchSize <= 0 {
		return DefaultTimeoutBatchSize
	}

	return w.BatchSize
}
