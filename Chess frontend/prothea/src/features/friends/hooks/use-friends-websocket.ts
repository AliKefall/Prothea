"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { useAuthStore } from "@/features/auth/auth-store";
import { websocketManager } from "@/lib/websocket";

import { friendsActions } from "../store/actions";
import type { Friend, FriendRequest } from "../store/types";

const FRIEND_EVENT_REQUEST = "friend_request";
const FRIEND_EVENT_ACCEPTED = "friendship_accepted";
const FRIEND_EVENT_REJECTED = "friendship_rejected";

type FriendEventPayload = FriendRequest & Partial<Pick<Friend, "online" | "inGame">>;

export function useFriendsWebSocket() {
  const accessToken = useAuthStore((state) => state.accessToken);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    websocketManager.connect(accessToken);

    return websocketManager.subscribe((message) => {
      const payload = message.payload as FriendEventPayload;

      if (!payload?.id || !payload.username) {
        return;
      }

      if (message.type === FRIEND_EVENT_REQUEST) {
        friendsActions.addIncomingRequest(payload);
        toast.info(`${payload.username} sent you a friend request`);
      }

      if (message.type === FRIEND_EVENT_ACCEPTED) {
        friendsActions.removeIncomingRequest(payload.id);
        friendsActions.removeOutgoingRequest(payload.id);
        friendsActions.addFriend({
          id: payload.id,
          username: payload.username,
          online: payload.online ?? true,
          inGame: payload.inGame ?? false,
        });
        toast.success(`${payload.username} is now your friend`);
      }

      if (message.type === FRIEND_EVENT_REJECTED) {
        friendsActions.removeOutgoingRequest(payload.id);
        toast.info(`${payload.username} rejected your friend request`);
      }
    });
  }, [accessToken]);
}
