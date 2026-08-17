package endpoints

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/AliKefall/prothea/internal/database"
	"github.com/AliKefall/prothea/internal/utils"
	"github.com/AliKefall/prothea/internal/validation"
	"github.com/google/uuid"
	"github.com/jackc/pgconn"
)

type RegisterRequest struct {
	Email    string `json:"email"`
	Username string `json:"username"`
	Password string `json:"password"`
}

func (deps *Deps) HandlerRegister(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var req RegisterRequest

	if err := utils.DecodeJSON(
		w,
		r,
		&req,
	); err != nil {
		utils.RespondWithError(w, http.StatusInternalServerError, "json_error", "Could not parse json", "", err)
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Username = strings.TrimSpace(req.Username)

	err := validation.ValidateRegister(req.Email, req.Username, req.Password)
	if err != nil {
		utils.RespondWithError(w, http.StatusBadRequest, "validation_error", "Broken parameters for register", "", err)
		return
	}

	hashed, err := deps.Hasher.Hash(req.Password)
	if err != nil {
		utils.RespondWithError(w, http.StatusInternalServerError, "hasher_error", "Could not hash the given password", "", err)
		return
	}

	tx, err := deps.DB.BeginTx(ctx, nil)
	if err != nil {
		utils.RespondWithError(w, http.StatusInternalServerError, "register_error", "Transaction could not be started", "", err)
		return
	}

	defer tx.Rollback()

	tsx := deps.Queries.WithTx(tx)

	userID := uuid.New()
	_, err = tsx.CreateUser(ctx, database.CreateUserParams{
		ID:        userID,
		Username:  req.Username,
		Email:     req.Email,
		Password:  hashed,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	})

	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) {
			if pgErr.Code == "23505" { // Unique constraint violation code
				switch pgErr.ConstraintName {

				case "users_email_key":
					utils.RespondWithError(w, http.StatusConflict, "conflict_error", "Email already in use", "", nil)
					return

				case "users_username_key":
					utils.RespondWithError(w, http.StatusConflict, "conflict_error", "Username already in use", "", nil)
					return

				default:
					utils.RespondWithError(w, http.StatusConflict, "conflict_error", "User already exists", "", nil)
				}
			}
		}
	}

	err = tsx.CreatePlayerRatings(ctx, userID)
	if err != nil {
		utils.RespondWithError(w, http.StatusInternalServerError, "rating_error", "user ratings could not be created", "", err)
		return
	}

	tx.Commit()

	if err := tx.Commit(); err != nil {
		utils.RespondWithError(w, http.StatusInternalServerError, "transaction_error", "Commit failed", "", err)
		return
	}

	utils.RespondWithJSON(w, http.StatusCreated, map[string]string{
		"message": "user created",
	})

}
