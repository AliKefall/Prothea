import { websocketManager } from "@/lib/websocket";

import {
  getConversationMessages,
  getConversations,
} from "../api/chat-api";

import { CHAT_EVENT } from "../events/events";

import {
  ChatErrorPayload,
  SendMessagePayload,
} from "./types";

import { useChatStore } from "./chat-store";

export async function loadConversations(): Promise<void> {
  const store = useChatStore.getState();

  store.setConversationsLoading(true);
  store.setError(null);

  try {
    const conversations = await getConversations();

    store.setConversations(conversations);
  } catch (error) {
    console.error(
      "Failed to load conversations:",
      error,
    );

    const chatError: ChatErrorPayload = {
      code: "load_conversations_failed",
      message: "Could not load conversations",
    };

    store.setError(chatError);
  } finally {
    store.setConversationsLoading(false);
  }
}

export async function loadMessages(
  conversationID: string,
): Promise<void> {
  const store = useChatStore.getState();

  store.setMessagesLoading(true);
  store.setError(null);

  try {
    const messages = await getConversationMessages(
      conversationID,
    );

    store.setMessages(conversationID, messages);
  } catch (error) {
    console.error(
      "Failed to load messages:",
      error,
    );

    const chatError: ChatErrorPayload = {
      code: "load_messages_failed",
      message: "Could not load messages",
    };

    store.setError(chatError);
  } finally {
    store.setMessagesLoading(false);
  }
}

export function selectConversation(
  conversationID: string | null,
): void {
  useChatStore
    .getState()
    .selectConversation(conversationID);
}

export function sendMessage(
  recipientID: string,
  content: string,
): void {
  const payload: SendMessagePayload = {
    recipient_id: recipientID,
    content: content.trim(),
  };

  if (!payload.content) {
    return;
  }

  websocketManager.send(
    CHAT_EVENT.SEND,
    payload,
  );
}

export function clearChat(): void {
  useChatStore.getState().clear();
}
