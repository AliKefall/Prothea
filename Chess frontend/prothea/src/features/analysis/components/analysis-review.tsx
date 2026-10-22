"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowPathIcon,
  BookOpenIcon,
  MagnifyingGlassIcon,
  StarIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import {
  Chessboard,
  type Arrow,
  type ChessboardOptions,
  type PieceDropHandlerArgs,
} from "react-chessboard";

import { useAuthStore } from "@/features/auth/auth-store";
import { MoveHistory } from "@/features/chess/components/move-history";
import { useMatch } from "@/features/chess/hooks/use-match";
import { useMatchMoves } from "@/features/chess/hooks/use-match-moves";
import { useMatchOpening } from "@/features/chess/hooks/use-match-opening";
import { useOpeningLibrary } from "@/features/chess/hooks/use-opening-library";
import { PromotionPicker } from "@/features/chess/components/promotion-picker";
import { AnalysisSymbolInfo } from "./analysis-symbol-info";
import {
  applyMove,
  createMove,
  createPosition,
  INITIAL_FEN,
  parseOpeningPgn,
} from "../lib/position";
import { useStockfish } from "../hooks/use-stockfish";
import type { AnalysisMove, EngineMove } from "../types/analysis";
import type { Square } from "chess.js";

interface AnalysisChessboardProps {
  position: string;
  boardOrientation: "white" | "black";
  arrows: Arrow[];
  squareStyles: Record<string, React.CSSProperties>;
  bestFrom?: string;
  qualitySquare?: string;
  quality?: "inaccuracy" | "mistake" | "blunder";
  onSquareClick: ({ square }: { square: string }) => void;
  onPieceDrop: (args: PieceDropHandlerArgs) => boolean;
}

const EMPTY_ARROWS: Arrow[] = [];

type MoveQuality = "best" | "good" | "inaccuracy" | "mistake" | "blunder";

function moveScore(move: EngineMove | undefined): number | null {
  if (!move) return null;
  if (move.mate !== undefined) {
    return Math.sign(move.mate) * (1000 - Math.min(Math.abs(move.mate), 999));
  }
  return move.evaluation;
}

function classifyMove(
  playedUci: string,
  bestBefore: EngineMove | undefined,
  bestAfter: EngineMove | undefined,
  whiteMoved: boolean,
): MoveQuality | null {
  if (bestBefore?.uci.toLowerCase() === playedUci.toLowerCase()) return "best";
  const before = moveScore(bestBefore);
  const after = moveScore(bestAfter);
  if (before === null || after === null) return null;

  const lostAdvantage = whiteMoved ? before - after : after - before;
  if (lostAdvantage <= 0.5) return "good";
  if (lostAdvantage <= 1.5) return "inaccuracy";
  if (lostAdvantage <= 2.5) return "mistake";
  return "blunder";
}

const AnalysisChessboard = memo(function AnalysisChessboard({
  position,
  boardOrientation,
  arrows,
  squareStyles,
  bestFrom,
  qualitySquare,
  quality,
  onSquareClick,
  onPieceDrop,
}: AnalysisChessboardProps) {
  const options = useMemo<ChessboardOptions>(
    () => ({
      position,
      boardOrientation,
      allowDragging: true,
      arrows,
      clearArrowsOnPositionChange: false,
      squareStyles,
      onSquareClick,
      squareRenderer: ({ square, children }) => (
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            ...squareStyles[square],
          }}
        >
          {children}
          {bestFrom === square && (
            <span
              title="Best move"
              className="absolute right-0.5 top-0.5 z-10 grid h-5 w-5 place-items-center rounded-full bg-emerald-400 text-emerald-950 shadow"
            >
              <StarIcon className="h-3 w-3" />
            </span>
          )}
          {qualitySquare === square && quality && (
            <span
              title={`Move quality: ${quality}`}
              className={`absolute bottom-0.5 right-0.5 z-10 grid h-5 w-5 place-items-center rounded-full text-[10px] font-black shadow ${quality === "inaccuracy" ? "bg-amber-300 text-amber-950" : quality === "mistake" ? "bg-orange-400 text-orange-950" : "bg-rose-400 text-rose-950"}`}
            >
              ?
            </span>
          )}
        </div>
      ),
      onPieceDrop,
    }),
    [
      position,
      boardOrientation,
      arrows,
      squareStyles,
      onSquareClick,
      bestFrom,
      qualitySquare,
      quality,
      onPieceDrop,
    ],
  );

  return (
    <div className="h-full w-full" data-component="analysis-chessboard">
      <Chessboard options={options} />
    </div>
  );
});

