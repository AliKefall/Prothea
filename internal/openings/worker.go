package openings

import (
	"encoding/csv"
	"errors"
	"io"
	"os"

	"github.com/AliKefall/prothea/internal/websocket"
)

type Opening struct {
	Code string `json:"eco"`
	Name string `json:"name"`
	PGN  string `json:"pgn"`
}

type Worker struct {
	Openings []Opening
	client   *websocket.Client
}

func (w *Worker) SetOpenings() error {
	file, err := os.Open("./internal/openings/a.tsv")
	if err != nil {
		return nil
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.Comma = '\t'
	reader.TrimLeadingSpace = true

	_, err = reader.Read()
	if err != nil {
		if errors.Is(err, io.EOF) {
			return nil
		}
		return nil
	}

	openings := make([]Opening, 0)

	for _, opening := range openings {
		w.Openings = append(w.Openings, opening)
	}

	return nil
}

func (w *Worker) GetOpenings(EPD string) (string, bool) {
	opening, ok := w.Openings[EPD]


}
