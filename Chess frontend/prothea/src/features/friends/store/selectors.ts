import { useShallow } from "zustand/react/shallow";

import { useFriendsStore } from "./store";

export const useFriendsList = () =>
  useFriendsStore((state) => state.friends);

export const useOnlineFriends = () =>
  useFriendsStore(
    useShallow((state) =>
      state.friends.filter((friend) => friend.online),
    ),
  );

export const useOfflineFriends = () =>
  useFriendsStore(
    useShallow((state) =>
      state.friends.filter((friend) => !friend.online),
    ),
  );

export const useIncomingRequests = () =>
  useFriendsStore((state) => state.incomingRequests);

export const useOutgoingRequests = () =>
  useFriendsStore((state) => state.outgoingRequests);

export const useIncomingRequestCount = () =>
  useFriendsStore((state) => state.incomingRequests.length);

export const useOutgoingRequestCount = () =>
  useFriendsStore((state) => state.outgoingRequests.length);
