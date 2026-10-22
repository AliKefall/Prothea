package openings

import (
	"embed"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"sort"
	"strings"
	"sync"
)

//go:embed [a-e].tsv
var database embed.FS

type Opening struct {
	Code string `json:"eco"`
	Name string `json:"name"`
	PGN  string `json:"pgn"`
}

type Analysis struct {
	Opening      *Opening `json:"opening"`
	MatchedPlies int      `json:"matched_plies"`
	TotalPlies   int      `json:"total_plies"`
	ExitPly      *int     `json:"exit_ply,omitempty"`
	ExitMove     string   `json:"exit_move,omitempty"`
}

type node struct {
	children map[string]*node
	opening  *Opening
}

// Worker is an immutable opening index after SetOpenings completes. Lookups
// only read the trie, so callers can query it concurrently without locking.
type Worker struct {
	root     *node
	openings []Opening
}

func NewWorker() *Worker { return &Worker{} }

func (w *Worker) SetOpenings() error {
	entries, err := fs.Glob(database, "*.tsv")
	if err != nil {
		return fmt.Errorf("list opening database: %w", err)
	}
	if len(entries) == 0 {
		return errors.New("opening database is empty")
	}

	type shard struct {
		openings []Opening
		err      error
	}
	results := make(chan shard, len(entries))
	var readers sync.WaitGroup
	for _, entry := range entries {
		readers.Add(1)
		go func(path string) {
			defer readers.Done()
			items, readErr := readShard(path)
			results <- shard{openings: items, err: readErr}
		}(entry)
	}
	readers.Wait()
	close(results)

	loaded := make([]Opening, 0, 4000)
	for result := range results {
		if result.err != nil {
			return result.err
		}
		loaded = append(loaded, result.openings...)
	}
	sort.Slice(loaded, func(i, j int) bool {
		if loaded[i].PGN != loaded[j].PGN {
			return loaded[i].PGN < loaded[j].PGN
		}
		if loaded[i].Name != loaded[j].Name {
			return loaded[i].Name < loaded[j].Name
		}
		return loaded[i].Code < loaded[j].Code
	})

	root := &node{children: make(map[string]*node)}
	for i := range loaded {
		moves := parseMoves(loaded[i].PGN)
		if len(moves) == 0 {
			continue
		}
		current := root
		for _, move := range moves {
			if current.children[move] == nil {
				current.children[move] = &node{children: make(map[string]*node)}
			}
			current = current.children[move]
		}
		if current.opening == nil {
			current.opening = &loaded[i]
		}
	}
	w.root = root
	w.openings = loaded
	return nil
}

func (w *Worker) ListOpenings() []Opening {
	openings := append([]Opening(nil), w.openings...)
	sort.Slice(openings, func(i, j int) bool {
		if openings[i].Name != openings[j].Name {
			return openings[i].Name < openings[j].Name
		}
		if openings[i].Code != openings[j].Code {
			return openings[i].Code < openings[j].Code
		}
		return openings[i].PGN < openings[j].PGN
	})
	return openings
}

func readShard(path string) ([]Opening, error) {
	file, err := database.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open %s: %w", path, err)
	}
	defer file.Close()
	reader := csv.NewReader(file)
	reader.Comma = '\t'
	reader.TrimLeadingSpace = true
	reader.FieldsPerRecord = 3
	if _, err := reader.Read(); err != nil {
		return nil, fmt.Errorf("read %s header: %w", path, err)
	}
	loaded := make([]Opening, 0, 1000)
	for {
		record, err := reader.Read()
		if errors.Is(err, io.EOF) {
			return loaded, nil
		}
		if err != nil {
			return nil, fmt.Errorf("read %s: %w", path, err)
		}
		loaded = append(loaded, Opening{
			Code: strings.TrimSpace(record[0]),
			Name: strings.TrimSpace(record[1]),
			PGN:  strings.TrimSpace(record[2]),
		})
	}
}

// AnalyzeMoves returns the most specific named opening reached and the first
// played move that has no continuation in the book.
func (w *Worker) AnalyzeMoves(playedMoves []string) Analysis {
	analysis := Analysis{TotalPlies: len(playedMoves)}
	if w.root == nil {
		return analysis
	}
	current := w.root
	for i, move := range playedMoves {
		current = current.children[normalizeMove(move)]
		if current == nil {
			break
		}
		analysis.MatchedPlies = i + 1
		if current.opening != nil {
			analysis.Opening = current.opening
		}
	}
	if analysis.MatchedPlies < len(playedMoves) {
		ply := analysis.MatchedPlies + 1
		analysis.ExitPly = &ply
		analysis.ExitMove = playedMoves[analysis.MatchedPlies]
	}
	return analysis
}

// GetOpenings is kept as the PGN convenience entry point and uses the same
// indexed lookup as match analysis.
func (w *Worker) GetOpenings(playedPGN string) (Opening, bool) {
	analysis := w.AnalyzeMoves(parseMoves(playedPGN))
	if analysis.Opening == nil {
		return Opening{}, false
	}
	return *analysis.Opening, true
}

func parseMoves(pgn string) []string {
	moves := make([]string, 0, 40)
	for token := range strings.FieldsSeq(pgn) {
		if strings.HasPrefix(token, "{") || strings.HasPrefix(token, ";") || strings.ContainsAny(token, "()") || strings.HasPrefix(token, "$") {
			continue
		}
		for strings.Contains(token, ".") {
			index := strings.IndexByte(token, '.')
			if index < 0 {
				break
			}
			token = token[index+1:]
		}
		token = normalizeMove(token)
		if token == "" || token == "1-0" || token == "0-1" || token == "1/2-1/2" || token == "*" {
			continue
		}
		moves = append(moves, token)
	}
	return moves
}

func normalizeMove(move string) string {
	move = strings.TrimSpace(move)
	move = strings.TrimRight(move, "!?+#")
	return move
}
