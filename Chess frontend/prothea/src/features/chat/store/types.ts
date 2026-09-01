import { WebSocketMessage } from "@/lib/dispatcher";

export type ConversationType = "direct" | "group";

export interface Conversation {
  id: string;
  type: ConversationType;
  recipient_id?: string;
  created_at: string;
}

export interface ConversationMember {
  id: string;
  username: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  edited_at?: string;
}

export interface SendMessagePayload {
  recipient_id: string;
  content: string;
}

export interface ChatMessageEvent {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface ChatErrorPayload {
  code: string;
  message: string;
}

export const CHAT_EVENT_SEND = "chat_send" as const;
export const CHAT_EVENT_MESSAGE = "chat_message" as const;
export const CHAT_EVENT_ERROR = "chat_error" as const;

export type ChatSendWebSocketEvent = WebSocketMessage<SendMessagePayload> & {
  type: typeof CHAT_EVENT_SEND;
};

export type ChatMessageWebSocketEvent = WebSocketMessage<ChatMessageEvent> & {
  type: typeof CHAT_EVENT_MESSAGE;
};

export type ChatErrorWebSocketEvent = WebSocketMessage<ChatErrorPayload> & {
  type: typeof CHAT_EVENT_ERROR;
};
