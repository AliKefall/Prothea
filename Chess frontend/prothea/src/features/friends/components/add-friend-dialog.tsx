"use client";

import { useState, type FormEvent } from "react";

import { UserPlusIcon } from "@heroicons/react/24/outline";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useSendFriendRequest } from "../hooks/use-send-friend-request";

export function AddFriendDialog() {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");

  const sendFriendRequest = useSendFriendRequest();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const value = username.trim();

    if (!value) {
      return;
    }

    try {
      await sendFriendRequest.mutateAsync({
        username: value,
      });

      setUsername("");
      setOpen(false);
    } catch {
      // Error handling can be added later.
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        type="button"
        className="
          inline-flex
          h-10
          w-full
          items-center
          justify-center
          gap-2
          rounded-md
          bg-zinc-100
          px-4
          text-sm
          font-semibold
          text-zinc-950
          transition-colors
          hover:bg-zinc-300
          focus-visible:outline-none
          focus-visible:ring-2
          focus-visible:ring-zinc-500
          disabled:pointer-events-none
          disabled:opacity-50
        "
      >
        <UserPlusIcon className="h-5 w-5" />

        <span>Add Friend</span>
      </DialogTrigger>

      <DialogContent
        className="
          border
          border-zinc-800
          bg-zinc-950
          text-zinc-100
          shadow-2xl
        "
      >
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Add Friend</DialogTitle>

          <DialogDescription className="text-zinc-400">
            Enter your friends username to send a friend request.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label
              htmlFor="friend-username"
              className="text-sm font-medium text-zinc-200"
            >
              Username
            </label>

            <Input
              id="friend-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              autoComplete="off"
              autoFocus
              disabled={sendFriendRequest.isPending}
              className="
                border-zinc-800
                bg-zinc-900
                text-zinc-100
                placeholder:text-zinc-600
                focus-visible:border-zinc-600
              "
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={sendFriendRequest.isPending}
              onClick={() => setOpen(false)}
              className="
                border-zinc-700
                bg-transparent
                text-zinc-300
                hover:bg-zinc-800
                hover:text-zinc-100
              "
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={sendFriendRequest.isPending || username.trim() === ""}
              className="
                bg-zinc-100
                font-semibold
                text-zinc-950
                hover:bg-zinc-300
              "
            >
              {sendFriendRequest.isPending ? "Sending..." : "Send Request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