export function AnalysisReview({ matchId }: { matchId: string }) {
  type QualityRequest = {
    beforeFen: string;
    afterFen: string;
    playedUci: string;
    qualityKey: string;
    whiteMoved: boolean;
    phase: "before" | "after";
    bestBefore?: EngineMove;
  };
  const user = useAuthStore((state) => state.user);
  const {
    data: match,
    isLoading: matchLoading,
    isError: matchError,
  } = useMatch(matchId);
  const { data: moves = [], isLoading: movesLoading } = useMatchMoves(matchId);
  const [moveNumber, setMoveNumber] = useState(0);
  const [variationMoves, setVariationMoves] = useState<AnalysisMove[]>([]);
  const [selectedOpening, setSelectedOpening] = useState<{
    eco: string;
    name: string;
    pgn: string;
    moves: AnalysisMove[];
  } | null>(null);
  const [isOpeningLibraryOpen, setIsOpeningLibraryOpen] = useState(false);
  const [openingSearch, setOpeningSearch] = useState("");
  const [openingResultLimit, setOpeningResultLimit] = useState(50);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showBestMoveArrow, setShowBestMoveArrow] = useState(true);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [promotionRequest, setPromotionRequest] = useState<{
    from: string;
    to: string;
    color: "w" | "b";
  } | null>(null);
  const [playedMoveQuality, setPlayedMoveQuality] = useState<{
    key: string;
    quality: MoveQuality;
  } | null>(null);
  const qualityRequestRef = useRef<QualityRequest | null>(null);
  const qualityCacheRef = useRef(new Map<string, MoveQuality>());
  const openingReturnPositionRef = useRef<{
    moveNumber: number;
    variationMoves: AnalysisMove[];
  } | null>(null);

  const currentFen = useMemo(
    () =>
      moveNumber === 0
        ? INITIAL_FEN
        : (moves[moveNumber - 1]?.fen_after ?? INITIAL_FEN),
    [moveNumber, moves],
  );
  const variationFen = useMemo(
    () =>
      variationMoves.reduce<string | null>(
        (fen, move) => (fen ? applyMove(fen, move) : null),
        currentFen,
      ),
    [currentFen, variationMoves],
  );
  const displayedFen = variationFen ?? currentFen;
  const activePlayedMove = useMemo(() => {
    const variationMove = variationMoves.at(-1);
    const playedMove = variationMove ?? moves[moveNumber - 1];
    if (!playedMove || (!variationMove && moveNumber === 0)) return null;

    const beforeFen = variationMove
      ? variationMoves.slice(0, -1).reduce<string | null>(
          (fen, move) => (fen ? applyMove(fen, move) : null),
          currentFen,
        ) ?? currentFen
      : moveNumber === 1
        ? INITIAL_FEN
        : (moves[moveNumber - 2]?.fen_after ?? INITIAL_FEN);

    return {
      beforeFen,
      afterFen: displayedFen,
      playedUci: playedMove.uci,
      whiteMoved: beforeFen.split(" ")[1] === "w",
      qualityKey: `${matchId}:${moveNumber}:${beforeFen}:${playedMove.uci}:${displayedFen}`,
    };
  }, [currentFen, displayedFen, matchId, moveNumber, moves, variationMoves]);
  const openingMoves = useMemo(
    () => [
      ...moves.slice(0, moveNumber).map((move) => move.san),
      ...variationMoves.map((move) => move.san),
    ],
    [moveNumber, moves, variationMoves],
  );
  const { data: openingAnalysis } = useMatchOpening(matchId, openingMoves);
  const opening = openingAnalysis?.opening;
  const { data: openingCatalog = [], isLoading: isOpeningCatalogLoading } =
    useOpeningLibrary(isOpeningLibraryOpen);
  const filteredOpenings = useMemo(() => {
    const search = openingSearch.trim().toLocaleLowerCase();
    if (!search) return openingCatalog;
    return openingCatalog.filter((entry) =>
      `${entry.name} ${entry.eco} ${entry.pgn}`
        .toLocaleLowerCase()
        .includes(search),
    );
  }, [openingCatalog, openingSearch]);
  const visibleOpenings = filteredOpenings.slice(0, openingResultLimit);
  const openingPgn = opening?.pgn;
  const openingLine = useMemo(
    () => (openingPgn ? parseOpeningPgn(openingPgn) : []),
    [openingPgn],
  );
  const activePly = moveNumber + variationMoves.length;
  const activeMoveIsInBook = Boolean(
    activePlayedMove &&
      openingAnalysis &&
      activePly > 0 &&
      openingAnalysis.matched_plies >= activePly,
  );
  const isWhite = match && user ? match.white_id === user.user_id : true;
  const positionGame = useMemo(
    () => createPosition(displayedFen),
    [displayedFen],
  );
  const { analyze, result, isAnalyzing, error } = useStockfish();

  useEffect(() => {
    if (!match || match.result === "pending" || !user) return;
    if (activePlayedMove && openingMoves.length > 0 && !openingAnalysis) {
      qualityRequestRef.current = null;
      analyze(displayedFen, { depth: 14, multiPv: 3 });
      return;
    }
    if (activePlayedMove && activeMoveIsInBook) {
      qualityRequestRef.current = null;
      analyze(displayedFen, { depth: 14, multiPv: 3 });
      return;
    }
    const cachedQuality = activePlayedMove
      ? qualityCacheRef.current.get(activePlayedMove.qualityKey)
      : undefined;
    setPlayedMoveQuality(
      cachedQuality && activePlayedMove
        ? { key: activePlayedMove.qualityKey, quality: cachedQuality }
        : null,
    );
    if (activePlayedMove && !cachedQuality) {
      qualityRequestRef.current = { ...activePlayedMove, phase: "before" };
      analyze(activePlayedMove.beforeFen, { depth: 14, multiPv: 1 });
      return;
    }
    qualityRequestRef.current = null;
    analyze(displayedFen, { depth: 14, multiPv: 3 });
  }, [activeMoveIsInBook, activePlayedMove, analyze, displayedFen, match, openingAnalysis, openingMoves.length, user]);

  useEffect(() => {
    const request = qualityRequestRef.current;
    if (!request || isAnalyzing || !result) return;
    if (request.phase === "before" && result.fen === request.beforeFen) {
      request.bestBefore = result.moves[0];
      request.phase = "after";
      analyze(request.afterFen, { depth: 14, multiPv: 3 });
      return;
    }
    if (request.phase !== "after" || result.fen !== request.afterFen) return;

    const quality = classifyMove(
      request.playedUci,
      request.bestBefore,
      result.moves[0],
      request.whiteMoved,
    );
    if (quality) {
      qualityCacheRef.current.set(request.qualityKey, quality);
      setPlayedMoveQuality({ key: request.qualityKey, quality });
    }
    qualityRequestRef.current = null;
  }, [analyze, isAnalyzing, result]);

  const handleVariationMove = useCallback(
    (sourceSquare: string, targetSquare: string | null) => {
      if (!targetSquare) return false;
      const move = createMove(displayedFen, sourceSquare, targetSquare);
      if (!move) return false;
      setVariationMoves((current) => [...current, move]);
      setSelectedSquare(null);
      return true;
    },
    [displayedFen],
  );

  const boardOrientation = (isWhite !== isFlipped ? "white" : "black") as
    | "white"
    | "black";
  const checkedKingSquare = positionGame.isCheck()
    ? positionGame
        .board()
        .flat()
        .find(
          (piece) => piece?.type === "k" && piece.color === positionGame.turn(),
        )?.square
    : undefined;
  const legalTargets = useMemo(
    () =>
      selectedSquare
        ? positionGame
            .moves({ square: selectedSquare, verbose: true })
            .map((move) => move.to)
        : [],
    [positionGame, selectedSquare],
  );
  const squareStyles = useMemo<Record<string, React.CSSProperties>>(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (checkedKingSquare)
      styles[checkedKingSquare] = {
        background: "rgba(239, 68, 68, 0.62)",
        boxShadow: "inset 0 0 0 4px rgba(127, 29, 29, 0.9)",
      };
    if (selectedSquare)
      styles[selectedSquare] = {
        ...styles[selectedSquare],
        boxShadow: "inset 0 0 0 4px rgba(56, 189, 248, 0.95)",
      };
    for (const target of legalTargets) {
      const occupied = positionGame.get(target)?.type;
      styles[target] = {
        ...styles[target],
        background:
          styles[target]?.background ??
          (occupied
            ? "rgba(239, 68, 68, 0.35)"
            : "radial-gradient(circle, rgba(14, 165, 233, 0.7) 18%, transparent 20%)"),
        ...(occupied
          ? { boxShadow: "inset 0 0 0 4px rgba(14, 165, 233, 0.75)" }
          : {}),
      };
    }
    return styles;
  }, [checkedKingSquare, legalTargets, positionGame, selectedSquare]);

  const handleBoardSquareClick = useCallback(
    ({ square }: { square: string }) => {
      const clicked = square as Square;
      if (selectedSquare && legalTargets.includes(clicked)) {
        const movingPiece = positionGame.get(selectedSquare);
        const isPromotion =
          movingPiece?.type === "p" &&
          (clicked.endsWith("1") || clicked.endsWith("8"));
        if (isPromotion && movingPiece) {
          setPromotionRequest({
            from: selectedSquare,
            to: clicked,
            color: movingPiece.color,
          });
        } else {
          handleVariationMove(selectedSquare, clicked);
        }
        setSelectedSquare(null);
        return;
      }
      const piece = positionGame.get(clicked);
      setSelectedSquare(piece?.color === positionGame.turn() ? clicked : null);
    },
    [handleVariationMove, legalTargets, positionGame, selectedSquare],
  );

  const handlePieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: PieceDropHandlerArgs) => {
      if (!targetSquare) return false;
      const sourcePiece = positionGame.get(sourceSquare as Square);
      const reachesBackRank =
        sourcePiece?.type === "p" &&
        (targetSquare.endsWith("1") || targetSquare.endsWith("8"));
      if (reachesBackRank && sourcePiece) {
        setPromotionRequest({
          from: sourceSquare,
          to: targetSquare,
          color: sourcePiece.color,
        });
        return false;
      }
      return handleVariationMove(sourceSquare, targetSquare);
    },
    [handleVariationMove, positionGame],
  );

  // Eski sonuç analiz sürerken de tutulur; panel boşalmasın diye
  const isStale = !!result && result.fen !== displayedFen;
  const fresh = !isStale && !isAnalyzing;

  const panelMoves = useMemo(() => {
    if (!result) return [];
    return result.moves.slice(0, 3).map((move) => ({
      uci: move.uci,
      // displayedFen değil: sonucun kendi pozisyonu kullanılır
      san:
        createMove(
          result.fen,
          move.uci.slice(0, 2),
          move.uci.slice(2, 4),
          move.uci.slice(4) || undefined,
        )?.san ?? move.uci,
      score:
        move.mate !== undefined
          ? `M${Math.abs(move.mate)}`
          : move.evaluation === null
            ? "—"
            : `${move.evaluation > 0 ? "+" : ""}${move.evaluation.toFixed(2)}`,
    }));
  }, [result]);

  // Eval bar için eski değer de kalsın; ani ortaya sıçramasın
  const bestMove = result?.moves[0];
  // Tahta okları/rozetleri sadece güncel ve tamamlanmış sonuçla
  const boardBestMoves = fresh && result ? result.moves.slice(0, 3) : [];
  const bestFrom = boardBestMoves[0]?.uci.slice(0, 2);
  const visibleMoveQuality =
    activePlayedMove && playedMoveQuality?.key === activePlayedMove.qualityKey
      ? playedMoveQuality.quality
      : undefined;
  const visibleProblemQuality =
    visibleMoveQuality === "inaccuracy" ||
    visibleMoveQuality === "mistake" ||
    visibleMoveQuality === "blunder"
      ? visibleMoveQuality
      : undefined;
  const qualitySquare = visibleProblemQuality
    ? activePlayedMove?.playedUci.slice(2, 4)
    : undefined;
  const arrows = useMemo<Arrow[]>(() => {
    const move = fresh ? result?.moves[0]?.uci : undefined;
    return showBestMoveArrow && move
      ? [
          {
            startSquare: move.slice(0, 2),
            endSquare: move.slice(2, 4),
            color: "#38bdf8",
          },
        ]
      : EMPTY_ARROWS;
  }, [fresh, result, showBestMoveArrow]);

  if (matchLoading || movesLoading) {
    return (
      <div className="py-16 text-center text-sm text-zinc-400" data-component="analysis-loading-state">
        Loading game…
      </div>
    );
  }
  if (matchError || !match || !user || match.result === "pending") {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center text-white" data-component="analysis-unavailable-state">
        <p className="font-semibold">
          This game is not available for analysis.
        </p>
        <Link
          href="/dashboard/analysis"
          className="mt-4 inline-block text-sm text-zinc-400 underline"
        >
          Back to analysis library
        </Link>
      </div>
    );
  }

  const bestSan = fresh ? panelMoves[0]?.san : undefined;

  const selectMove = (nextMoveNumber: number) => {
    setPromotionRequest(null);
    setSelectedSquare(null);
    setVariationMoves([]);
    setMoveNumber(nextMoveNumber);
    setSelectedOpening(null);
    openingReturnPositionRef.current = null;
  };

  const closeOpeningLine = () => {
    setPromotionRequest(null);
    setSelectedSquare(null);
    const returnPosition = openingReturnPositionRef.current;
    if (returnPosition) {
      setMoveNumber(returnPosition.moveNumber);
      setVariationMoves(returnPosition.variationMoves);
    } else {
      setVariationMoves([]);
    }
    setSelectedOpening(null);
    openingReturnPositionRef.current = null;
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

  const openOpeningPosition = () => {
    if (!openingAnalysis) return;
    const targetPly = openingAnalysis.exit_ply ?? openingAnalysis.matched_plies;
    setPromotionRequest(null);
    setSelectedSquare(null);
    if (targetPly <= moveNumber) {
      selectMove(targetPly);
      return;
    }
    setVariationMoves((current) =>
      current.slice(0, targetPly - moveNumber),
    );
  };

  const openOpeningLine = (
    line: AnalysisMove[] = openingLine,
    throughPly = line.length,
    openingDetails = opening
      ? { eco: opening.eco, name: opening.name, pgn: opening.pgn }
      : null,
  ) => {
    if (line.length === 0) return;
    if (!openingReturnPositionRef.current) {
      openingReturnPositionRef.current = { moveNumber, variationMoves };
    }
    setPromotionRequest(null);
    setSelectedSquare(null);
    setMoveNumber(0);
    setVariationMoves(line.slice(0, throughPly));
    setSelectedOpening(
      openingDetails ? { ...openingDetails, moves: line } : null,
    );
  };

  return (
    <main className="mx-auto w-full max-w-6xl text-white" data-component="analysis-review">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3" data-component="analysis-header">
        <div>
          <Link
            href="/dashboard/analysis"
            className="text-xs text-zinc-500 hover:text-white"
          >
            ← Analysis library
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Game analysis</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {match.white_username} vs {match.black_username} ·{" "}
            {match.time_control}
          </p>
        </div>
        <p
          aria-live="polite"
          className="w-56 truncate text-right text-sm tabular-nums text-zinc-400"
          data-component="analysis-status"
        >
          {error ??
            (isAnalyzing
              ? "Evaluating position…"
              : bestMove
                ? "Position evaluated"
                : "Evaluation unavailable")}
        </p>
      </div>

      <section
        aria-label="Rating changes"
        className="mb-6 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm sm:grid-cols-2"
        data-component="rating-changes"
      >
        <RatingChange
          username={match.white_username}
          before={match.white_rating}
          after={match.white_rating_after}
          color="White"
        />
        <RatingChange
          username={match.black_username}
          before={match.black_rating}
          after={match.black_rating_after}
          color="Black"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]" data-component="analysis-workspace">
        <section data-component="analysis-board-panel">
          <div className="mx-auto mb-3 flex w-full max-w-3xl flex-wrap items-center justify-between gap-2" data-component="analysis-board-controls">
            <div className="flex min-h-7 flex-wrap items-center gap-2 text-xs text-zinc-400">
              {checkedKingSquare && (
                <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-red-300">
                  Check
                </span>
              )}
              {selectedSquare && <span>Legal moves highlighted</span>}
              <AnalysisSymbolInfo />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowBestMoveArrow((shown) => !shown)}
                disabled={!bestMove}
                aria-pressed={showBestMoveArrow}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-40"
              >
                {showBestMoveArrow ? "Hide best move" : "Show best move"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsFlipped((flipped) => !flipped);
                  setSelectedSquare(null);
                }}
                aria-label="Flip analysis board"
                className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800"
              >
                <ArrowPathIcon className="h-4 w-4" aria-hidden="true" /> Flip
                board
              </button>
            </div>
          </div>
          <div className="mx-auto grid w-full max-w-3xl grid-cols-[1rem_minmax(0,1fr)] items-stretch gap-3" data-component="analysis-evaluation-and-board">
            <EvaluationBar move={bestMove} whiteAtBottom={isWhite} />
            <div className="relative aspect-square w-full min-w-0 overflow-hidden rounded-lg shadow-xl" data-component="analysis-board-frame">
              <AnalysisChessboard
                position={displayedFen}
                boardOrientation={boardOrientation}
                arrows={arrows}
                squareStyles={squareStyles}
                bestFrom={bestFrom}
                qualitySquare={qualitySquare}
                quality={visibleProblemQuality}
                onSquareClick={handleBoardSquareClick}
                onPieceDrop={handlePieceDrop}
              />
              {promotionRequest && (
                <div data-component="analysis-promotion-picker">
                  <PromotionPicker
                    color={promotionRequest.color}
                    onSelectAction={(promotion) => {
                      const move = createMove(
                        displayedFen,
                        promotionRequest.from,
                        promotionRequest.to,
                        promotion,
                      );
                      if (move)
                        setVariationMoves((current) => [...current, move]);
                      setPromotionRequest(null);
                    }}
                    onCancelAction={() => setPromotionRequest(null)}
                  />
                </div>
              )}
            </div>
          </div>
          <div className="mx-auto mt-4 flex w-full max-w-3xl items-center justify-between gap-3" data-component="analysis-move-navigation">
            <div className="min-w-0 flex-1 text-sm text-zinc-400" data-component="analysis-position-summary">
              <p className="truncate">
                {variationMoves.length > 0
                  ? `Exploring: ${variationMoves.map((move) => move.san).join(" ")}`
                  : moveNumber === 0
                    ? "Starting position"
                    : "Move " +
                      Math.ceil(moveNumber / 2) +
                      (moveNumber % 2 === 1 ? " · White" : " · Black")}
                {bestSan && (
                  <span className="ml-2 font-mono text-white">
                    Best: {bestSan}
                  </span>
                )}
              </p>
              <p className="mt-1 truncate text-xs text-zinc-500">
                {variationMoves.length > 0
                  ? `Alternative line · ${variationMoves.length} ${variationMoves.length === 1 ? "move" : "moves"}`
                  : "Drag a piece to explore another move."}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => {
                  if (selectedOpening) setVariationMoves([]);
                  else selectMove(0);
                }}
                disabled={selectedOpening ? variationMoves.length === 0 : moveNumber === 0 && variationMoves.length === 0}
                className="rounded-md border border-zinc-700 px-3 py-2 text-sm disabled:opacity-40"
              >
                First
              </button>
              <button
                type="button"
                onClick={stepBack}
                disabled={moveNumber === 0 && variationMoves.length === 0}
                className="rounded-md border border-zinc-700 px-3 py-2 text-sm disabled:opacity-40"
              >
                {variationMoves.length > 0 ? "Undo" : "Previous"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (selectedOpening) {
                    setVariationMoves(
                      selectedOpening.moves.slice(0, variationMoves.length + 1),
                    );
                  } else {
                    selectMove(Math.min(moves.length, moveNumber + 1));
                  }
                }}
                disabled={selectedOpening ? variationMoves.length >= selectedOpening.moves.length : moveNumber >= moves.length || variationMoves.length > 0}
                className="rounded-md border border-zinc-700 px-3 py-2 text-sm disabled:opacity-40"
              >
                Next
              </button>
              <button
                type="button"
                onClick={() => {
                  if (selectedOpening) {
                    setVariationMoves(selectedOpening.moves);
                  } else {
                    selectMove(moves.length);
                  }
                }}
                disabled={selectedOpening ? variationMoves.length >= selectedOpening.moves.length : moveNumber >= moves.length}
                className="rounded-md border border-zinc-700 px-3 py-2 text-sm disabled:opacity-40"
              >
                Last
              </button>
            </div>
          </div>
          {variationMoves.length > 0 && (
            <section
              aria-label="Alternative line"
              className="mx-auto mt-4 w-full max-w-3xl rounded-xl border border-sky-400/20 bg-sky-400/5 p-4"
              data-component="analysis-alternative-route"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
                    Alternative line
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Branch point:{" "}
                    {moveNumber === 0
                      ? "starting position"
                      : (moves[moveNumber - 1]?.san ?? `move ${moveNumber}`)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedOpening) {
                        closeOpeningLine();
                      } else {
                        setVariationMoves([]);
                        setSelectedSquare(null);
                        setPromotionRequest(null);
                      }
                    }}
                    className="rounded-lg bg-sky-300/10 px-3 py-2 text-xs font-medium text-sky-200 hover:bg-sky-300/20"
                  >
                    Return to game
                  </button>
                </div>
              </div>
              <ol
                className="mt-3 flex flex-wrap gap-2"
                aria-label="Moves in alternative line"
              >
                {variationMoves.map((move, index) => (
                  <li key={`${index}-${move.uci}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setVariationMoves((current) =>
                          current.slice(0, index + 1),
                        );
                        setSelectedSquare(null);
                      }}
                      aria-label={`Show alternative line through ${move.san}`}
                      className={`rounded-lg px-2.5 py-1.5 font-mono text-sm ${index === variationMoves.length - 1 ? "bg-sky-300 text-zinc-950" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
                    >
                      {Math.floor((moveNumber + index) / 2) + 1}
                      {(moveNumber + index) % 2 === 0 ? "." : "…"} {move.san}
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </section>

        <aside className="flex h-[80vh] min-h-128 max-h-208 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900" data-component="analysis-sidebar">
          <section className="flex min-h-0 flex-1 flex-col" data-component="analysis-move-history-panel">
            <div className="shrink-0 border-b border-zinc-800 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">Game moves</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsOpeningLibraryOpen((open) => !open)}
                    aria-expanded={isOpeningLibraryOpen}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${isOpeningLibraryOpen ? "border-sky-300/40 bg-sky-300/15 text-sky-100" : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"}`}
                  >
                    <BookOpenIcon className="h-4 w-4" />
                    Openings
                  </button>
                  <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs tabular-nums text-zinc-400">
                    {moves.length}
                  </span>
                </div>
              </div>
            </div>
            {isOpeningLibraryOpen && (
              <section
                aria-label="Opening library"
                className="mx-3 mt-3 flex min-h-0 flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950/70"
                data-component="opening-library"
              >
                <label className="flex shrink-0 items-center gap-2 border-b border-zinc-800 px-3 py-2.5 text-zinc-500">
                  <MagnifyingGlassIcon className="h-4 w-4" />
                  <input
                    type="search"
                    value={openingSearch}
                    onChange={(event) => {
                      setOpeningSearch(event.target.value);
                      setOpeningResultLimit(50);
                    }}
                    placeholder="Search all openings"
                    className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
                    aria-label="Search all openings"
                  />
                  <span className="text-xs tabular-nums text-zinc-500">
                    {filteredOpenings.length}
                  </span>
                </label>
                <div className="min-h-0 overflow-y-auto p-2">
                  {isOpeningCatalogLoading ? (
                    <p className="px-2 py-4 text-center text-xs text-zinc-500">
                      Loading openings…
                    </p>
                  ) : openingCatalog.length === 0 ? (
                    <p className="px-2 py-4 text-center text-xs text-zinc-500">
                      Opening library is unavailable. Reconnect and try again.
                    </p>
                  ) : visibleOpenings.length === 0 ? (
                    <p className="px-2 py-4 text-center text-xs text-zinc-500">
                      No openings match this search.
                    </p>
                  ) : (
                    <>
                      <ul className="space-y-2">
                        {visibleOpenings.map((entry) => (
                          <li
                            key={`${entry.eco}-${entry.name}-${entry.pgn}`}
                            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-zinc-100">
                                  {entry.name}
                                </p>
                                <p className="mt-1 font-mono text-[11px] leading-relaxed text-zinc-400">
                                  {entry.pgn}
                                </p>
                              </div>
                              <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
                                {entry.eco}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const line = parseOpeningPgn(entry.pgn);
                                openOpeningLine(line, line.length, {
                                  eco: entry.eco,
                                  name: entry.name,
                                  pgn: entry.pgn,
                                });
                              }}
                              className="mt-2 rounded-md border border-sky-300/20 px-2 py-1 text-[11px] font-medium text-sky-200 transition hover:bg-sky-300/10"
                            >
                              Show on board
                            </button>
                          </li>
                        ))}
                      </ul>
                      {visibleOpenings.length < filteredOpenings.length && (
                        <button
                          type="button"
                          onClick={() => setOpeningResultLimit((limit) => limit + 50)}
                          className="mt-2 w-full rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800"
                        >
                          Show more ({filteredOpenings.length - visibleOpenings.length} remaining)
                        </button>
                      )}
                    </>
                  )}
                </div>
              </section>
            )}
            {selectedOpening ? (
              <div className="mx-4 my-3 rounded-xl border border-sky-400/20 bg-linear-to-br from-sky-400/8 to-zinc-900 px-4 py-3 text-zinc-400" data-component="selected-opening-line">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-100">
                      {selectedOpening.name}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      {selectedOpening.eco}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeOpeningLine}
                    aria-label="Close opening line and return to game"
                    title="Close opening line"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-zinc-700 text-zinc-400 transition hover:border-zinc-500 hover:bg-zinc-800 hover:text-white"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
                <ol className="mt-3 flex flex-wrap gap-1.5" aria-label={`${selectedOpening.name} moves`}>
                  {selectedOpening.moves.map((move, index) => (
                    <li key={`${move.uci}-${index}`}>
                      <button
                        type="button"
                        onClick={() => {
                          setVariationMoves(selectedOpening.moves.slice(0, index + 1));
                          setSelectedSquare(null);
                          setPromotionRequest(null);
                        }}
                        aria-label={`Show ${selectedOpening.name} through ${move.san}`}
                        aria-current={variationMoves.length === index + 1 ? "step" : undefined}
                        className={`rounded-md px-2 py-1 font-mono text-xs transition ${variationMoves.length === index + 1 ? "bg-sky-300 text-zinc-950" : "bg-zinc-800 text-zinc-200 hover:bg-sky-300/20 hover:text-sky-100"}`}
                      >
                        {Math.floor(index / 2) + 1}{index % 2 === 0 ? "." : "…"} {move.san}
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            ) : openingAnalysis && openingAnalysis.total_plies > 0 ? (
              <div className="mx-4 my-3 rounded-xl border border-sky-400/15 bg-linear-to-br from-sky-400/6 to-zinc-900 px-4 py-3 text-zinc-400" data-component="opening-summary">
                <p className="text-sm font-semibold text-zinc-100">
                  {opening?.name ?? "Unclassified opening line"}
                </p>
                {openingLine.length > 0 && (
                  <>
                    <ol className="mt-3 flex flex-wrap gap-1.5" aria-label={`${opening?.name ?? "Opening"} moves`}>
                      {openingLine.map((move, index) => (
                        <li key={`${move.uci}-${index}`}>
                          <button
                            type="button"
                            onClick={() => openOpeningLine(openingLine, index + 1)}
                            aria-label={`Show opening through ${move.san}`}
                            className="rounded-md bg-zinc-800 px-2 py-1 font-mono text-xs text-zinc-200 transition hover:bg-sky-300/20 hover:text-sky-100"
                          >
                            {Math.floor(index / 2) + 1}{index % 2 === 0 ? "." : "…"} {move.san}
                          </button>
                        </li>
                      ))}
                    </ol>
                    <button
                      type="button"
                      onClick={() => openOpeningLine()}
                      className="mt-3 w-full rounded-lg border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-xs font-semibold text-sky-100 transition hover:bg-sky-300/20"
                    >
                      Open this opening line on the board
                    </button>
                  </>
                )}
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="min-w-0 text-xs text-zinc-400">
                    {openingAnalysis.exit_ply
                      ? `Left book at ${Math.ceil(openingAnalysis.exit_ply / 2)}.${openingAnalysis.exit_ply % 2 === 1 ? "" : "…"} ${openingAnalysis.exit_move}`
                      : `In book through ${openingAnalysis.matched_plies} plies`}
                  </p>
                  <button
                    type="button"
                    onClick={openOpeningPosition}
                    className="shrink-0 rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-sky-300/40 hover:bg-sky-300/10"
                  >
                    {openingAnalysis.exit_ply ? "View exit" : "View line"}
                  </button>
                </div>
              </div>
            ) : null}
            <div className="min-h-0 flex-1" data-component="analysis-move-history">
              <MoveHistory
                moves={moves}
                isLoading={false}
                selectedMoveNumber={moveNumber || null}
                onMoveSelect={selectMove}
                showClock
              />
            </div>
          </section>
          <section
            aria-label="Best three moves"
            className="h-52 shrink-0 border-t border-zinc-800 px-5 py-4"
            data-component="engine-suggestions"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Engine suggestions</h2>
            </div>
            <div
              className={`mt-3 space-y-2 transition-opacity duration-200 ${isStale || isAnalyzing ? "opacity-60" : "opacity-100"}`}
            >
              {[0, 1, 2].map((index) => {
                const move = panelMoves[index];
                return (
                  <div
                    key={index}
                    className="flex h-10 items-center justify-between rounded-lg bg-zinc-950/70 px-3"
                  >
                    <span className="flex items-center gap-3">
                      <span className="grid h-6 w-6 place-items-center rounded-md bg-zinc-800 text-xs text-zinc-400">
                        {index + 1}
                      </span>
                      <span className="font-mono text-sm font-semibold">
                        {move?.san ?? "—"}
                      </span>
                    </span>
                    <span className="min-w-14 text-right font-mono text-xs tabular-nums text-zinc-400">
                      {move?.score ?? ""}
                    </span>
                  </div>
                );
              })}
            </div>
            {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
          </section>
        </aside>
      </div>
    </main>
  );
}

function RatingChange({
  username,
  before,
  after,
  color,
}: {
  username: string;
  before: number;
  after: number | null;
  color: string;
}) {
  const change = after === null ? null : after - before;
  const changeColor =
    change === null || change === 0
      ? "text-zinc-400"
      : change > 0
        ? "text-emerald-400"
        : "text-rose-400";
  return (
    <div className="flex items-center justify-between gap-3" data-component="rating-change" data-player-color={color.toLowerCase()}>
      <span className="text-zinc-400">
        {color} · {username}
      </span>
      <span className="font-mono text-white">
        {before}
        {after !== null && (
          <>
            {" "}
            → {after}{" "}
            <span className={changeColor}>
              ({change! > 0 ? "+" : ""}
              {change})
            </span>
          </>
        )}
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
  const whiteAdvantage =
    move?.mate !== undefined
      ? move.mate > 0
        ? 100
        : move.mate < 0
          ? 0
          : 50
      : move?.evaluation === null || move?.evaluation === undefined
        ? 50
        : Math.max(4, Math.min(96, 50 + move.evaluation * (50 / 12)));
  const label =
    move?.mate !== undefined
      ? "Mate in " + Math.abs(move.mate)
      : move?.evaluation === null || move?.evaluation === undefined
        ? "No evaluation"
        : (move.evaluation > 0 ? "+" : "") + move.evaluation.toFixed(2);

  return (
    <div
      className="flex shrink-0 flex-col items-center gap-2"
      aria-label={"Position evaluation: " + label}
      data-component="analysis-evaluation-bar"
    >
      <div
        className="relative h-full min-h-0 w-4 overflow-hidden rounded-full border border-zinc-700 bg-zinc-950"
        role="meter"
        aria-label="White advantage percentage"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(whiteAdvantage)}
      >
        <div
          className="absolute inset-x-0 bg-zinc-100 transition-[height] duration-300"
          style={
            whiteAtBottom
              ? { bottom: 0, height: `${whiteAdvantage}%` }
              : { top: 0, height: `${whiteAdvantage}%` }
          }
        />
        <div
          className="absolute inset-x-0 bg-zinc-950 transition-[height] duration-300"
          style={
            whiteAtBottom
              ? { top: 0, height: `${100 - whiteAdvantage}%` }
              : { bottom: 0, height: `${100 - whiteAdvantage}%` }
          }
        />
      </div>
      <span className="font-mono text-xs text-zinc-300">{label}</span>
    </div>
  );
}
