"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowPathIcon, ExclamationTriangleIcon, StarIcon } from "@heroicons/react/24/solid";
import { Chessboard, type Arrow, type PieceDropHandlerArgs } from "react-chessboard";

import { useAuthStore } from "@/features/auth/auth-store";
import { MoveHistory } from "@/features/chess/components/move-history";
import { useMatch } from "@/features/chess/hooks/use-match";
import { useMatchMoves } from "@/features/chess/hooks/use-match-moves";
import { PromotionPicker } from "@/features/chess/components/promotion-picker";
import { applyMove, createMove, createPosition, INITIAL_FEN } from "../lib/position";
import { useStockfish } from "../hooks/use-stockfish";
import type { AnalysisMove } from "../types/analysis";
import type { Square } from "chess.js";

interface AnalysisChessboardProps {
  position: string;
  boardOrientation: "white" | "black";
  arrows: Arrow[];
  squareStyles: Record<string, React.CSSProperties>;
  bestFrom?: string;
  lowerRankedFrom?: string;
  onSquareClick: ({ square }: { square: string }) => void;
  onPieceDrop: (args: PieceDropHandlerArgs) => boolean;
}

const AnalysisChessboard = memo(function AnalysisChessboard({
  position,
  boardOrientation,
  arrows,
  squareStyles,
  bestFrom,
  lowerRankedFrom,
  onSquareClick,
  onPieceDrop,
}: AnalysisChessboardProps) {
  return (
    <Chessboard options={{
      position,
      boardOrientation,
      allowDragging: true,
      arrows,
      clearArrowsOnPositionChange: false,
      squareStyles,
      onSquareClick,
      squareRenderer: ({ square, children }) => (
        <div style={{ position: "relative", width: "100%", height: "100%", ...squareStyles[square] }}>
          {children}
          {bestFrom === square && <span title="Best move" className="absolute right-0.5 top-0.5 z-10 grid h-5 w-5 place-items-center rounded-full bg-emerald-400 text-emerald-950 shadow"><StarIcon className="h-3 w-3" /></span>}
          {lowerRankedFrom === square && <span title="Lowest ranked of the top three" className="absolute right-0.5 top-0.5 z-10 grid h-5 w-5 place-items-center rounded-full bg-rose-400 text-rose-950 shadow"><ExclamationTriangleIcon className="h-3 w-3" /></span>}
        </div>
      ),
      onPieceDrop,
    }} />
  );
});

