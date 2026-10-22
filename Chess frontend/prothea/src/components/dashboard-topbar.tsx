"use client";

import { PlayerSearch } from "@/features/profile/components/player-search";

export function DashboardTopbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-md md:left-64">
      <div className="flex h-16 items-center justify-center px-4 sm:px-6">
        <PlayerSearch />
      </div>
    </header>
  );
}
