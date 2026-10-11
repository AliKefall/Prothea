"use client";

import { PlayerSearch } from "@/features/profile/components/player-search";

export function DashboardTopbar() {
  return (
    <header className="sticky top-0 z-30">
      <div className="flex justify-center px-4 py-3 sm:px-6">
        <PlayerSearch />
      </div>
    </header>
  );
}
