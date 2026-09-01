"use client";

import { useEffect } from "react";

import {
  useMessages,
  useMessagesLoading,
  useSelectedConversationID,
  useConversations,
} from "../store/selectors";

import { loadMessages } from "../store/actions";

export function useConversationMessages() {
  const selectedID = useSelectedConversationID();
  const conversations = useConversations();

  const conversation = conversations.find(
    (item) => item.id === selectedID,
  );

  const conversationID = conversation?.id ?? null;

  const messages = useMessages(conversationID);
  const loading = useMessagesLoading();

  useEffect(() => {
    if (!conversationID) {
      return;
    }

    void loadMessages(conversationID);
  }, [conversationID]);

  return {
    conversationID,
    messages,
    loading,
  };
}
