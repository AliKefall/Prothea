package endpoints

import (
	"database/sql"
	"errors"
	"net/http"
	"strings"

	"github.com/AliKefall/prothea/internal/database"
	"github.com/AliKefall/prothea/internal/friends"
	"github.com/AliKefall/prothea/internal/utils"
	"github.com/google/uuid"
)

type AddFriendRequest struct {
	Username string `json:"username"`
}

type FriendResponse struct {
	ID       uuid.UUID `json:"id"`
	Username string    `json:"username"`
	Online   bool      `json:"online"`
}

type FriendListResponse struct {
	Friends []FriendResponse `json:"friends"`
}

type FriendRequestResponse struct {
	ID       uuid.UUID `json:"id"`
	Username string    `json:"username"`
}

type FriendRequestListResponse struct {
	Incoming []FriendRequestResponse `json:"incoming"`
	Outgoing []FriendRequestResponse `json:"outgoing"`
}

func (deps *Deps) mustUserID(r *http.Request) (uuid.UUID, error) {
	value := r.Context().Value(UserIDKey)

	userID, ok := value.(uuid.UUID)
	if !ok {
		return uuid.Nil, errors.New("user id not found in context")
	}

	return userID, nil
}

func mapIncomingRequests(
	users []database.ListIncomingFriendRequestsByUserIDRow,
) []FriendRequestResponse {
	result := make([]FriendRequestResponse, 0, len(users))

	for _, u := range users {
		result = append(result, FriendRequestResponse{
			ID:       u.ID,
			Username: u.Username,
		})
	}

	return result
}

func mapOutgoingRequests(
	users []database.ListOutgoingFriendRequestsByUserIDRow,
) []FriendRequestResponse {
	result := make([]FriendRequestResponse, 0, len(users))

	for _, u := range users {
		result = append(result, FriendRequestResponse{
			ID:       u.ID,
			Username: u.Username,
		})
	}
	return result
}

// Listing friends

func (deps *Deps) HandleListFriends(w http.ResponseWriter, r *http.Request) {
	uid, err := deps.mustUserID(r)
	if err != nil {
		utils.RespondWithError(
			w,
			http.StatusUnauthorized,
			"unauthorized",
			"unauthorized",
			"",
			err,
		)
		return
	}

	friendList, err := deps.Queries.ListFriendsByUserID(r.Context(), uid)
	if err != nil {
		utils.RespondWithError(
			w,
			http.StatusInternalServerError,
			"database_error",
			"Could not load friends",
			"",
			err,
		)
		return
	}

	resp := make([]FriendResponse, 0, len(friendList))

	for _, friend := range friendList {
		resp = append(resp, FriendResponse{
			ID:       friend.ID,
			Username: friend.Username,
			Online:   true, // Hardcoded at the moment this will change with a hybrid model.
		})
	}

	utils.RespondWithJSON(w, http.StatusOK, FriendListResponse{
		Friends: resp,
	})
}
// List friend requests

func (deps *Deps) HandleListFriendRequests(
	w http.ResponseWriter,
	r *http.Request,
) {
	userID, err := deps.mustUserID(r)
	if err != nil {
		utils.RespondWithError(
			w,
			http.StatusUnauthorized,
			"unauthorized",
			"Unauthorized",
			"",
			err,
		)
		return
	}

	requests, err := deps.Friends.ListRequests(
		r.Context(),
		userID,
	)
	if err != nil {
		utils.RespondWithError(
			w,
			http.StatusInternalServerError,
			"database_error",
			"Could not load friend requests",
			"",
			err,
		)
		return
	}

	incoming := make(
		[]FriendRequestResponse,
		0,
		len(requests.Incoming),
	)

	for _, request := range requests.Incoming {
		incoming = append(incoming, FriendRequestResponse{
			ID:       request.ID,
			Username: request.Username,
		})
	}

	outgoing := make(
		[]FriendRequestResponse,
		0,
		len(requests.Outgoing),
	)

	for _, request := range requests.Outgoing {
		outgoing = append(outgoing, FriendRequestResponse{
			ID:       request.ID,
			Username: request.Username,
		})
	}

	utils.RespondWithJSON(
		w,
		http.StatusOK,
		FriendRequestListResponse{
			Incoming: incoming,
			Outgoing: outgoing,
		},
	)
}


