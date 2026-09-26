"use client";

import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";

import { Button } from "@/components/ui/button";

import { useAcceptFriendRequest } from "../hooks/use-accept-friend-request";
import { useRejectFriendRequest } from "../hooks/use-reject-friend-request";

import { useIncomingRequests, useOutgoingRequests } from "../store/selectors";

import { FriendCard } from "./friend-card";

export function FriendRequests() {
  const requests = useIncomingRequests();
  const outgoingRequests = useOutgoingRequests();
  const acceptMutation = useAcceptFriendRequest();
  const rejectMutation = useRejectFriendRequest();

  if (requests.length === 0 && outgoingRequests.length === 0) {
    return null;
  }

  const isProcessing = acceptMutation.isPending || rejectMutation.isPending;

  return (
    <section className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">
            Friend Requests
          </h3>

          <p className="mt-1 text-xs text-zinc-500">
            People who want to connect with you
          </p>
        </div>

        <span
          className="
            flex
            h-6
            min-w-6
            items-center
            justify-center
            rounded-full
            bg-zinc-800
            px-2
            text-xs
            font-medium
            text-zinc-300
          "
        >
          {requests.length}
        </span>
      </div>

      {/* Requests */}
      <div className="space-y-2">
        {requests.map((request) => {
          const friend = {
            id: request.id,
            username: request.username,
            online: false,
            inGame: false,
          };

          return (
            <FriendCard
              key={request.id}
              friend={friend}
              rightSlot={
                <div className="flex items-center gap-2">
                  {/* Accept */}
                  <Button
                    type="button"
                    size="sm"
                    disabled={isProcessing}
                    onClick={(event) => {
                      event.stopPropagation();

                      acceptMutation.mutate({
                        username: request.username,
                      });
                    }}
                    className="
                      h-9
                      bg-zinc-100
                      px-3
                      text-zinc-950
                      hover:bg-zinc-300
                    "
                  >
                    <CheckIcon className="mr-1.5 h-4 w-4" />
                    Accept
                  </Button>

                  {/* Reject */}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isProcessing}
                    onClick={(event) => {
                      event.stopPropagation();

                      rejectMutation.mutate({
                        username: request.username,
                      });
                    }}
                    className="
                      h-9
                      border-zinc-700
                      bg-transparent
                      px-3
                      text-zinc-400
                      hover:bg-zinc-800
                      hover:text-zinc-100
                    "
                  >
                    <XMarkIcon className="mr-1.5 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              }
            />
          );
        })}
      </div>

      {outgoingRequests.length > 0 && (
        <div className="space-y-2 border-t border-zinc-800 pt-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-200">Sent requests</h3>
            <p className="mt-1 text-xs text-zinc-500">Waiting for these players to respond.</p>
          </div>
          {outgoingRequests.map((request) => (
            <FriendCard
              key={request.id}
              friend={{ id: request.id, username: request.username, online: false, inGame: false }}
              rightSlot={<span className="text-xs text-zinc-500">Pending</span>}
            />
          ))}
        </div>
      )}
    </section>
  );
}
