"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";

import { useAuthStore } from "@/features/auth/auth-store";
import { MoveHistory } from "@/features/chess/components/move-history";
import { useMatch } from "@/features/chess/hooks/use-match";
import { useMatchMoves } from "@/features/chess/hooks/use-match-moves";
import { PromotionPicker } from "@/features/chess/components/promotion-picker";
import { applyMove, createMove, createPosition, INITIAL_FEN } from "../lib/position";
import { useStockfish } from "../hooks/use-stockfish";
import type { AnalysisMove } from "../types/analysis";
import type { Square } from "chess.js";

export function AnalysisReview({ matchId }: { matchId: string }) {
  const user = useAuthStore((state) => state.user);
  const { data: match, isLoading: matchLoading, isError: matchError } = useMatch(matchId);
  const { data: moves = [], isLoading: movesLoading } = useMatchMoves(matchId);
  const [moveNumber, setMoveNumber] = useState(0);
  const [variationMoves, setVariationMoves] = useState<AnalysisMove[]>([]);
  const [promotionRequest, setPromotionRequest] = useState<{ from: string; to: string; color: "w" | "b" } | null>(null);
  const currentFen = useMemo(
    () => moveNumber === 0 ? INITIAL_FEN : moves[moveNumber - 1]?.fen_after ?? INITIAL_FEN,
    [moveNumber, moves],
  );
  const variationFen = useMemo(
    () => variationMoves.reduce<string | null>((fen, move) => fen ? applyMove(fen, move) : null, currentFen),
    [currentFen, variationMoves],
  );
  const displayedFen = variationFen ?? currentFen;
  const { analyze, result, isAnalyzing, error } = useStockfish();

  useEffect(() => {
    if (!match || match.result === "pending" || !user) return;
    analyze(displayedFen, { depth: 14, multiPv: 1 });
  }, [analyze, displayedFen, match, user]);

  const handleVariationMove = useCallback((sourceSquare: string, targetSquare: string | null) => {
    if (!targetSquare) return false;
    const move = createMove(displayedFen, sourceSquare, targetSquare);
    if (!move) return false;
    setVariationMoves((current) => [...current, move]);
    return true;
  }, [displayedFen]);

  if (matchLoading || movesLoading) {
    return <div className="py-16 text-center text-sm text-zinc-400">Loading game…</div>;
  }
  if (matchError || !match || !user || match.result === "pending") {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center text-white">
        <p className="font-semibold">This game is not available for analysis.</p>
        <Link href="/dashboard/profile" className="mt-4 inline-block text-sm text-zinc-400 underline">Back to profile</Link>
      </div>
    );
  }

  const isWhite = match.white_id === user.user_id;
  const bestMove = result?.fen === displayedFen ? result.moves[0] : undefined;
  const bestSan = bestMove && createMove(
    displayedFen,
    bestMove.uci.slice(0, 2),
    bestMove.uci.slice(2, 4),
    bestMove.uci.slice(4) || undefined,
  )?.san;

  const selectMove = (nextMoveNumber: number) => {
    setPromotionRequest(null);
    setVariationMoves([]);
    setMoveNumber(nextMoveNumber);
  };

  return (
    <main className="mx-auto w-full max-w-6xl text-white">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/dashboard/profile" className="text-xs text-zinc-500 hover:text-white">← Recent games</Link>
          <h1 className="mt-2 text-2xl font-bold">Game analysis</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {match.white_username} vs {match.black_username} · {match.time_control}
          </p>
        </div>
        <p aria-live="polite" className="text-sm text-zinc-400">
          {error ?? (isAnalyzing ? `Evaluating position${result?.moves[0] ? ` · depth ${result.depth}` : "…"}` : bestMove ? "Position evaluated" : "Evaluation unavailable")}
        </p>
      </div>

      <section aria-label="Rating changes" className="mb-6 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm sm:grid-cols-2">
        <RatingChange username={match.white_username} before={match.white_rating} after={match.white_rating_after} color="White" />
        <RatingChange username={match.black_username} before={match.black_rating} after={match.black_rating_after} color="Black" />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section>
          <div className="mx-auto flex w-full max-w-3xl items-stretch gap-3">
            <EvaluationBar move={bestMove} whiteAtBottom={isWhite} />
            <div className="relative min-w-0 flex-1 overflow-hidden rounded-lg shadow-xl">
              <Chessboard options={{
                position: displayedFen,
                boardOrientation: isWhite ? "white" : "black",
                allowDragging: true,
                onPieceDrop: ({ sourceSquare, targetSquare }) => {
                  if (!targetSquare) return false;
                  const sourcePiece = createPosition(displayedFen).get(sourceSquare as Square);
                  const reachesBackRank = sourcePiece?.type === "p" && (targetSquare.endsWith("1") || targetSquare.endsWith("8"));
                  if (reachesBackRank) {
                    setPromotionRequest({ from: sourceSquare, to: targetSquare, color: sourcePiece.color });
                    return false;
                  }
                  return handleVariationMove(sourceSquare, targetSquare);
                },
              }} />
              {promotionRequest && (
                <PromotionPicker
                  color={promotionRequest.color}
                  onSelectAction={(promotion) => {
                    const move = createMove(displayedFen, promotionRequest.from, promotionRequest.to, promotion);
                    if (move) setVariationMoves((current) => [...current, move]);
                    setPromotionRequest(null);
                  }}
                  onCancelAction={() => setPromotionRequest(null)}
                />
              )}
            </div>
          </div>
          <div className="mx-auto mt-4 flex w-full max-w-3xl items-center justify-between gap-3">
            <div className="text-sm text-zinc-400">
              <p>
                {variationMoves.length > 0 ? `Exploring: ${variationMoves.map((move) => move.san).join(" ")}` : moveNumber === 0 ? "Starting position" : "Move " + Math.ceil(moveNumber / 2) + (moveNumber % 2 === 1 ? " · White" : " · Black")}
              {bestMove && <span className="ml-2 font-mono text-white">Best: {bestSan ?? bestMove.uci}</span>}
              </p>
              {variationMoves.length > 0 ? (
                <button type="button" onClick={() => setVariationMoves([])} className="mt-1 text-xs text-sky-400 hover:text-sky-300">
                  Return to game position
                </button>
              ) : <p className="mt-1 text-xs text-zinc-500">Drag a piece to explore another move.</p>}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => selectMove(0)} disabled={moveNumber === 0 && variationMoves.length === 0} className="rounded-md border border-zinc-700 px-3 py-2 text-sm disabled:opacity-40">First</button>
              <button type="button" onClick={() => selectMove(Math.max(0, moveNumber - 1))} disabled={moveNumber === 0} className="rounded-md border border-zinc-700 px-3 py-2 text-sm disabled:opacity-40">Previous</button>
              <button type="button" onClick={() => selectMove(Math.min(moves.length, moveNumber + 1))} disabled={moveNumber >= moves.length} className="rounded-md border border-zinc-700 px-3 py-2 text-sm disabled:opacity-40">Next</button>
              <button type="button" onClick={() => selectMove(moves.length)} disabled={moveNumber >= moves.length} className="rounded-md border border-zinc-700 px-3 py-2 text-sm disabled:opacity-40">Last</button>
            </div>
          </div>
        </section>

        <aside className="min-h-96 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
          <div className="border-b border-zinc-800 px-5 py-4">
            <h2 className="text-sm font-semibold">Moves</h2>
            <p className="mt-1 text-xs text-zinc-500">Choose a move or step through the game.</p>
          </div>
          <div className="h-[28rem]">
            <MoveHistory
              moves={moves}
              isLoading={false}
              selectedMoveNumber={moveNumber || null}
              onMoveSelect={selectMove}
              showClock
            />
          </div>
        </aside>
      </div>
    </main>
  );
}

