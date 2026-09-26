interface MoveHistoryMove {
  move_number: number;
  san: string;
}

interface MoveHistoryProps {
  moves: MoveHistoryMove[];
  isLoading: boolean;
  selectedMoveNumber: number | null;
  onMoveSelect: (moveNumber: number) => void;
}

export function MoveHistory({
  moves,
  isLoading,
  selectedMoveNumber,
  onMoveSelect,
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
                <div className="px-3 py-2 text-zinc-600">{index + 1}.</div>
{[whiteMove, blackMove].map((move) =>
                  move ? (
                    <button
                      key={move.move_number}
                      type="button"
                      onClick={() => onMoveSelect(move.move_number)}
                      aria-pressed={selectedMoveNumber === move.move_number}
                      className={[
                        "px-3 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-400",
                        selectedMoveNumber === move.move_number
                          ? "bg-zinc-700 text-white"
                          : "text-zinc-300 hover:bg-zinc-800 hover:text-white",
                      ].join(" ")}
                    >
                      {move.san}
                    </button>
                  ) : (
                    <div key={`empty-${index}`} className="px-3 py-2 text-zinc-700" />
                  ),
                )}
              </div>
            );
          },
        )}
      </div>
    </div>
  );
}
