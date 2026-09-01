"use client";

import { XMarkIcon } from "@heroicons/react/24/outline";

import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

import { FriendCard } from "./friend-card";
import { FriendRequests } from "./friend-requests";
import { AddFriendDialog } from "./add-friend-dialog";

import { useFriendsPanelStore } from "../store/panel-store";
import { useFriends } from "../hooks/use-friends";
import { useFriendsWebSocket } from "../hooks/use-friends-websocket";

import {
  openDirectConversation,
} from "@/features/chat/store/actions";

import {
  useFriendsList,
  useIncomingRequests,
  useOnlineFriends,
  useOfflineFriends,
} from "../store/selectors";

export function FriendsPanel() {
  const isOpen = useFriendsPanelStore((state) => state.isOpen);
  const close = useFriendsPanelStore((state) => state.close);

  useFriends();
  useFriendsWebSocket();

  const friends = useFriendsList();
  const requests = useIncomingRequests();

  const onlineFriends = useOnlineFriends();
  const offlineFriends = useOfflineFriends();

  function handleFriendClick(friendID: string) {
  void openDirectConversation(friendID);
}

  return (
    <>
      {/* Overlay */}
      <div
        aria-hidden="true"
        onClick={close}
        className={`
          fixed
          inset-0
          z-40
          bg-black/40
          backdrop-blur-[2px]
          transition-opacity
          duration-300
          ${
            isOpen
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0"
          }
        `}
      />

      {/* Friends panel */}
      <aside
        aria-label="Friends panel"
        aria-hidden={!isOpen}
        className={`
          fixed
          right-0
          top-0
          z-50
          flex
          h-screen
          w-full
          max-w-sm
          flex-col
          border-l
          border-zinc-800
          bg-zinc-950
          shadow-2xl
          transition-transform
          duration-300
          ease-in-out
          ${isOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {/* Header */}
        <header className="shrink-0 border-b border-zinc-800 px-5 py-5">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-zinc-100">Friends</h2>

              <p className="mt-1 text-sm text-zinc-500">
                {friends.length} {friends.length === 1 ? "friend" : "friends"}
              </p>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close friends panel"
              onClick={close}
              className="
                shrink-0
                text-zinc-400
                hover:bg-zinc-800
                hover:text-zinc-100
              "
            >
              <XMarkIcon className="h-5 w-5" />
            </Button>
          </div>

          {/* Add friend */}
          <div className="mt-5">
            <AddFriendDialog />
          </div>
        </header>

        {/* Content */}
        <main className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-6">
            {/* Friend requests */}
            <FriendRequests />

            {requests.length > 0 && <Separator className="bg-zinc-800" />}

            {/* No friends */}
            {friends.length === 0 ? (
              <div className="flex min-h-75 items-center justify-center">
                <div className="text-center">
                  <p className="text-sm font-medium text-zinc-300">
                    No friends yet
                  </p>

                  <p className="mt-1 text-xs text-zinc-500">
                    Add someone to start connecting.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Online friends */}
                {onlineFriends.length > 0 && (
                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Online
                      </h3>

                      <span className="text-xs text-zinc-600">
                        {onlineFriends.length}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {onlineFriends.map((friend) => (
                        <FriendCard
                          key={friend.id}
                          friend={friend}
                          onClick={() => handleFriendClick(friend.id)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Offline friends */}
                {offlineFriends.length > 0 && (
                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Offline
                      </h3>

                      <span className="text-xs text-zinc-600">
                        {offlineFriends.length}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {offlineFriends.map((friend) => (
                        <FriendCard
                          key={friend.id}
                          friend={friend}
                          onClick={() => handleFriendClick(friend.id)}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        </main>
      </aside>
    </>
  );
}
