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
const FRIEND_EVENT_ONLINE = "friend_online";
const FRIEND_EVENT_OFFLINE = "friend_offline";

type FriendEventPayload = FriendRequest & Partial<Pick<Friend, "online">> & { in_game?: boolean };

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

      if (message.type === FRIEND_EVENT_ONLINE || message.type === FRIEND_EVENT_OFFLINE) {
        friendsActions.updateFriend(payload.id, { online: message.type === FRIEND_EVENT_ONLINE });
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
          inGame: payload.in_game ?? false,
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
