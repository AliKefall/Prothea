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
	Service    *Service
	StateStore *RedisStateStore
	Hub        *websocket.Hub

	PollInterval time.Duration
	BatchSize    int
}

func (w *Worker) Run(ctx context.Context) {
	ticker := time.NewTicker(
		w.PollInterval,
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
			"game timeout worker service is nil",
		)
		return
	}

	if w.StateStore == nil {
		slog.Error(
			"game timeout worker state is nil",
		)
		return
	}

	if w.Hub == nil {
		slog.Error(
			"game timeout worker websocket hub is nil",
		)
		return
	}

	matchIDs, err := w.StateStore.ExpiredMatchIDs(
		ctx,
		time.Now().UTC(),
		w.BatchSize,
	)

	if err != nil {
		slog.Error(
			"failed to get expired game matches",
			"error", err,
		)
		return
	}

	for _, matchID := range matchIDs {
		w.processMatch(ctx, matchID)
	}
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
	if w.pollInterval() <= 0 {
		return DefaultTimeoutPollInterval
	}

	return w.PollInterval
}

func (w *Worker) batchSize() int {
	if w.batchSize() <= 0 {
		return DefaultTimeoutBatchSize
	}

	return w.BatchSize
}
