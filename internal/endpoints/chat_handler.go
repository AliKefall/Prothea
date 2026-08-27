package endpoints

import (
	"net/http"
	"strconv"
	"time"

	"github.com/AliKefall/prothea/internal/database"
	"github.com/AliKefall/prothea/internal/utils"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type ChatMessageResponse struct {
	ID             string     `json:"id"`
	ConversationID string     `json:"conversation_id"`
	SenderID       string     `json:"sender_id"`
	Content        string     `json:"content"`
	CreatedAt      time.Time  `json:"created_at"`
	EditedAt       *time.Time `json:"edited_at,omitempty"`
}

type ConversationResponse struct {
	ID        string    `json:"id"`
	Type      string    `json:"type"`
	CreatedAt time.Time `json:"created_at"`
}

func toChatMessageReponse(m database.Message) ChatMessageResponse {
	response := ChatMessageResponse{
		ID:             m.ID.String(),
		ConversationID: m.ConversationID.String(),
		SenderID:       m.SenderID.String(),
		Content:        m.Content,
		CreatedAt:      m.CreatedAt,
	}
	if m.EditedAt.Valid {
		response.EditedAt = &m.EditedAt.Time
	}
	return response
}

func toConversationResponse(c database.Conversation) ConversationResponse {
	return ConversationResponse{
		ID:        c.ID.String(),
		Type:      string(c.Type),
		CreatedAt: c.CreatedAt,
	}
}

func (deps *Deps) HandleListConversations(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(UserIDKey).(uuid.UUID)
	if !ok || userID == uuid.Nil {
		utils.RespondWithError(w, http.StatusUnauthorized, "unauthorized", "invalid user context", "", nil)
		return
	}

	conversations, err := deps.Chat.ListConversations(
		r.Context(),
		userID,
	)

	if err != nil {
		utils.RespondWithError(w, http.StatusInternalServerError, "database_error", "could not load conversations", "", err)
		return
	}

	response := make([]ConversationResponse, 0, len(conversations))

	for _, conversation := range conversations {
		response = append(
			response,
			toConversationResponse(conversation),
		)
	}

	utils.RespondWithJSON(w, http.StatusOK, response)

}

func (deps *Deps) HandleConversationMessages(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(UserIDKey).(uuid.UUID)

	if !ok || userID == uuid.Nil {
		utils.RespondWithError(
			w,
			http.StatusUnauthorized,
			"unauthorized",
			"invalid user context",
			"",
			nil,
		)
		return
	}

	conversationID, err := uuid.Parse(chi.URLParam(r, "conversationID"))

	if err != nil {
		utils.RespondWithError(
			w,
			http.StatusBadRequest,
			"chat_error",
			"conversation id is invalid",
			"",
			err,
		)
		return
	}

	isMember, err := deps.Chat.IsConversationMember(r.Context(), conversationID, userID)

	if err != nil {
		utils.RespondWithError(
			w,
			http.StatusInternalServerError,
			"database_error",
			"could not verify conversation",
			"",
			err,
		)
		return
	}

	if !isMember {
		utils.RespondWithError(
			w,
			http.StatusForbidden,
			"forbidden",
			"You are not a member of this conversation",
			"",
			nil,
		)
		return
	}

	limit, offset := parsePagination(r, 50, 100)

	messages, err := deps.Chat.GetMessages(
		r.Context(),
		conversationID,
		limit,
		offset,
	)

	if err != nil {
		utils.RespondWithError(
			w,
			http.StatusInternalServerError,
			"database_error",
			"could not load messages",
			"",
			err,
		)
		return
	}

	response := make([]ChatMessageResponse, 0, len(messages))

	for _, message := range messages {
		response = append(response, toChatMessageReponse(message))
	}

	utils.RespondWithJSON(w, http.StatusOK, response)
}

func parsePagination(r *http.Request, defaultLimit int32, maxLimit int32) (int32, int32) {
	limit := defaultLimit
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if parsed, err := strconv.ParseInt(raw, 10, 32); err == nil && parsed > 0 {
			limit = int32(parsed)
		}
	}
	if limit > maxLimit {
		limit = maxLimit
	}

	var offset int32
	if raw := r.URL.Query().Get("offset"); raw != "" {
		if parsed, err := strconv.ParseInt(raw, 10, 32); err == nil && parsed > 0 {
			offset = int32(parsed)
		}
	}

	return limit, offset
}
