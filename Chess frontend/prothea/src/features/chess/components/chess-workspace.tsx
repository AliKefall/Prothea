import type { ReactNode } from "react";

interface ChessWorkspaceProps {
  board: ReactNode;
  sidebar: ReactNode;
}

export function ChessWorkspace({
  board,
  sidebar,
}: ChessWorkspaceProps) {
  return (
    <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="min-w-0">
        {board}
      </section>

      <section className="min-w-0">
        {sidebar}
      </section>
    </div>
  );
}
