package friends

import "errors"

var (
	ErrSelfRequest = errors.New("can not send friend request to yourself")

	ErrAlreadyFriends = errors.New("users are already friends")

	ErrRequestAlreadyExists = errors.New("friend request already exists")

	ErrFriendRequestNotFound = errors.New("friend request not found")

	ErrFriendshipNotFound = errors.New("friendship not found")

	ErrUserNotFound = errors.New("user not found ")
)
