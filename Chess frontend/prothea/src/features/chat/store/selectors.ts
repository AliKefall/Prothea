import { useChatStore } from "./chat-store";
import type { ChatMessage } from "./types";

const EMPTY_MESSAGES: ChatMessage[] = [];

export const useMessages = (conversationID: string | null) =>
  useChatStore((state) => {
    if (!conversationID) {
      return EMPTY_MESSAGES;
    }

    return state.messages[conversationID] ?? EMPTY_MESSAGES;
  });

export const useConversations = () =>
  useChatStore((state) => state.conversations);

export const useSelectedConversationID = () =>
  useChatStore((state) => state.selectedConversationID);

export const useSelectedConversation = () =>
  useChatStore((state) => {
    const conversationID = state.selectedConversationID;

    if (!conversationID) {
      return null;
    }

    return (
      state.conversations.find(
        (conversation) => conversation.id === conversationID,
      ) ?? null
    );
  });

export const useConversationsLoading = () =>
  useChatStore((state) => state.conversationsLoading);

export const useMessagesLoading = () =>
  useChatStore((state) => state.messagesLoading);

export const useChatError = () =>
  useChatStore((state) => state.error);
