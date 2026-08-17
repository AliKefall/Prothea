package endpoints

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"net/http"
	"time"

	"github.com/AliKefall/prothea/internal/database"
	"github.com/AliKefall/prothea/internal/utils"
)

const ttl = 7 * 24 * time.Hour

func (deps *Deps) LogoutHandler(w http.ResponseWriter, r *http.Request){
	ctx, cancel := context.WithTimeout(r.Context(), 5 * time.Second)
	defer cancel()

	cookie, err := r.Cookie("refresh_token")
	clearRefreshToken(w, r)

	if err != nil || cookie.Value == ""{
		utils.RespondWithJSON(w, http.StatusOK, map[string]string{
			"message": "logged out",
		})
		return
	}

	hash := sha256.Sum256([]byte(cookie.Value))
	tokenHash := hex.EncodeToString(hash[:])

	err = deps.Queries.RevokeSessionByTokenHash(ctx, database.RevokeSessionByTokenHashParams{
		RefreshTokenHash: tokenHash,
		RevokedAt: sql.NullTime{Time: time.Now(), Valid: true},
	})

	if err != nil && err != sql.ErrNoRows{
		utils.RespondWithError(w, http.StatusInternalServerError, "logout_error", "Logout failed", "", err)
		return
	}

	deps.RedisClient.Set(ctx, "bl:" + tokenHash, "1", ttl)
	deps.RedisClient.Del(ctx, "sess:" + tokenHash)

	utils.RespondWithJSON(w, http.StatusOK, map[string]string{
		"message": "logged out",
	})
}

