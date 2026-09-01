import { http } from "@/lib/http";

import type {
  ChatMessage,
  Conversation,
  ConversationMember,
} from "../store/types";

export async function getConversations(): Promise<Conversation[]> {
  const response = await http.get<Conversation[]>(
    "/chat/conversations",
  );

  return response.data;
}

export async function getConversationMembers(
  conversationID: string,
): Promise<ConversationMember[]> {
  const response = await http.get<ConversationMember[]>(
    `/chat/conversations/${conversationID}/members`,
  );

  return response.data;
}

export async function getConversationMessages(
  conversationID: string,
  limit = 50,
  offset = 0,
): Promise<ChatMessage[]> {
  const response = await http.get<ChatMessage[]>(
    `/chat/conversations/${conversationID}/messages`,
    {
      params: {
        limit,
        offset,
      },
    },
  );

  return response.data;
}

export async function createDirectConversation(
  recipientID: string,
): Promise<Conversation> {
  const response = await http.post<Conversation>(
    "/chat/conversations/direct",
    {
      recipient_id: recipientID,
    },
  );

  return response.data;
}
