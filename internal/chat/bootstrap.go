package chat

import "github.com/google/uuid"

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

type FriendRequestResponse struct{
	ID uuid.UUID `json:"id"`
	Username string `json:"username"`
}

type FriendRequestListResponse struct{
	Incoming []FriendRequestResponse `json:"incoming"`
	Outgo
}
