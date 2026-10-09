package websocket

const (
	EventSendFriendshipRequest   EventType = "friend_request"
	EventAcceptFriendshipRequest EventType = "friendship_accepted"
	EventRejectFriendshipRequest EventType = "friendship_rejected"
	EventFriendOnline            EventType = "friend_online"
	EventFriendOffline           EventType = "friend_offline"
)
