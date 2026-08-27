package endpoints

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"net/http"
	"strings"
	"time"

	"github.com/AliKefall/prothea/internal/auth"
	"github.com/AliKefall/prothea/internal/database"
	"github.com/AliKefall/prothea/internal/utils"
	"github.com/google/uuid"
)

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (deps *Deps) LoginHandler(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var req LoginRequest

	if err := utils.DecodeJSON(w, r, &req); err != nil {
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	if req.Email == "" || req.Password == "" {
		utils.RespondWithError(
			w,
			http.StatusBadRequest,
			"login_error",
			"Email and password are required",
			"",
			nil,
		)
		return
	}

	user, err := deps.Queries.GetUserByEmail(ctx, req.Email)
	if err != nil {
		if err == sql.ErrNoRows {
			utils.RespondWithError(
				w,
				http.StatusUnauthorized,
				"login_error",
				"Invalid credentials",
				"",
				nil,
			)
			return
		}

		utils.RespondWithError(
			w,
			http.StatusInternalServerError,
			"database_error",
			"Failed to load user",
			"",
			err,
		)
		return
	}

	ok, err := deps.Hasher.Verify(req.Password, user.Password)
	if err != nil {
		utils.RespondWithError(
			w,
			http.StatusInternalServerError,
			"auth_error",
			"Failed to verify credentials",
			"",
			err,
		)
		return
	}

	if !ok {
		utils.RespondWithError(
			w,
			http.StatusUnauthorized,
			"login_error",
			"Invalid credentials",
			"",
			nil,
		)
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
		utils.RespondWithError(
			w,
			http.StatusInternalServerError,
			"refresh_error",
			"Failed to create refresh token",
			"",
			err,
		)
		return
	}

	hash := sha256.Sum256([]byte(refreshToken))
	refreshHash := hex.EncodeToString(hash[:])

	_, err = deps.Queries.CreateSession(
		ctx,
		database.CreateSessionParams{
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
		},
	)
	if err != nil {
		utils.RespondWithError(
			w,
			http.StatusInternalServerError,
			"session_error",
			"Failed to create session",
			"",
			err,
		)
		return
	}

	accessToken, err := deps.JWT.Generate(
		user.ID.String(),
		sessionID.String(),
	)
	if err != nil {
		utils.RespondWithError(
			w,
			http.StatusInternalServerError,
			"jwt_error",
			"Failed to create access token",
			"",
			err,
		)
		return
	}

	if err := deps.RedisClient.Set(
		ctx,
		"sess:"+refreshHash,
		user.ID.String(),
		refreshTTL,
	).Err(); err != nil {
		utils.RespondWithError(
			w,
			http.StatusInternalServerError,
			"session_error",
			"Failed to store session",
			"",
			err,
		)
		return
	}

	http.SetCookie(
		w,
		&http.Cookie{
			Name:     "refresh_token",
			Value:    refreshToken,
			HttpOnly: true,
			Secure:   utils.ShouldUseSecureCookie(r),
			SameSite: http.SameSiteLaxMode, // NOTE: Don't forget to change this in prod
			Path:     "/",
			Expires:  refreshExpires,
			MaxAge:   int(refreshTTL.Seconds()),
		},
	)

	utils.RespondWithJSON(
		w,
		http.StatusOK,
		map[string]any{
			"access_token": accessToken,
			"user": map[string]string{
				"user_id":  user.ID.String(),
				"username": user.Username,
				"email":    user.Email,
			},
		},
	)
}