export function AnalysisReview({ matchId }: { matchId: string }) {
  const user = useAuthStore((state) => state.user);
  const { data: match, isLoading: matchLoading, isError: matchError } = useMatch(matchId);
  const { data: moves = [], isLoading: movesLoading } = useMatchMoves(matchId);
  const [moveNumber, setMoveNumber] = useState(0);
  const [variationMoves, setVariationMoves] = useState<AnalysisMove[]>([]);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showBestMoveArrow, setShowBestMoveArrow] = useState(true);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
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
  const isWhite = match && user ? match.white_id === user.user_id : true;
  const positionGame = useMemo(() => createPosition(displayedFen), [displayedFen]);
  const { analyze, result, isAnalyzing, error } = useStockfish();

  useEffect(() => {
    if (!match || match.result === "pending" || !user) return;
    analyze(displayedFen, { depth: 14, multiPv: 3 });
  }, [analyze, displayedFen, match, user]);

  const handleVariationMove = useCallback((sourceSquare: string, targetSquare: string | null) => {
    if (!targetSquare) return false;
    const move = createMove(displayedFen, sourceSquare, targetSquare);
    if (!move) return false;
    setVariationMoves((current) => [...current, move]);
    setSelectedSquare(null);
    return true;
  }, [displayedFen]);

  const boardOrientation = (isWhite !== isFlipped ? "white" : "black") as "white" | "black";
  const checkedKingSquare = positionGame.isCheck()
    ? positionGame.board().flat().find((piece) => piece?.type === "k" && piece.color === positionGame.turn())?.square
    : undefined;
  const legalTargets = useMemo(() => selectedSquare
    ? positionGame.moves({ square: selectedSquare, verbose: true }).map((move) => move.to)
    : [], [positionGame, selectedSquare]);
  const squareStyles = useMemo<Record<string, React.CSSProperties>>(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (checkedKingSquare) styles[checkedKingSquare] = { background: "rgba(239, 68, 68, 0.62)", boxShadow: "inset 0 0 0 4px rgba(127, 29, 29, 0.9)" };
    if (selectedSquare) styles[selectedSquare] = { ...styles[selectedSquare], boxShadow: "inset 0 0 0 4px rgba(56, 189, 248, 0.95)" };
    for (const target of legalTargets) {
      const occupied = positionGame.get(target)?.type;
      styles[target] = {
        ...styles[target],
        background: styles[target]?.background ?? (occupied ? "rgba(239, 68, 68, 0.35)" : "radial-gradient(circle, rgba(14, 165, 233, 0.7) 18%, transparent 20%)"),
        ...(occupied ? { boxShadow: "inset 0 0 0 4px rgba(14, 165, 233, 0.75)" } : {}),
      };
    }
    return styles;
  }, [checkedKingSquare, legalTargets, positionGame, selectedSquare]);

  const handleBoardSquareClick = useCallback(({ square }: { square: string }) => {
    const clicked = square as Square;
    if (selectedSquare && legalTargets.includes(clicked)) {
      const movingPiece = positionGame.get(selectedSquare);
      const isPromotion = movingPiece?.type === "p" && (clicked.endsWith("1") || clicked.endsWith("8"));
      if (isPromotion && movingPiece) {
        setPromotionRequest({ from: selectedSquare, to: clicked, color: movingPiece.color });
      } else {
        handleVariationMove(selectedSquare, clicked);
      }
      setSelectedSquare(null);
      return;
    }
    const piece = positionGame.get(clicked);
    setSelectedSquare(piece?.color === positionGame.turn() ? clicked : null);
  }, [handleVariationMove, legalTargets, positionGame, selectedSquare]);

  const handlePieceDrop = useCallback(({ sourceSquare, targetSquare }: PieceDropHandlerArgs) => {
    if (!targetSquare) return false;
    const sourcePiece = positionGame.get(sourceSquare as Square);
    const reachesBackRank = sourcePiece?.type === "p" && (targetSquare.endsWith("1") || targetSquare.endsWith("8"));
    if (reachesBackRank && sourcePiece) {
      setPromotionRequest({ from: sourceSquare, to: targetSquare, color: sourcePiece.color });
      return false;
    }
    return handleVariationMove(sourceSquare, targetSquare);
  }, [handleVariationMove, positionGame]);

  const bestMove = result?.fen === displayedFen ? result.moves[0] : undefined;
  const bestMoves = result?.fen === displayedFen ? result.moves.slice(0, 3) : [];
  const bestMoveUci = bestMove?.uci;
  const bestFrom = bestMoveUci?.slice(0, 2);
  const lowerRankedFrom = bestMoves[2]?.uci.slice(0, 2);
  const arrows = useMemo<Arrow[]>(() => showBestMoveArrow && bestMoveUci
    ? [{ startSquare: bestMoveUci.slice(0, 2), endSquare: bestMoveUci.slice(2, 4), color: "#38bdf8" }]
    : [], [bestMoveUci, showBestMoveArrow]);

  if (matchLoading || movesLoading) {
    return <div className="py-16 text-center text-sm text-zinc-400">Loading game…</div>;
  }
  if (matchError || !match || !user || match.result === "pending") {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center text-white">
        <p className="font-semibold">This game is not available for analysis.</p>
        <Link href="/dashboard/analysis" className="mt-4 inline-block text-sm text-zinc-400 underline">Back to analysis library</Link>
      </div>
    );
  }

  const bestSan = bestMove && createMove(
    displayedFen,
    bestMove.uci.slice(0, 2),
    bestMove.uci.slice(2, 4),
    bestMove.uci.slice(4) || undefined,
  )?.san;

  const selectMove = (nextMoveNumber: number) => {
    setPromotionRequest(null);
    setSelectedSquare(null);
    setVariationMoves([]);
    setMoveNumber(nextMoveNumber);
  };

  const stepBack = () => {
    setPromotionRequest(null);
    setSelectedSquare(null);
    if (variationMoves.length > 0) {
      setVariationMoves((current) => current.slice(0, -1));
      return;
    }
    selectMove(Math.max(0, moveNumber - 1));
  };

  return (
    <main className="mx-auto w-full max-w-6xl text-white">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/dashboard/analysis" className="text-xs text-zinc-500 hover:text-white">← Analysis library</Link>
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
          <div className="mx-auto mb-3 flex w-full max-w-3xl flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              {checkedKingSquare && <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-red-300">Check</span>}
              {selectedSquare && <span>Legal moves highlighted</span>}
              {bestMove && <span className="inline-flex items-center gap-1 text-emerald-300"><StarIcon className="h-3.5 w-3.5" /> Best line</span>}
              {bestMoves[2] && <span className="inline-flex items-center gap-1 text-rose-300"><ExclamationTriangleIcon className="h-3.5 w-3.5" /> Lowest of top 3</span>}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowBestMoveArrow((shown) => !shown)} disabled={!bestMove} aria-pressed={showBestMoveArrow} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-40">
                {showBestMoveArrow ? "Hide best move" : "Show best move"}
              </button>
              <button type="button" onClick={() => { setIsFlipped((flipped) => !flipped); setSelectedSquare(null); }} aria-label="Flip analysis board" className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800">
                <ArrowPathIcon className="h-4 w-4" aria-hidden="true" /> Flip board
              </button>
            </div>
          </div>
          <div className="mx-auto flex w-full max-w-3xl items-stretch gap-3">
            <EvaluationBar move={bestMove} whiteAtBottom={isWhite} />
            <div className="relative aspect-square min-w-0 flex-1 overflow-hidden rounded-lg shadow-xl">
              <AnalysisChessboard
                position={displayedFen}
                boardOrientation={boardOrientation}
                arrows={arrows}
                squareStyles={squareStyles}
                bestFrom={bestFrom}
                lowerRankedFrom={lowerRankedFrom !== bestFrom ? lowerRankedFrom : undefined}
                onSquareClick={handleBoardSquareClick}
                onPieceDrop={handlePieceDrop}
              />
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
              <p className="mt-1 text-xs text-zinc-500">
                {variationMoves.length > 0 ? `Alternative line · ${variationMoves.length} ${variationMoves.length === 1 ? "move" : "moves"}` : "Drag a piece to explore another move."}
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => selectMove(0)} disabled={moveNumber === 0 && variationMoves.length === 0} className="rounded-md border border-zinc-700 px-3 py-2 text-sm disabled:opacity-40">First</button>
              <button type="button" onClick={stepBack} disabled={moveNumber === 0 && variationMoves.length === 0} className="rounded-md border border-zinc-700 px-3 py-2 text-sm disabled:opacity-40">{variationMoves.length > 0 ? "Undo" : "Previous"}</button>
              <button type="button" onClick={() => selectMove(Math.min(moves.length, moveNumber + 1))} disabled={moveNumber >= moves.length || variationMoves.length > 0} className="rounded-md border border-zinc-700 px-3 py-2 text-sm disabled:opacity-40">Next</button>
              <button type="button" onClick={() => selectMove(moves.length)} disabled={moveNumber >= moves.length} className="rounded-md border border-zinc-700 px-3 py-2 text-sm disabled:opacity-40">Last</button>
            </div>
          </div>
          {variationMoves.length > 0 && (
            <section aria-label="Alternative line" className="mx-auto mt-4 w-full max-w-3xl rounded-xl border border-sky-400/20 bg-sky-400/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">Alternative line</p>
                  <p className="mt-1 text-xs text-zinc-500">Branch point: {moveNumber === 0 ? "starting position" : moves[moveNumber - 1]?.san ?? `move ${moveNumber}`}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setVariationMoves([]); setSelectedSquare(null); setPromotionRequest(null); }} className="rounded-lg bg-sky-300/10 px-3 py-2 text-xs font-medium text-sky-200 hover:bg-sky-300/20">Return to game</button>
                </div>
              </div>
              <ol className="mt-3 flex flex-wrap gap-2" aria-label="Moves in alternative line">
                {variationMoves.map((move, index) => (
                  <li key={`${index}-${move.uci}`}>
                    <button type="button" onClick={() => { setVariationMoves((current) => current.slice(0, index + 1)); setSelectedSquare(null); }} aria-label={`Show alternative line through ${move.san}`} className={`rounded-lg px-2.5 py-1.5 font-mono text-sm ${index === variationMoves.length - 1 ? "bg-sky-300 text-zinc-950" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}>
                      {Math.floor((moveNumber + index) / 2) + 1}{(moveNumber + index) % 2 === 0 ? "." : "…"} {move.san}
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </section>

        <aside className="flex h-[80vh] min-h-128 max-h-208 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
          <section className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 border-b border-zinc-800 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">Game moves</h2>
                  <p className="mt-1 text-xs text-zinc-500">Select a move to review that position.</p>
                </div>
                <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs tabular-nums text-zinc-400">{moves.length}</span>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <MoveHistory
                moves={moves}
                isLoading={false}
                selectedMoveNumber={moveNumber || null}
                onMoveSelect={selectMove}
                showClock
              />
            </div>
          </section>
          <section aria-label="Best three moves" className="max-h-60 shrink-0 overflow-y-auto border-t border-zinc-800 px-5 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Best moves</h2>
              <span className="text-xs text-zinc-500">Stockfish · depth {result?.fen === displayedFen ? result.depth : "—"}</span>
            </div>
            <div className="mt-3 space-y-2">
              {bestMoves.length > 0 ? bestMoves.map((move, index) => {
                const san = createMove(displayedFen, move.uci.slice(0, 2), move.uci.slice(2, 4), move.uci.slice(4) || undefined)?.san ?? move.uci;
                const score = move.mate !== undefined ? `M${Math.abs(move.mate)}` : move.evaluation === null ? "—" : `${move.evaluation > 0 ? "+" : ""}${move.evaluation.toFixed(2)}`;
                return <div key={`${move.uci}-${index}`} className="flex items-center justify-between rounded-lg bg-zinc-950/70 px-3 py-2">
                  <span className="flex items-center gap-3"><span className="grid h-6 w-6 place-items-center rounded-md bg-zinc-800 text-xs text-zinc-400">{index + 1}</span><span className="font-mono text-sm font-semibold">{san}</span></span>
                  <span className="font-mono text-xs text-zinc-400">{score}</span>
                </div>;
              }) : <p className="rounded-lg bg-zinc-950/50 px-3 py-3 text-xs text-zinc-500">{isAnalyzing ? "Calculating top lines…" : error ?? "No engine lines available."}</p>}
            </div>
          </section>
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
  const label = move?.mate !== undefined
    ? "Mate in " + Math.abs(move.mate)
    : move?.evaluation === null || move?.evaluation === undefined
      ? "No evaluation"
      : (move.evaluation > 0 ? "+" : "") + move.evaluation.toFixed(2);

  return (
    <div className="flex shrink-0 flex-col items-center gap-2" aria-label={"Position evaluation: " + label}>
      <div className="relative h-full min-h-80 w-4 overflow-hidden rounded-full border border-zinc-700 bg-zinc-950" role="meter" aria-label="White advantage percentage" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(whiteAdvantage)}>
        <div className="absolute inset-x-0 bg-zinc-100 transition-[height] duration-300" style={whiteAtBottom ? { bottom: 0, height: `${whiteAdvantage}%` } : { top: 0, height: `${whiteAdvantage}%` }} />
        <div className="absolute inset-x-0 bg-zinc-950 transition-[height] duration-300" style={whiteAtBottom ? { top: 0, height: `${100 - whiteAdvantage}%` } : { bottom: 0, height: `${100 - whiteAdvantage}%` }} />
      </div>
      <span className="font-mono text-xs text-zinc-300">{label}</span>
    </div>
  );
}
