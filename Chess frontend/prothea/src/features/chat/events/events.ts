import type { WebSocketMessage } from "@/lib/dispatcher";

import type {
  ChatErrorPayload,
  ChatMessageEvent,
  SendMessagePayload,
} from "../store/types";

export const CHAT_EVENT = {
  SEND: "chat_send",
  MESSAGE: "chat_message",
  ERROR: "chat_error",
} as const;

export type ChatEventType =
  (typeof CHAT_EVENT)[keyof typeof CHAT_EVENT];

export type ChatSendEvent =
  WebSocketMessage<SendMessagePayload> & {
    type: typeof CHAT_EVENT.SEND;
  };

export type ChatMessageReceivedEvent =
  WebSocketMessage<ChatMessageEvent> & {
    type: typeof CHAT_EVENT.MESSAGE;
  };

export type ChatErrorEvent =
  WebSocketMessage<ChatErrorPayload> & {
    type: typeof CHAT_EVENT.ERROR;
  };
