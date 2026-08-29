"use client";

import { useEffect } from "react";

import {
  useMessages,
  useMessagesLoading,
  useSelectedConversationID,
} from "../store/selectors";

import { loadMessages } from "../store/actions";

export function useConversationMessages() {
  const conversationID = useSelectedConversationID();

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
