import type { ReactNode } from "react";

import {
  ChessSidebarTabs,
  type ChessSidebarTab,
} from "./chess-sidebar-tabs";

interface ChessSidebarProps {
  activeTab: ChessSidebarTab;
  showMatchmaking: boolean;
  statusLabel: string;
  timeControl: string;
  onTabChange: (tab: ChessSidebarTab) => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function ChessSidebar({
  activeTab,
  showMatchmaking,
  statusLabel,
  timeControl,
  onTabChange,
  children,
  footer,
}: ChessSidebarProps) {
  return (
    <aside className="flex h-130 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      <div className="border-b border-zinc-800 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Game</h2>

            <p className="mt-1 text-xs text-zinc-500">
              Rated · {timeControl}
            </p>
          </div>

          <span className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-400">
            {statusLabel}
          </span>
        </div>
      </div>

      <ChessSidebarTabs
        activeTab={activeTab}
        showMatchmaking={showMatchmaking}
        onChange={onTabChange}
      />

      <div className="min-h-0 flex-1">
        {children}
      </div>

      {footer}
    </aside>
  );
}
