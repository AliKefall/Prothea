"use client";

import { UserGroupIcon } from "@heroicons/react/24/outline";

import { Button } from "@/components/ui/button";

import { useFriendsPanelStore } from "../store/panel-store";

export function FriendsPanelButton() {
  const toggle = useFriendsPanelStore((state) => state.toggle);

  return (
    <Button
      type="button"
      onClick={toggle}
      aria-label="Open friends panel"
      className="
        fixed
        bottom-6
        right-6
        z-40
        h-14
        w-14
        rounded-full
        border
        border-zinc-700
        bg-zinc-100
        p-0
        text-zinc-950
        shadow-xl
        transition-all
        duration-200
        hover:scale-110
        hover:bg-zinc-300
        active:scale-95
      "
    >
      <UserGroupIcon className="h-6 w-6" />
    </Button>
  );
}
