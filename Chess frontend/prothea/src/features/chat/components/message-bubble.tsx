"use client";

import type { ChatMessage } from "../store/types";

interface MessageBubbleProps {
  message: ChatMessage;
  isOwnMessage: boolean;
}

export function MessageBubble({
  message,
  isOwnMessage,
}: MessageBubbleProps) {
  const createdAt = new Date(message.created_at);

  const formattedTime = createdAt.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={[
        "flex w-full",
        isOwnMessage ? "justify-end" : "justify-start",
      ].join(" ")}
    >
      <div
        className={[
          "max-w-[75%] rounded-lg px-3 py-2",
          isOwnMessage
            ? "bg-primary text-primary-foreground"
            : "bg-muted",
        ].join(" ")}
      >
        <p className="whitespace-pre-wrap break-words text-sm">
          {message.content}
        </p>

        <div
          className={[
            "mt-1 text-[10px]",
            isOwnMessage
              ? "text-primary-foreground/70"
              : "text-muted-foreground",
          ].join(" ")}
        >
          {formattedTime}

          {message.edited_at && " · edited"}
        </div>
      </div>
    </div>
  );
}
