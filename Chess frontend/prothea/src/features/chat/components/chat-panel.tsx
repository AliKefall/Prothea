"use client";

import { SyntheticEvent, useEffect, useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";

import { useAuthStore } from "@/features/auth/auth-store";

import { loadConversations, sendMessage } from "../store/actions";

import { useChatError, useSelectedConversation } from "../store/selectors";

import { useConversationMessages } from "../hooks/use-messages";
import { useChatWebSocket } from "../store/use-chat-websocket";

import { MessageBubble } from "./message-bubble";

export function ChatPanel() {
  const user = useAuthStore((state) => state.user);

  const selectedConversation = useSelectedConversation();
  const error = useChatError();

  const { messages, loading: messagesLoading } = useConversationMessages();

  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [minimized, setMinimized] = useState(false);

  useChatWebSocket();

  useEffect(() => {
    void loadConversations();
  }, []);

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedConversation) {
      return;
    }

    if (selectedConversation.type !== "direct") {
      return;
    }

    if (!selectedConversation.recipient_id) {
      return;
    }

    const trimmedContent = content.trim();

    if (!trimmedContent) {
      return;
    }

    try {
      setSending(true);

      sendMessage(selectedConversation.recipient_id, trimmedContent);

      setContent("");
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  }

  if (!selectedConversation) {
    return null;
  }

  return (
    <div
      className={[
        "fixed bottom-0 left-15 z-50 flex w-80 flex-col",
        "overflow-hidden rounded-t-xl border bg-background shadow-2xl",
      ].join(" ")}
    >
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold"></h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500" />

          <button
            type="button"
            onClick={() => setMinimized((value) => !value)}
            aria-label={minimized ? "Expand chat" : "Minimize chat"}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {minimized ? (
              <ChevronUpIcon className="h-4 w-4" />
            ) : (
              <ChevronDownIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </header>

      {!minimized && (
        <>
          {/* Error */}
          {error && (
            <div className="border-b px-3 py-2 text-xs text-destructive">
              {error.message}
            </div>
          )}

          {/* Messages */}
          <div className="flex h-80 flex-col gap-2 overflow-y-auto p-3">
            {messagesLoading ? (
              <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
                Loading...
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
                No messages yet.
              </div>
            ) : (
              messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isOwnMessage={message.sender_id === user?.user_id}
                />
              ))
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="flex shrink-0 gap-2 border-t p-2"
          >
            <input
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Write a message..."
              maxLength={500}
              disabled={sending}
              className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-xs outline-none focus:ring-2"
            />

            <button
              type="submit"
              disabled={
                sending || !content.trim() || !selectedConversation.recipient_id
              }
              className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </>
      )}
    </div>
  );
}
