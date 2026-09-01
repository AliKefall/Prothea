package endpoints

import (
	"encoding/json"
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
	ID          string    `json:"id"`
	Type        string    `json:"type"`
	RecipientID string    `json:"recipient_id,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

type ConversationMemberResponse struct {
	ID       string `json:"id"`
	Username string `json:"username"`
}

type CreateDirectConversationRequest struct {
	RecipientID string `json:"recipient_id"`
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

func toConversationResponse(
	c database.ListConversationsRow,
) ConversationResponse {
	return ConversationResponse{
		ID:          c.ID.String(),
		Type:        string(c.Type),
		RecipientID: c.RecipientID.String(),
		CreatedAt:   c.CreatedAt,
	}
}

func (deps *Deps) HandleCreateDirectConversation(
	w http.ResponseWriter,
	r *http.Request,
) {
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

	var req CreateDirectConversationRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondWithError(
			w,
			http.StatusBadRequest,
			"chat_error",
			"invalid request body",
			"",
			err,
		)
		return
	}

	recipientID, err := uuid.Parse(req.RecipientID)

	if err != nil || recipientID == uuid.Nil {
		utils.RespondWithError(
			w,
			http.StatusBadRequest,
			"chat_error",
			"recipient_id is invalid",
			"",
			err,
		)
		return
	}

	conversation, err := deps.Chat.GetOrCreateDirectConversation(
		r.Context(),
		userID,
		recipientID,
	)

	if err != nil {
		utils.RespondWithError(
			w,
			http.StatusInternalServerError,
			"chat_error",
			"could not create conversation",
			"",
			err,
		)
		return
	}

	utils.RespondWithJSON(
		w,
		http.StatusOK,
		ConversationResponse{
			ID:          conversation.ID.String(),
			Type:        string(conversation.Type),
			RecipientID: recipientID.String(),
			CreatedAt:   conversation.CreatedAt,
		},
	)
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

	isMember, err := deps.Chat.IsConversationMember(
		r.Context(),
		conversationID,
		userID,
	)

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

func (deps *Deps) HandleConversationMembers(
	w http.ResponseWriter,
	r *http.Request,
) {
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

	conversationID, err := uuid.Parse(
		chi.URLParam(r, "conversationID"),
	)

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

	isMember, err := deps.Chat.IsConversationMember(
		r.Context(),
		conversationID,
		userID,
	)

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

	members, err := deps.Chat.GetConversationMember(
		r.Context(),
		conversationID,
	)

	if err != nil {
		utils.RespondWithError(
			w,
			http.StatusInternalServerError,
			"database_error",
			"could not load conversation members",
			"",
			err,
		)
		return
	}

	response := make(
		[]ConversationMemberResponse,
		0,
		len(members),
	)

	for _, member := range members {
		response = append(
			response,
			ConversationMemberResponse{
				ID:       member.ID.String(),
				Username: member.Username,
			},
		)
	}

	utils.RespondWithJSON(
		w,
		http.StatusOK,
		response,
	)
}

func parsePagination(
	r *http.Request,
	defaultLimit int32,
	maxLimit int32,
) (int32, int32) {
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
