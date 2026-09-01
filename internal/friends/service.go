package friends

import (
	"database/sql"

	"github.com/AliKefall/prothea/internal/database"
	"github.com/AliKefall/prothea/internal/websocket"
)

type Service struct {
	db      *sql.DB
	queries *database.Queries
	hub     *websocket.Hub
}

func NewService(
	db *sql.DB,
	queries *database.Queries,
	hub *websocket.Hub,
) *Service {
	return &Service{
		db:      db,
		queries: queries,
		hub:     hub,
	}
}