function RatingChange({ username, before, after, color }: { username: string; before: number; after: number | null; color: string }) {
  const change = after === null ? null : after - before;
  const changeColor = change === null || change === 0 ? "text-zinc-400" : change > 0 ? "text-emerald-400" : "text-rose-400";
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-zinc-400">{color} · {username}</span>
      <span className="font-mono text-white">
        {before}{after !== null && <> → {after} <span className={changeColor}>({change! > 0 ? "+" : ""}{change})</span></>}
      </span>
    </div>
  );
}

function EvaluationBar({
  move,
  whiteAtBottom,
}: {
  move?: { evaluation: number | null; mate?: number };
  whiteAtBottom: boolean;
}) {
  const whiteAdvantage = move?.mate !== undefined
    ? move.mate > 0 ? 100 : move.mate < 0 ? 0 : 50
    : move?.evaluation === null || move?.evaluation === undefined
      ? 50
      : Math.max(4, Math.min(96, 50 + move.evaluation * (50 / 12)));
  const bottomAdvantage = whiteAtBottom ? whiteAdvantage : 100 - whiteAdvantage;
  const label = move?.mate !== undefined
    ? "Mate in " + Math.abs(move.mate)
    : move?.evaluation === null || move?.evaluation === undefined
      ? "No evaluation"
      : (move.evaluation > 0 ? "+" : "") + move.evaluation.toFixed(2);

  return (
    <div className="flex shrink-0 flex-col items-center gap-2" aria-label={"Position evaluation: " + label}>
      <div className="relative h-full min-h-80 w-4 overflow-hidden rounded-full bg-zinc-700" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(whiteAdvantage)}>
        <div className="absolute inset-x-0 bottom-0 bg-zinc-100 transition-[height] duration-300" style={{ height: String(bottomAdvantage) + "%" }} />
      </div>
      <span className="font-mono text-xs text-zinc-300">{label}</span>
    </div>
  );
}
