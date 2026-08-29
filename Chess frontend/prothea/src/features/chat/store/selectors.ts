import { useChatStore } from "./chat-store";

export const useConversations = () =>
  useChatStore((state) => state.conversations);

export const useMessages = (conversationID: string | null) =>
  useChatStore((state) =>
    conversationID
      ? state.messages[conversationID] ?? []
      : [],
  );

export const useSelectedConversationID = () =>
  useChatStore((state) => state.selectedConversationID);

export const useSelectedConversation = () =>
  useChatStore((state) => {
    if (!state.selectedConversationID) {
      return null;
    }

    return (
      state.conversations.find(
        (conversation) =>
          conversation.id === state.selectedConversationID,
      ) ?? null
    );
  });

export const useConversationsLoading = () =>
  useChatStore((state) => state.conversationsLoading);

export const useMessagesLoading = () =>
  useChatStore((state) => state.messagesLoading);

export const useChatError = () =>
  useChatStore((state) => state.error);