//
func (deps *Deps) HandleSendFriendRequest(w http.ResponseWriter, r *http.Request) {
	uid, err := deps.mustUserID(r)
	if err != nil {
		utils.RespondWithError(
			w,
			http.StatusUnauthorized,
			"unauthorized",
			"unauthorized",
			"",
			err,
		)
		return
	}

	var req AddFriendRequest

	utils.DecodeJSON(w, r, &req)

	req.Username = strings.TrimSpace(req.Username)

	if req.Username == "" {
		utils.RespondWithError(
			w,
			http.StatusBadRequest,
			"friends_error",
			"Username is required",
			"",
			err,
		)
		return
	}

	target, err := deps.Queries.GetUserByUsername(
		r.Context(),
		req.Username,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			utils.RespondWithError(
				w,
				http.StatusNotFound,
				"friends_error",
				"user not found",
				"",
				err,
			)
			return
		}
		utils.RespondWithError(
			w,
			http.StatusInternalServerError,
			"database_error",
			"Could not load user",
			"",
			err,
		)
		return
	}

	err = deps.Friends.SendFriendRequest(r.Context(), uid, target.ID)

	if err != nil {
		switch {
		case errors.Is(err, friends.ErrSelfRequest):
			utils.RespondWithError(
				w,
				http.StatusBadRequest,
				"friends_error",
				"You cannot add yourself",
				"",
				nil,
			)
		case errors.Is(err, friends.ErrAlreadyFriends):
			utils.RespondWithError(
				w,
				http.StatusConflict,
				"friends_error",
				"You are already friends",
				"",
				nil,
			)

		case errors.Is(err, friends.ErrRequestAlreadyExists):
			utils.RespondWithError(
				w,
				http.StatusConflict,
				"friends_error",
				"Friend request already exists",
				"",
				nil,
			)
		default:
			utils.RespondWithError(
				w,
				http.StatusInternalServerError,
				"database_error",
				"Could not create friend request",
				"",

				err,
			)
		}
		return
	}

	utils.RespondWithJSON(
		w,
		http.StatusCreated,
		map[string]string{
			"message": "friend request created",
		},
	)
}

func (deps *Deps) HandleAcceptFriendRequest(w http.ResponseWriter, r *http.Request) {
	accepterID, err := deps.mustUserID(r)
	if err != nil {
		utils.RespondWithError(
			w,
			http.StatusUnauthorized,
			"unauthorized",
			"unauthorized",
			"",
			err,
		)
		return
	}

	requesterID, err := uuid.Parse(r.PathValue("user_id"))
	if err != nil {
		utils.RespondWithError(
			w,
			http.StatusBadRequest,
			"friends_error",
			"Invalid user id",
			"",
			err,
		)
		return
	}

	err = deps.Friends.AcceptFriendRequest(
		r.Context(),
		accepterID,
		requesterID,
	)
	if err != nil {
		switch {

		case errors.Is(err, friends.ErrSelfRequest):
			utils.RespondWithError(
				w,
				http.StatusConflict,
				"friends_error",
				"you can not accept your own request",
				"",
				err,
			)

		case errors.Is(err, friends.ErrAlreadyFriends):
			utils.RespondWithError(
				w,
				http.StatusConflict,
				"friends_error",
				"you are already friends",
				"",
				err,
			)

		default:
			utils.RespondWithError(
				w,
				http.StatusInternalServerError,
				"database_error",
				"could not accept friend request",
				"",
				err,
			)
			return
		}
	}

	utils.RespondWithJSON(
    w,
    http.StatusOK,
    map[string]string{
        "message": "friend request accepted",
    },
)
}

func (deps *Deps) HandleRejectFriendRequest(w http.ResponseWriter, r *http.Request) {
	rejecterID, err := deps.mustUserID(r)
	if err != nil {
		utils.RespondWithError(
			w,
			http.StatusUnauthorized,
			"unauthorized",
			"unauthorized",
			"",
			err,
		)
		return
	}

	requesterID, err := uuid.Parse(r.PathValue("user_id"))
	if err != nil {
		utils.RespondWithError(
			w,
			http.StatusBadRequest,
			"friends_error",
			"invalid user id",
			"",
			err,
		)
		return
	}

	err = deps.Friends.RejectFriendRequest(r.Context(), rejecterID, requesterID)
	if err != nil {
		switch {
		case errors.Is(err, friends.ErrSelfRequest):
			utils.RespondWithError(
				w,
				http.StatusBadRequest,
				"friends_error",
				"you can not reject your own request",
				"",
				nil,
			)
		case errors.Is(err, friends.ErrFriendRequestNotFound):
			utils.RespondWithError(
				w,
				http.StatusNotFound,
				"friends_error",
				"friend request not found",
				"",
				nil,
			)
			return
		default:
			utils.RespondWithError(
				w,
				http.StatusInternalServerError,
				"database_error",
				"could not reject friend request",
				"",
				err,
			)
		}
		return
	}

	utils.RespondWithJSON(
		w,
		http.StatusOK,
		map[string]string{
			"message": "friend request rejected",
		},
	)

}
