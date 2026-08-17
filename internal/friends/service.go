package friends

import (
	"database/sql"

	"github.com/AliKefall/prothea/internal/database"
)

type Service struct{
	db *sql.DB
	queries *database.Queries
}

func NewService(
	db *sql.DB,
	queries *database.Queries,
) *Service{
	return &Service{
		db: db,
		queries: queries,
	}
}
