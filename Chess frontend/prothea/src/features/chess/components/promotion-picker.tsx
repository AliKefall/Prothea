"use client";

type PromotionPickerProps = {
  color: "w" | "b";
  onSelectAction: (piece: "q" | "r" | "b" | "n") => void;
  onCancelAction: () => void;
};

const promotionPieces = [
  { type: "q", white: "♕", black: "♛", label: "Queen" },
  { type: "r", white: "♖", black: "♜", label: "Rook" },
  { type: "b", white: "♗", black: "♝", label: "Bishop" },
  { type: "n", white: "♘", black: "♞", label: "Knight" },
] as const;

export function PromotionPicker({ color, onSelectAction, onCancelAction }: PromotionPickerProps) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="promotion-title"
        className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-950 p-4 text-white shadow-2xl"
      >
        <h2 id="promotion-title" className="text-sm font-semibold">Choose a piece</h2>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {promotionPieces.map((piece) => (
            <button
              key={piece.type}
              type="button"
              aria-label={piece.label}
              onClick={() => onSelectAction(piece.type)}
              className="flex aspect-square flex-col items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 transition hover:border-zinc-500 hover:bg-zinc-800"
            >
              <span className="text-4xl leading-none">{color === "w" ? piece.white : piece.black}</span>
              <span className="mt-1 text-[10px] text-zinc-400">{piece.label}</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={onCancelAction} className="mt-3 w-full rounded-lg px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-900">
          Cancel
        </button>
      </div>
    </div>
  );
}
