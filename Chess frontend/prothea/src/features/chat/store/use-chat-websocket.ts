"use client";

import { useEffect } from "react";

import { useAuthStore } from "@/features/auth/auth-store";
import {
  CHAT_EVENT_MESSAGE,
  ChatMessageEvent,
  ChatMessageWebSocketEvent,
} from "./types";
import { useChatStore } from "./chat-store";

import { websocketManager } from "@/lib/websocket";

export function useChatWebSocket() {
  const accessToken = useAuthStore((state) => state.accessToken);

  const addMessage = useChatStore((state) => state.addMessage);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    websocketManager.connect(accessToken);

    const unsubscribe = websocketManager.subscribe((message) => {
      if (message.type !== CHAT_EVENT_MESSAGE) {
        return;
      }

      const event = message as ChatMessageWebSocketEvent;

      const payload: ChatMessageEvent = event.payload;

      if (
        !payload.id ||
        !payload.conversation_id ||
        !payload.sender_id ||
        !payload.content
      ) {
        console.error("Invalid chat message payload:", payload);
        return;
      }

      addMessage(payload.conversation_id, {
        id: payload.id,
        conversation_id: payload.conversation_id,
        sender_id: payload.sender_id,
        content: payload.content,
        created_at: payload.created_at,
      });
    });

    return unsubscribe;
  }, [accessToken, addMessage]);
}
