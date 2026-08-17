package endpoints

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"net/http"
	"time"

	"github.com/AliKefall/prothea/internal/auth"
	"github.com/AliKefall/prothea/internal/database"
	"github.com/AliKefall/prothea/internal/utils"
	"github.com/google/uuid"
)

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func (deps *Deps) LoginHandler(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var req LoginRequest

	utils.DecodeJSON(w, r, req)

	if req.Username == "" || req.Password == "" {
		utils.RespondWithError(w, http.StatusBadRequest, "login_error", "Username and password are required", "", nil)
		return
	}

	user, err := deps.Queries.GetUserByUsername(ctx, req.Username)
	if err != nil {
		utils.RespondWithError(w, http.StatusUnauthorized, "login_error", "User could not be found", "", err)
		return
	}

	ok, err := deps.Hasher.Verify(req.Password, user.Password)
	if !ok || err != nil {
		utils.RespondWithError(w, http.StatusUnauthorized, "login_error", "Invalid credentials", "", err)
		return
	}

	now := time.Now()

	refreshTTL := 7 * 24 * time.Hour
	maxSessionTTL := 30 * 24 * time.Hour

	refreshExpires := now.Add(refreshTTL)
	maxExpires := now.Add(maxSessionTTL)

	sessionID := uuid.New()

	refreshToken, err := auth.MakeRefreshToken()

	if err != nil {
		utils.RespondWithError(w, http.StatusInternalServerError, "refresh_error", "Failed to create refresh token", "", err)
		return
	}

	hash := sha256.Sum256([]byte(refreshToken))
	refreshHash := hex.EncodeToString(hash[:])

	_, err = deps.Queries.CreateSession(ctx, database.CreateSessionParams{
		ID:               sessionID,
		UserID:           user.ID,
		RefreshTokenHash: refreshHash,
		UserAgent: sql.NullString{
			String: r.UserAgent(),
			Valid:  true,
		},
		IpAddress: sql.NullString{
			String: utils.GetClientIP(r),
			Valid:  true,
		},
		CreatedAt:    now,
		ExpiresAt:    refreshExpires,
		MaxExpiresAt: maxExpires,
		LastUsedAt: sql.NullTime{
			Time:  now,
			Valid: true,
		},
	})

	if err != nil {
		utils.RespondWithError(w, http.StatusInternalServerError, "session_error", "Failed to create session", "", err)
		return
	}

	accessToken, err := deps.JWT.Generate(user.ID.String(), sessionID.String())

	if err != nil {
		utils.RespondWithError(w, http.StatusInternalServerError, "jwt_error", "Faield to create access token", "", err)
		return
	}

	deps.RedisClient.Set(ctx, "sess:"+refreshHash, user.ID.String(), refreshTTL)

	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    refreshToken,
		HttpOnly: true,
		Secure:   utils.ShouldUseSecureCookie(r),
		SameSite: http.SameSiteLaxMode,
		Path:     "/",
		Expires:  refreshExpires,
	})

	utils.RespondWithJSON(w, http.StatusOK, map[string]any{
		"access_token": accessToken,
		"user": map[string]string{
			"user_id":  user.ID.String(),
			"username": user.Username,
			"email":    user.Email,
		},
	})
}
