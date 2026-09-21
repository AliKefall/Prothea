export type ChessSidebarTab = "moves" | "chat" | "replay" | "matchmaking";

interface ChessSidebarTabsProps {
  activeTab: ChessSidebarTab;
  showMatchmaking: boolean;
  onChange: (tab: ChessSidebarTab) => void;
}

const tabs: Array<{
  id: ChessSidebarTab;
  label: string;
}> = [
  {
    id: "moves",
    label: "Moves",
  },
  {
    id: "chat",
    label: "Chat",
  },
  {
    id: "replay",
    label: "Replay",
  },
  {
    id: "matchmaking",
    label: "New Game",
  },
];

export function ChessSidebarTabs({
  activeTab,
  showMatchmaking,
  onChange,
}: ChessSidebarTabsProps) {
  return (
    // FIX #7: proper tab semantics (tablist / tab / aria-selected) instead of aria-pressed
    <div role="tablist" className="flex overflow-x-auto border-b border-zinc-800">
      {tabs.map((tab) => {
        if (tab.id === "matchmaking" && !showMatchmaking) {
          return null;
        }

        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={[
              "shrink-0 px-4 py-3 text-xs font-medium transition",
              isActive
                ? "border-b-2 border-white text-white"
                : "text-zinc-500 hover:text-zinc-300",
            ].join(" ")}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
