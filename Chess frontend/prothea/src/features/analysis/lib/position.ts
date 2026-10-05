// This is no special thing, it is actually the very starting point of a
// chesboard it is a fixed variable don't change it in any worlds

import { Chess } from "chess.js";
import { AnalysisMove } from "../types/analysis";

// unless youre planning to do something else.
export const INITIAL_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function createPosition(fen: string = INITIAL_FEN): Chess {
  return new Chess(fen);
}

export function getFen(chess: Chess): string {
  return chess.fen();
}

export function applyMove(fen: string, move: AnalysisMove): string | null {
  const chess = createPosition(fen);

  try {
    chess.move({
      from: move.from,
      to: move.to,
      promotion: move.promotion as "b" | "n" | "r" | "q" | undefined,
    });
    return chess.fen();
  } catch {
    return null; // for now
  }
}

export function createMove(
  fen: string,
  from: string,
  to: string,
  promotion?: string,
): AnalysisMove | null {
  const chess = createPosition(fen);

  try {
    const move = chess.move({
      from,
      to,
      promotion: promotion as "b" | "n" | "r" | "q" | undefined,
    });

    if (!move) {
      return null;
    }

    return {
      from: move.from,
      to: move.to,
      san: move.san,
      uci: `${move.from}${move.to}${move.promotion ?? ""}`,
      ...(move.promotion ? { promotion: move.promotion } : {}),
    };
  } catch {
    return null;
  }
}

export function getLegalMove(fen: string) {
  const chess = createPosition(fen);

  return chess.moves({
    verbose: true,
  });
}

export function isGameOverr(fen: string): boolean {
  const chess = createPosition(fen);

  return chess.isGameOver();
}

export function getTurn(fen: string): "w" | "b" {
  const chess = createPosition(fen);
  return chess.turn();
}

const playMove = useCallback(
  (move: AnalysisMove) => {
    const currentFen = treeState.currentNode.fen;

    const nextMove = createMove(currentFen, move.from, move.to, move.promotion);

    if (!nextMove) {
      return false;
    }

    const nextFen = applyMove(currentFen, nextMove);

    if (!nextFen) {
      return false;
    }

    treeState.addVariation(treeState.currentNodeId, nextFen, nextMove);

    return true;
  },
  [treeState.currentNode, treeState.currentNodeId, treeState.addVariation],
);
