package endpoints

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/AliKefall/prothea/internal/auth"
	"github.com/AliKefall/prothea/internal/database"
	"github.com/AliKefall/prothea/internal/utils"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

func (deps *Deps) RefreshHandler(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	now := time.Now()

	cookie, err := r.Cookie("refresh_token")
	if err != nil {
		utils.RespondWithError(
			w,
			http.StatusUnauthorized,
			"refresh_error",
			"Missing refresh token",
			"",
			nil,
		)
		return
	}

	hash := sha256.Sum256([]byte(cookie.Value))
	refreshHash := hex.EncodeToString(hash[:])

	blacklisted, err := deps.RedisClient.Get(
		ctx,
		"bl:"+refreshHash,
	).Result()

	if err != nil && !errors.Is(err, redis.Nil) {
		utils.RespondWithError(
			w,
			http.StatusInternalServerError,
			"redis_error",
			"Redis read failed",
			"",
			err,
		)
		return
	}

	if blacklisted == "1" {
		clearRefreshToken(w, r)

		utils.RespondWithError(
			w,
			http.StatusUnauthorized,
			"token_reuse",
			"Token reuse detected",
			"",
			nil,
		)
		return
	}

	tx, err := deps.DB.BeginTx(ctx, nil)
	if err != nil {
		utils.RespondWithError(
			w,
			http.StatusInternalServerError,
			"transaction_error",
			"Transaction failed on refresh endpoint",
			"",
			err,
		)
		return
	}

	defer tx.Rollback()

	qtx := deps.Queries.WithTx(tx)

	session, err := qtx.GetSessionForUpdateByTokenHash(
		ctx,
		refreshHash,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			clearRefreshToken(w, r)

			utils.RespondWithError(
				w,
				http.StatusUnauthorized,
				"invalid_refresh_token",
				"Invalid refresh token",
				"",
				nil,
			)
			return
		}

		utils.RespondWithError(
			w,
			http.StatusInternalServerError,
			"database_error",
			"Database error",
			"",
			err,
		)
		return
	}

	if session.RevokedAt.Valid {
		clearRefreshToken(w, r)

		utils.RespondWithError(
			w,
			http.StatusUnauthorized,
			"session_revoked",
			"Session revoked",
			"",
			nil,
		)
		return
	}

	if now.After(session.MaxExpiresAt) {
		clearRefreshToken(w, r)

		utils.RespondWithError(
			w,
			http.StatusUnauthorized,
			"session_expired",
			"Session lifetime exceeded",
			"",
			nil,
		)
		return
	}

	if err := qtx.RevokeSession(
		ctx,
		database.RevokeSessionParams{
			ID: session.ID,
			RevokedAt: sql.NullTime{
				Time:  now,
				Valid: true,
			},
		},
	); err != nil {
		utils.RespondWithError(
			w,
			http.StatusInternalServerError,
			"session_error",
			"Failed to revoke session",
			"",
			err,
		)
		return
	}

	newRefresh, err := auth.MakeRefreshToken()
	if err != nil {
		utils.RespondWithError(
			w,
			http.StatusInternalServerError,
			"token_error",
			"Token generation failed",
			"",
			err,
		)
		return
	}

	newHash := sha256.Sum256([]byte(newRefresh))
	newRefreshHash := hex.EncodeToString(newHash[:])

	newSessionID := uuid.New()

	refreshTTL := 7 * 24 * time.Hour
	newExpires := now.Add(refreshTTL)

	_, err = qtx.CreateSession(
		ctx,
		database.CreateSessionParams{
			ID:               newSessionID,
			UserID:           session.UserID,
			RefreshTokenHash: newRefreshHash,
			UserAgent:        session.UserAgent,
			IpAddress:        session.IpAddress,
			CreatedAt:        now,
			ExpiresAt:        newExpires,
			MaxExpiresAt:     session.MaxExpiresAt,
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
		session.UserID.String(),
		newSessionID.String(),
	)

	if err != nil {
		utils.RespondWithError(
			w,
			http.StatusInternalServerError,
			"jwt_error",
			"JWT generation failed",
			"",
			err,
		)
		return
	}

	if err := tx.Commit(); err != nil {
		utils.RespondWithError(
			w,
			http.StatusInternalServerError,
			"transaction_error",
			"Commit failed",
			"",
			err,
		)
		return
	}

	ttl := time.Until(newExpires)

	if err := deps.RedisClient.Set(
		ctx,
		"bl:"+refreshHash,
		"1",
		ttl,
	).Err(); err != nil {
		// DB refresh başarılı olduğu için burada request'i
		// başarısız saymıyoruz, fakat loglamalıyız.
		log.Printf(
			"failed to blacklist old refresh token: %v",
			err,
		)
	}

	if err := deps.RedisClient.Del(
		ctx,
		"sess:"+refreshHash,
	).Err(); err != nil {
		log.Printf(
			"failed to delete old session cache: %v",
			err,
		)
	}

	if err := deps.RedisClient.Set(
		ctx,
		"sess:"+newRefreshHash,
		session.UserID.String(),
		ttl,
	).Err(); err != nil {
		log.Printf(
			"failed to cache new session: %v",
			err,
		)
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    newRefresh,
		HttpOnly: true,
		Secure:   utils.ShouldUseSecureCookie(r),
		SameSite: http.SameSiteLaxMode,
		Path:     "/",
		Expires:  newExpires,
	})

	utils.RespondWithJSON(
		w,
		http.StatusOK,
		map[string]string{
			"access_token": accessToken,
		},
	)
}

func clearRefreshToken(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
	})

}
