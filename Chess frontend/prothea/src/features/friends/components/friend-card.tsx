"use client";

import type { ReactNode } from "react";
import { UserIcon } from "@heroicons/react/24/outline";

import type { Friend } from "../store/types";

interface FriendCardProps {
  friend: Friend;
  onClick?: (friend: Friend) => void;
  rightSlot?: ReactNode;
}

export function FriendCard({
  friend,
  onClick,
  rightSlot,
}: FriendCardProps) {
  const isInteractive = Boolean(onClick);

  return (
    <div
      className="
        flex
        w-full
        items-center
        justify-between
        rounded-xl
        border
        border-zinc-800
        bg-zinc-900/60
        px-4
        py-3
        transition-colors
        hover:border-zinc-700
        hover:bg-zinc-900
      "
    >
      <button
        type="button"
        onClick={() => onClick?.(friend)}
        disabled={!isInteractive}
        className="
          flex
          min-w-0
          flex-1
          items-center
          gap-3
          text-left
          disabled:cursor-default
          disabled:opacity-100
          focus:outline-none
          focus-visible:ring-2
          focus-visible:ring-zinc-500
          focus-visible:ring-offset-2
          focus-visible:ring-offset-zinc-950
        "
      >
        {/* Avatar */}
        <div
          className="
            flex
            h-10
            w-10
            shrink-0
            items-center
            justify-center
            rounded-full
            border
            border-zinc-700
            bg-zinc-800
          "
        >
          <UserIcon className="h-5 w-5 text-zinc-400" />
        </div>

        {/* User information */}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-100">
            {friend.username}
          </p>

          <div className="mt-1 flex items-center gap-2">
            <span
              className={`
                h-2
                w-2
                shrink-0
                rounded-full
                ${friend.online ? "bg-emerald-500" : "bg-zinc-600"}
              `}
            />

            <span
              className={`
                text-xs
                ${
                  friend.online
                    ? "text-emerald-400"
                    : "text-zinc-500"
                }
              `}
            >
              {friend.online ? "Online" : "Offline"}
            </span>
          </div>
        </div>
      </button>

      {/* Optional right-side content */}
      {rightSlot && (
        <div className="ml-3 shrink-0">
          {rightSlot}
        </div>
      )}
    </div>
  );
}
