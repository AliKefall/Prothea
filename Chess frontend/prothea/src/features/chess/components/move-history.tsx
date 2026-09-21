interface MoveHistoryMove {
  move_number: number;
  san: string;
}

interface MoveHistoryProps {
  moves: MoveHistoryMove[];
  isLoading: boolean;
}

export function MoveHistory({
  moves,
  isLoading,
}: MoveHistoryProps) {
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-sm text-zinc-500">Loading moves...</p>
      </div>
    );
  }

  if (moves.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-sm text-zinc-500">No moves yet.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="overflow-hidden rounded-lg border border-zinc-800">
        <div className="grid grid-cols-[36px_1fr_1fr] bg-zinc-950 text-xs text-zinc-500">
          <div className="px-3 py-2">#</div>

          <div className="px-3 py-2">White</div>

          <div className="px-3 py-2">Black</div>
        </div>

        {Array.from(
          {
            length: Math.ceil(moves.length / 2),
          },
          (_, index) => {
            const whiteMove = moves[index * 2];
            const blackMove = moves[index * 2 + 1];

            return (
              <div
                key={index + 1}
                className="grid grid-cols-[36px_1fr_1fr] border-t border-zinc-800 text-sm"
              >
                <div className="px-3 py-2 text-zinc-600">
                  {index + 1}.
                </div>

                <div
                  className={[
                    "px-3 py-2",
                    whiteMove ? "text-zinc-300" : "text-zinc-700",
                  ].join(" ")}
                >
                  {whiteMove?.san ?? ""}
                </div>

                <div
                  className={[
                    "px-3 py-2",
                    blackMove ? "text-zinc-300" : "text-zinc-700",
                  ].join(" ")}
                >
                  {blackMove?.san ?? ""}
                </div>
              </div>
            );
          },
        )}
      </div>
    </div>
  );
}
