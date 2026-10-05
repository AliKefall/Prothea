"use client";

import { useCallback } from "react";

import type {
  AnalysisMove,
  EngineMove,
} from "../types/analysis";

type EngineLinesProps = {
  moves: EngineMove[];
  onMoveSelect: (move: AnalysisMove) => void;
};

export function EngineLines({
  moves,
  onMoveSelect,
}: EngineLinesProps) {
  if (moves.length === 0) {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        No engine lines available.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {moves.map((move, index) => (
        <EngineLine
          key={`${move.uci}-${index}`}
          move={move}
          rank={index + 1}
          onSelect={onMoveSelect}
        />
      ))}
    </div>
  );
}

type EngineLineProps = {
  move: EngineMove;
  rank: number;
  onSelect: (move: AnalysisMove) => void;
};

function EngineLine({
  move,
  rank,
  onSelect,
}: EngineLineProps) {
  const handleClick = useCallback(() => {
    const analysisMove = createAnalysisMove(move);

    onSelect(analysisMove);
  }, [move, onSelect]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-md border px-3 py-2 text-left transition hover:bg-accent"
    >
      <span className="text-sm text-muted-foreground">
        {rank}.
      </span>

      <span className="font-medium">
        {move.san}
      </span>

      <Evaluation
        evaluation={move.evaluation}
        mate={move.mate}
      />
    </button>
  );
}

function Evaluation({
  evaluation,
  mate,
}: {
  evaluation: number | null;
  mate?: number;
}) {
  if (mate !== undefined) {
    const prefix = mate > 0 ? "+" : "";

    return (
      <span className="font-mono text-sm">
        M{prefix}
        {mate}
      </span>
    );
  }

  if (evaluation === null) {
    return (
      <span className="font-mono text-sm text-muted-foreground">
        -
      </span>
    );
  }

  const formatted =
    evaluation > 0
      ? `+${evaluation.toFixed(2)}`
      : evaluation.toFixed(2);

  return (
    <span className="font-mono text-sm">
      {formatted}
    </span>
  );
}

function createAnalysisMove(
  engineMove: EngineMove,
): AnalysisMove {
  const from = engineMove.uci.slice(0, 2);
  const to = engineMove.uci.slice(2, 4);
  const promotion =
    engineMove.uci.slice(4) || undefined;

  return {
    from,
    to,
    san: engineMove.san,
    uci: engineMove.uci,
    ...(promotion ? { promotion } : {}),
  };
}
