"use client";

import { useCallback } from "react";
import {
  Chessboard,
  type PieceDropHandlerArgs,
} from "react-chessboard";

import { createMove } from "../lib/position";
import type { AnalysisMove } from "../types/analysis";

type AnalysisBoardProps = {
  fen: string;
  onMove: (move: AnalysisMove) => boolean;
};

export function AnalysisBoard({
  fen,
  onMove,
}: AnalysisBoardProps) {
  const handlePieceDrop = useCallback(
    ({
      sourceSquare,
      targetSquare,
    }: PieceDropHandlerArgs) => {
      const move = createMove(
        fen,
        sourceSquare,
        targetSquare,
      );

      if (!move) {
        return false;
      }

      return onMove(move);
    },
    [fen, onMove],
  );

  return (
    <div className="w-full max-w-2xl">
      <Chessboard
        options={{
          position: fen,
          onPieceDrop: handlePieceDrop,
          allowDragging: true,
        }}
      />
    </div>
  );
}
