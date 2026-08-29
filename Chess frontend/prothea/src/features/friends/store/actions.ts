import { useFriendsStore } from "./store";

import type { Friend, FriendRequest } from "./types";

export const friendsActions = {
  setFriends(friends: Friend[]) {
    useFriendsStore.setState({
      friends,
    });
  },

  setIncomingRequests(requests: FriendRequest[]) {
    useFriendsStore.setState({
      incomingRequests: requests,
    });
  },

  setOutgoingRequests(requests: FriendRequest[]) {
    useFriendsStore.setState({
      outgoingRequests: requests,
    });
  },

  addFriend(friend: Friend) {
    useFriendsStore.setState((state) => {
      const exists = state.friends.some(
        (item) => item.id === friend.id,
      );

      if (exists) {
        return state;
      }

      return {
        friends: [...state.friends, friend],
      };
    });
  },

  removeFriend(friendId: string) {
    useFriendsStore.setState((state) => ({
      friends: state.friends.filter(
        (friend) => friend.id !== friendId,
      ),
    }));
  },

  updateFriend(
    friendId: string,
    updates: Partial<Friend>,
  ) {
    useFriendsStore.setState((state) => ({
      friends: state.friends.map((friend) =>
        friend.id === friendId
          ? {
              ...friend,
              ...updates,
            }
          : friend,
      ),
    }));
  },

  addIncomingRequest(request: FriendRequest) {
    useFriendsStore.setState((state) => {
      const exists = state.incomingRequests.some(
        (item) => item.id === request.id,
      );

      if (exists) {
        return state;
      }

      return {
        incomingRequests: [
          request,
          ...state.incomingRequests,
        ],
      };
    });
  },

  removeIncomingRequest(requestId: string) {
    useFriendsStore.setState((state) => ({
      incomingRequests:
        state.incomingRequests.filter(
          (request) => request.id !== requestId,
        ),
    }));
  },

  addOutgoingRequest(request: FriendRequest) {
    useFriendsStore.setState((state) => {
      const exists = state.outgoingRequests.some(
        (item) => item.id === request.id,
      );

      if (exists) {
        return state;
      }

      return {
        outgoingRequests: [
          request,
          ...state.outgoingRequests,
        ],
      };
    });
  },

  removeOutgoingRequest(requestId: string) {
    useFriendsStore.setState((state) => ({
      outgoingRequests:
        state.outgoingRequests.filter(
          (request) => request.id !== requestId,
        ),
    }));
  },

  clear() {
    useFriendsStore.setState({
      friends: [],
      incomingRequests: [],
      outgoingRequests: [],
    });
  },
};
