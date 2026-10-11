"use client";

import { useState } from "react";
import { CheckIcon, UserPlusIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";

import { useAuthStore } from "@/features/auth/auth-store";
import { useAcceptFriendRequest } from "@/features/friends/hooks/use-accept-friend-request";
import { useFriends } from "@/features/friends/hooks/use-friends";
import { useSendFriendRequest } from "@/features/friends/hooks/use-send-friend-request";
import { useFriendsList, useIncomingRequests, useOutgoingRequests } from "@/features/friends/store/selectors";

export function PlayerFriendAction({ userId, username }: { userId: string; username: string }) {
  const currentUserId = useAuthStore((state) => state.user?.user_id);
  const { isLoading } = useFriends();
  const friends = useFriendsList();
  const incoming = useIncomingRequests();
  const outgoing = useOutgoingRequests();
  const sendRequest = useSendFriendRequest();
  const acceptRequest = useAcceptFriendRequest();
  const [error, setError] = useState<string | null>(null);

  if (currentUserId === userId) return null;

  const isFriend = friends.some((friend) => friend.id === userId);
  const hasIncomingRequest = incoming.some((request) => request.id === userId);
  const hasOutgoingRequest = outgoing.some((request) => request.id === userId);
  const isPending = sendRequest.isPending || acceptRequest.isPending;

  async function handleAction() {
    setError(null);
    try {
      if (hasIncomingRequest) {
        await acceptRequest.mutateAsync({ username });
        toast.success(`You are now friends with ${username}`);
      } else {
        await sendRequest.mutateAsync({ username });
        toast.success(`Friend request sent to ${username}`);
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not update friend request.";
      setError(message);
      toast.error(message);
    }
  }

  const label = isLoading
    ? "Loading…"
    : isFriend
      ? "Friends"
      : hasIncomingRequest
        ? "Accept request"
        : hasOutgoingRequest
          ? "Request sent"
          : "Add friend";

  return (
    <div className="flex flex-col items-start gap-2 sm:ml-auto sm:items-end">
      <button
        type="button"
        disabled={isLoading || isFriend || hasOutgoingRequest || isPending}
        onClick={() => void handleAction()}
        className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${isFriend || hasOutgoingRequest ? "border border-zinc-700 bg-zinc-900 text-zinc-300" : "bg-sky-300 text-zinc-950 hover:bg-sky-200"}`}
      >
        {isFriend ? <CheckIcon className="h-4 w-4" aria-hidden="true" /> : <UserPlusIcon className="h-4 w-4" aria-hidden="true" />}
        {isPending ? "Updating…" : label}
      </button>
      {error && <p role="alert" className="max-w-xs text-right text-xs text-red-300">{error}</p>}
    </div>
  );
}
