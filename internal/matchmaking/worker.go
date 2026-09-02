package matchmaking

import (
	"context"
	"errors"
	"log/slog"
	"math/rand"
	"time"

	"github.com/AliKefall/prothea/internal/game"
	"github.com/AliKefall/prothea/internal/websocket"
	"github.com/google/uuid"
)

type Worker struct {
	Service     *Service
	GameService *game.Service
	Hub         *websocket.Hub

	TimeControls []TimeControl

	PollInterval time.Duration
	BatchSize    int
}

func (s *Service) FindMatches(
	ctx context.Context,
	timeControl string,
	limit int,
) ([]MatchFound, error) {
	if s == nil || s.Redis == nil {
		return nil, errors.New("redis nil")
	}

	script, err := luaScripts.ReadFile("lua/matchmake.lua")
	if err != nil {
		return nil, err
	}

	result, err := s.Redis.Eval(
		ctx,
		string(script),
		[]string{queueKey(timeControl)},
		time.Now().UTC().Unix(),
		s.RatingWindow,
		s.WindowGrowth,
		s.MaxWindow,
		limit,
	).Result()
	if err != nil {
		return nil, err
	}

	rows, ok := result.([]any)
	if !ok || len(rows) == 0 {
		return nil, nil
	}

	matches := make([]MatchFound, 0, len(rows))

	for _, row := range rows {
		fields, ok := row.([]any)
		if !ok || len(fields) < 7 {
			continue
		}

		matchRaw := parseLuaString(fields[0])

		p1ID, err := uuid.Parse(parseLuaString(fields[1]))
		if err != nil {
			continue
		}

		p2ID, err := uuid.Parse(parseLuaString(fields[2]))
		if err != nil {
			continue
		}

		p1Rating, err := parseLuaInt(fields[3])
		if err != nil {
			continue
		}

		p2Rating, err := parseLuaInt(fields[4])
		if err != nil {
			continue
		}

		p1Username := parseLuaString(fields[5])
		p2Username := parseLuaString(fields[6])

		matchID, err := uuid.Parse(matchRaw)
		if err != nil {
			matchID = uuid.NewSHA1(
				uuid.NameSpaceURL,
				[]byte(matchRaw),
			)
		}

		whiteID := p1ID
		blackID := p2ID

		whiteRating := p1Rating
		blackRating := p2Rating

		whiteUsername := p1Username
		blackUsername := p2Username

		if rand.Intn(2) == 1 {
			whiteID, blackID = blackID, whiteID
			whiteRating, blackRating = blackRating, whiteRating
			whiteUsername, blackUsername = blackUsername, whiteUsername
		}

		matches = append(matches, MatchFound{
			ID: matchID,

			WhiteID:       whiteID,
			WhiteUsername: whiteUsername,
			WhiteRating:   whiteRating,

			BlackID:       blackID,
			BlackUsername: blackUsername,
			BlackRating:   blackRating,

			TimeControl: timeControl,
			CreatedAt:   time.Now().UTC(),
		})
	}

	return matches, nil
}

func (w *Worker) Run(ctx context.Context) {
	ticker := time.NewTicker(w.pollInterval())
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return

		case <-ticker.C:
			w.processMatchMaking(ctx)
		}
	}
}

func (w *Worker) processMatchMaking(ctx context.Context) {
	if w.Service == nil {
		slog.Error("matchmaking worker service is nil")
		return
	}

	for _, timeControl := range w.timeControls() {
		matches, err := w.Service.FindMatches(
			ctx,
			timeControl.Name,
			w.batchSize(),
		)

		if err != nil {
			slog.Error(
				"matchmaking failed",
				"time_control", timeControl.Name,
				"error", err,
			)
			continue
		}

		for _, foundMatch := range matches {
			slog.Info(
				"match found",
				"match_id", foundMatch.ID,
				"white", foundMatch.WhiteUsername,
				"black", foundMatch.BlackUsername,
				"time_control", foundMatch.TimeControl,
			)

			// Persist the match.
			if w.GameService == nil {
				slog.Error(
					"game service is nil",
					"match_id", foundMatch.ID,
				)
				continue
			}

			gameMatch := game.Match{
				ID: foundMatch.ID,

				WhiteID: foundMatch.WhiteID,
				BlackID: foundMatch.BlackID,

				TimeControl: foundMatch.TimeControl,

				WhiteRatingBefore: foundMatch.WhiteRating,
				BlackRatingBefore: foundMatch.BlackRating,

				Result:    game.StatusPending,
				CreatedAt: foundMatch.CreatedAt,
			}

			createdMatch, err := w.GameService.CreateMatch(
				ctx,
				gameMatch,
			)

			if err != nil {
				slog.Error(
					"failed to persist match",
					"match_id", foundMatch.ID,
					"error", err,
				)
				continue
			}

			slog.Info(
				"match persisted",
				"match_id", createdMatch.ID,
				"white_id", createdMatch.WhiteID,
				"black_id", createdMatch.BlackID,
				"time_control", createdMatch.TimeControl,
			)

			// Notify both players.
			if w.Hub == nil {
				slog.Error(
					"websocket hub is nil",
					"match_id", foundMatch.ID,
				)
				continue
			}

			event, err := websocket.NewEvent(
				websocket.EventMatchFound,
				foundMatch,
			)
			if err != nil {
				slog.Error(
					"failed to create match found event",
					"match_id", foundMatch.ID,
					"error", err,
				)
				continue
			}

			if err := w.Hub.SendToUser(
				foundMatch.WhiteID.String(),
				event,
			); err != nil {
				slog.Error(
					"failed to notify white player",
					"match_id", foundMatch.ID,
					"user_id", foundMatch.WhiteID,
					"error", err,
				)
			}

			if err := w.Hub.SendToUser(
				foundMatch.BlackID.String(),
				event,
			); err != nil {
				slog.Error(
					"failed to notify black player",
					"match_id", foundMatch.ID,
					"user_id", foundMatch.BlackID,
					"error", err,
				)
			}
		}
	}
}

func (w *Worker) timeControls() []TimeControl {
	if len(w.TimeControls) == 0 {
		return SupportedTimeControls
	}

	return w.TimeControls
}

func (w *Worker) pollInterval() time.Duration {
	if w.PollInterval <= 0 {
		return DefaultPollInterval
	}

	return w.PollInterval
}

func (w *Worker) batchSize() int {
	if w.BatchSize <= 0 {
		return DefaultMatchBatchSize
	}

	return w.BatchSize
}
