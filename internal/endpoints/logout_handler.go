package endpoints

import (
	"context"
	"database/sql"
	"net/http"
	"time"

	"github.com/AliKefall/prothea/internal/database"
	"github.com/AliKefall/prothea/internal/utils"
	"github.com/google/uuid"
)

func (deps *Deps) LogoutHandler(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	sessionID, ok := r.Context().Value(SessionIDKey).(uuid.UUID)
	if !ok || sessionID == uuid.Nil {
		utils.RespondWithError(w, http.StatusUnauthorized, "session_error", "Invalid session", "", nil)
		return
	}
	clearAuthCookies(w, r)
	err := deps.Queries.RevokeSession(ctx, database.RevokeSessionParams{
		ID:        sessionID,
		RevokedAt: sql.NullTime{Time: time.Now().UTC(), Valid: true},
	})

	if err != nil && err != sql.ErrNoRows {
		utils.RespondWithError(w, http.StatusInternalServerError, "logout_error", "Logout failed", "", err)
		return
	}

	utils.RespondWithJSON(w, http.StatusOK, map[string]string{
		"message": "logged out",
	})
}
