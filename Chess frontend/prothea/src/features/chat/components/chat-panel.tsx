"use client";

import { FormEvent, useEffect, useState } from "react";

import { useAuthStore } from "@/features/auth/auth-store";

import {
  loadConversations,
  selectConversation,
  sendMessage,
} from "../store/actions";

import {
  useChatError,
  useConversations,
  useConversationsLoading,
  useMessages,
  useSelectedConversation,
} from "../store/selectors";

import { useConversationMessages } from "../hooks/use-messages";
import { useChatWebSocket } from "../store/use-chat-websocket";

import { MessageBubble } from "./message-bubble";

export function ChatPanel() {
  const user = useAuthStore((state) => state.user);

  const conversations = useConversations();
  const conversationsLoading = useConversationsLoading();
  const selectedConversation = useSelectedConversation();
  const error = useChatError();

  const {
    conversationID,
    messages,
    loading: messagesLoading,
  } = useConversationMessages();

  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  useChatWebSocket();

  useEffect(() => {
    void loadConversations();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!conversationID) {
      return;
    }

    if (!user?.id) {
      return;
    }

    const trimmedContent = content.trim();

    if (!trimmedContent) {
      return;
    }

    try {
      setSending(true);

      await sendMessage(conversationID, user.id, trimmedContent);

      setContent("");
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden rounded-lg border bg-background">
      {/* Conversations */}
      <aside className="flex w-80 shrink-0 flex-col border-r">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold">Conversations</h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversationsLoading ? (
            <div className="p-4 text-sm text-muted-foreground">
              Loading conversations...
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              No conversations yet.
            </div>
          ) : (
            conversations.map((conversation) => {
              const isSelected = conversation.id === conversationID;

              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => selectConversation(conversation.id)}
                  className={[
                    "flex w-full items-center px-4 py-3 text-left",
                    "transition-colors hover:bg-muted",
                    isSelected ? "bg-muted" : "",
                  ].join(" ")}
                >
                  <div>
                    <div className="font-medium">
                      {conversation.type === "direct"
                        ? "Direct message"
                        : "Group"}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {conversation.id}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Chat */}
      <section className="flex min-w-0 flex-1 flex-col">
        {!selectedConversation ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Select a conversation
          </div>
        ) : (
          <>
            {/* Header */}
            <header className="shrink-0 border-b px-4 py-3">
              <h2 className="font-semibold">
                {selectedConversation.type === "direct"
                  ? "Direct message"
                  : "Group"}
              </h2>

              <p className="text-xs text-muted-foreground">
                {selectedConversation.id}
              </p>
            </header>

            {/* Error */}
            {error && (
              <div className="border-b px-4 py-2 text-sm text-destructive">
                {error.message}
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4">
              {messagesLoading ? (
                <div className="text-sm text-muted-foreground">
                  Loading messages...
                </div>
              ) : messages.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No messages yet.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      isOwnMessage={message.sender_id === user?.user_id}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Input */}
            <form
              onSubmit={handleSubmit}
              className="flex shrink-0 gap-2 border-t p-3"
            >
              <input
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Write a message..."
                maxLength={500}
                disabled={sending}
                className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2"
              />

              <button
                type="submit"
                disabled={sending || !content.trim() || !conversationID}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:pointer-events-none disabled:opacity-50"
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
