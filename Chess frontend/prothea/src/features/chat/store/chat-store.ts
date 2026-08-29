import { create } from "zustand";
import { ChatErrorPayload, ChatMessage, Conversation } from "./types";

export interface ChatState {
  conversations: Conversation[];
  messages: Record<string, ChatMessage[]>;

  selectedConversationID: string | null;

  conversationsLoading: boolean;
  messagesLoading: boolean;

  error: ChatErrorPayload | null;

  setConversations(conversations: Conversation[]): void;

  setMessages(conversationID: string, messages: ChatMessage[]): void;

  addMessage(conversationID: string, message: ChatMessage): void;

  selectConversation(conversationID: string | null): void;

  setConversationsLoading(loading: boolean): void;

  setMessagesLoading(loading: boolean): void;

  setError(error: ChatErrorPayload | null): void;

  clear(): void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  messages: {},

  selectedConversationID: null,

  conversationsLoading: false,
  messagesLoading: false,

  error: null,

  setConversations(conversations) {
    set({
      conversations,
    });
  },

  setMessages(conversationID, messages) {
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationID]: messages,
      },
    }));
  },

  addMessage(conversationID, message) {
    set((state) => {
      const existing = state.messages[conversationID] ?? [];

      if (existing.some((item) => item.id === message.id)) {
        return state;
      }

      return {
        messages: {
          ...state.messages,
          [conversationID]: [...existing, message],
        },
      };
    });
  },

  selectConversation(conversationID) {
    set({
      selectedConversationID: conversationID,
    });
  },

  setConversationsLoading(loading) {
    set({
      conversationsLoading: loading,
    });
  },

  setMessagesLoading(loading) {
    set({
      messagesLoading: loading,
    });
  },

  setError(error) {
    set({
      error,
    });
  },

  clear() {
    set({
      conversations: [],
      messages: {},
      selectedConversationID: null,
      conversationsLoading: false,
      messagesLoading: false,
      error: null,
    });
  },
}));
