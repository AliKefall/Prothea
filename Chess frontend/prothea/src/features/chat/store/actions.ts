import { websocketManager } from "@/lib/websocket";

import { createDirectConversation, getConversationMessages, getConversations } from "../api/chat-api";

import { CHAT_EVENT } from "../events/events";

import { ChatErrorPayload, SendMessagePayload } from "./types";

import { useChatStore } from "./chat-store";

export async function loadConversations(): Promise<void> {
  const store = useChatStore.getState();

  store.setConversationsLoading(true);
  store.setError(null);

  try {
    const conversations = await getConversations();

    store.setConversations(conversations);
  } catch (error) {
    console.error("Failed to load conversations:", error);

    store.setError({
      code: "load_conversations_failed",
      message: "Could not load conversations",
    });
  } finally {
    store.setConversationsLoading(false);
  }
}

export async function loadMessages(conversationID: string): Promise<void> {
  const store = useChatStore.getState();

  store.setMessagesLoading(true);
  store.setError(null);

  try {
    const messages = await getConversationMessages(conversationID);

    store.setMessages(conversationID, messages);
  } catch (error) {
    console.error("Failed to load messages:", error);

    store.setError({
      code: "load_messages_failed",
      message: "Could not load messages",
    });
  } finally {
    store.setMessagesLoading(false);
  }
}

export function selectConversation(conversationID: string | null): void {
  useChatStore.getState().selectConversation(conversationID);
}

export function sendMessage(recipientID: string, content: string): void {
  const trimmedContent = content.trim();

  if (!trimmedContent) {
    return;
  }

  const payload: SendMessagePayload = {
    recipient_id: recipientID,
    content: trimmedContent,
  };

  websocketManager.send(CHAT_EVENT.SEND, payload);
}

export function clearChat(): void {
  useChatStore.getState().clear();
}

export async function openDirectConversation(friendID: string): Promise<void> {
  const store = useChatStore.getState();

  try {
    store.setError(null);

    const conversation = await createDirectConversation(friendID);

    const conversations = store.conversations;

    const exists = conversations.some((item) => item.id === conversation.id);

    if (!exists) {
      store.setConversations([conversation, ...conversations]);
    }

    store.selectConversation(conversation.id);
  } catch (error) {
    console.error("Failed to open direct conversation:", error);

    store.setError({
      code: "open_conversation_failed",
      message: "Could not open conversation",
    });
  }
}
