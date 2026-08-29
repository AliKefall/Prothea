import { friendsActions } from "../store/actions";

import type {
  Friend,
  FriendRequest,
} from "../store/types";

export function handleFriendOnline(friendId: string) {
  friendsActions.updateFriend(friendId, {
    online: true,
  });
}

export function handleFriendOffline(friendId: string) {
  friendsActions.updateFriend(friendId, {
    online: false,
  });
}

export function handleFriendRequestReceived(
  request: FriendRequest,
) {
  friendsActions.addIncomingRequest(request);
}

export function handleFriendRequestAccepted(
  friend: Friend,
) {
  friendsActions.removeOutgoingRequest(friend.id);
  friendsActions.addFriend(friend);
}

export function handleFriendRequestRejected(
  userId: string,
) {
  friendsActions.removeOutgoingRequest(userId);
}
