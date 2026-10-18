
package openings

import (
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
)

type Opening struct {
	Code string `json:"eco"`
	Name string `json:"name"`
	PGN  string `json:"pgn"`
}

type Worker struct {
	Openings []Opening
}

func NewWorker() *Worker {
	return &Worker{
		Openings: make([]Opening, 0),
	}
}

func (w *Worker) SetOpenings() error {
	file, err := os.Open("./internal/openings/a.tsv")
	if err != nil {
		return fmt.Errorf("open opening database: %w", err)
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.Comma = '\t'
	reader.TrimLeadingSpace = true
	reader.FieldsPerRecord = 3

	// Skip the header.
	_, err = reader.Read()
	if err != nil {
		return fmt.Errorf("read opening database header: %w", err)
	}

	loaded := make([]Opening, 0)

	for {
		record, err := reader.Read()

		if errors.Is(err, io.EOF) {
			break
		}

		if err != nil {
			return fmt.Errorf("read opening database row: %w", err)
		}

		loaded = append(loaded, Opening{
			Code: strings.TrimSpace(record[0]),
			Name: strings.TrimSpace(record[1]),
			PGN:  strings.TrimSpace(record[2]),
		})
	}

	w.Openings = loaded

	return nil
}

// GetOpenings returns the best matching opening for the played PGN.
// It prefers the longest opening line that matches the played moves.
func (w *Worker) GetOpenings(playedPGN string) (Opening, bool) {
	playedMoves := parseMoves(playedPGN)
	if len(playedMoves) == 0 {
		return Opening{}, false
	}

	var best Opening
	bestMoveCount := 0
	found := false

	for _, opening := range w.Openings {
		openingMoves := parseMoves(opening.PGN)

		if len(openingMoves) > len(playedMoves) {
			continue
		}

		matches := true

		for i, move := range openingMoves {
			if move != playedMoves[i] {
				matches = false
				break
			}
		}

		if matches && len(openingMoves) > bestMoveCount {
			best = opening
			bestMoveCount = len(openingMoves)
			found = true
		}
	}

	return best, found
}

// parseMoves removes PGN move numbers and game result markers.
func parseMoves(pgn string) []string {
	fields := strings.Fields(pgn)
	moves := make([]string, 0, len(fields))

	for _, field := range fields {
		field = strings.TrimSpace(field)

		if field == "" {
			continue
		}

		// Skip move numbers such as "1." and "1..."
		if strings.HasSuffix(field, ".") {
			continue
		}

		// Skip game result markers.
		switch field {
		case "1-0", "0-1", "1/2-1/2", "*":
			continue
		}

		moves = append(moves, field)
	}

	return moves
}

