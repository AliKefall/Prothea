"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  CpuChipIcon,
  FlagIcon,
} from "@heroicons/react/24/outline";
import { Chess, type Square } from "chess.js";
import { Chessboard, type PieceDropHandlerArgs } from "react-chessboard";

import { PromotionPicker } from "@/features/chess/components/promotion-picker";
import { useStockfish } from "@/features/analysis/hooks/use-stockfish";

type ChessColor = "w" | "b";

export interface BotLevel {
  id: string;
  name: string;
  elo: number;
  description: string;
}

export const BOT_LEVELS: BotLevel[] = [
  {
    id: "beginner",
    name: "Beginner",
    elo: 1320,
    description: "A relaxed first challenge",
  },
  {
    id: "casual",
    name: "Casual",
    elo: 1500,
    description: "A friendly practice game",
  },
  {
    id: "club",
    name: "Club player",
    elo: 1800,
    description: "A steady, practical opponent",
  },
  {
    id: "expert",
    name: "Expert",
    elo: 2200,
    description: "A demanding tactical game",
  },
  {
    id: "master",
    name: "Master",
    elo: 2600,
    description: "A serious engine challenge",
  },
];

const BOT_MOVE_STYLES = [
  {
    id: "precise",
    name: "Most accurate",
    multiPv: 1,
    description: "Always choose the engine's top line.",
  },
  {
    id: "varied",
    name: "Varied",
    multiPv: 3,
    description: "Choose between the three leading moves.",
  },
  {
    id: "surprise",
    name: "Surprise me",
    multiPv: 5,
    description: "Pick from a wider set of candidate moves.",
  },
] as const;

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function BotMatchPage() {
  const [level, setLevel] = useState(BOT_LEVELS[0]);
  const [moveStyle, setMoveStyle] = useState<(typeof BOT_MOVE_STYLES)[number]>(
    BOT_MOVE_STYLES[0],
  );
  const [playerColor, setPlayerColor] = useState<ChessColor>("w");
  const [started, setStarted] = useState(false);
  const [gameKey, setGameKey] = useState(0);

  if (!started) {
    return (
      <section className="mx-auto max-w-4xl space-y-8">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">
            Practice
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
            Play a bot
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Choose an approximate engine rating and your side. These games stay
            on this device and never affect your profile, rating, or game
            history.
          </p>
        </header>

        <section aria-labelledby="bot-level-heading">
          <h2
            id="bot-level-heading"
            className="mb-3 text-sm font-semibold text-zinc-200"
          >
            Choose an opponent
          </h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {BOT_LEVELS.map((option) => {
              const selected = level.id === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setLevel(option)}
                  className={`rounded-2xl border p-5 text-left transition ${selected ? "border-sky-300/60 bg-sky-300/10 ring-1 ring-sky-300/20" : "border-zinc-800 bg-zinc-900/70 hover:border-zinc-600"}`}
                >
                  <span className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">
                      {option.name}
                    </span>
                    <CpuChipIcon
                      className={`h-5 w-5 ${selected ? "text-sky-300" : "text-zinc-500"}`}
                      aria-hidden="true"
                    />
                  </span>
                  <span className="mt-3 block text-2xl font-bold text-zinc-100">
                    {option.elo}
                  </span>
                  <span className="mt-0.5 block text-xs text-zinc-500">
                    approx. Elo
                  </span>
                  <span className="mt-3 block text-sm text-zinc-400">
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="bot-style-heading">
          <h2
            id="bot-style-heading"
            className="mb-3 text-sm font-semibold text-zinc-200"
          >
            Choose how the bot plays
          </h2>
          <div className="grid gap-3 md:grid-cols-3">
            {BOT_MOVE_STYLES.map((option) => {
              const selected = moveStyle.id === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setMoveStyle(option)}
                  className={`rounded-2xl border p-4 text-left transition ${selected ? "border-violet-300/60 bg-violet-300/10 ring-1 ring-violet-300/20" : "border-zinc-800 bg-zinc-900/70 hover:border-zinc-600"}`}
                >
                  <span className="block text-sm font-semibold text-white">
                    {option.name}
                  </span>
                  <span className="mt-2 block text-sm leading-5 text-zinc-400">
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="side-heading">
          <h2
            id="side-heading"
            className="mb-3 text-sm font-semibold text-zinc-200"
          >
            Play as
          </h2>
          <div className="flex gap-3">
            {(["w", "b"] as const).map((color) => (
              <button
                key={color}
                type="button"
                aria-pressed={playerColor === color}
                onClick={() => setPlayerColor(color)}
                className={`flex min-w-32 items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition ${playerColor === color ? "border-sky-300/60 bg-sky-300/10 text-white" : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600"}`}
              >
                <span
                  aria-hidden="true"
                  className={`h-5 w-5 rounded-full border ${color === "w" ? "border-zinc-500 bg-white" : "border-zinc-500 bg-zinc-800"}`}
                />
                {color === "w" ? "White" : "Black"}
              </button>
            ))}
          </div>
        </section>

        <button
          type="button"
          onClick={() => {
            setGameKey((key) => key + 1);
            setStarted(true);
          }}
          className="rounded-xl bg-sky-300 px-6 py-3 text-sm font-bold text-zinc-950 transition hover:bg-sky-200"
        >
          Start practice game
        </button>
      </section>
    );
  }

  return (
    <BotGame
      key={gameKey}
      level={level}
      moveStyle={moveStyle}
      playerColor={playerColor}
      onExit={() => setStarted(false)}
      onRestart={() => setGameKey((key) => key + 1)}
    />
  );
}

function BotGame({
  level,
  moveStyle,
  playerColor,
  onExit,
  onRestart,
}: {
  level: BotLevel;
  moveStyle: (typeof BOT_MOVE_STYLES)[number];
  playerColor: ChessColor;
  onExit: () => void;
  onRestart: () => void;
}) {
  const gameRef = useRef(new Chess(INITIAL_FEN));
  const [fen, setFen] = useState(INITIAL_FEN);
  const [turn, setTurn] = useState<ChessColor>("w");
  const [moves, setMoves] = useState<string[]>([]);
  const [promotionRequest, setPromotionRequest] = useState<{
    from: Square;
    to: Square;
    color: ChessColor;
  } | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const botColor: ChessColor = playerColor === "w" ? "b" : "w";
  const {
    analyze,
    stop,
    result,
    isAnalyzing,
    error: engineError,
  } = useStockfish();

  const makeMove = useCallback(
    (
      from: Square,
      to: Square,
      promotion?: "q" | "r" | "b" | "n",
      botMove = false,
    ) => {
      try {
        const move = gameRef.current.move({
          from,
          to,
          ...(promotion ? { promotion } : {}),
        });
        if (!move) {
          if (botMove)
            setMoveError(
              "The engine returned an invalid move. Try starting a new game.",
            );
          return false;
        }
        const current = gameRef.current;
        setFen(current.fen());
        setTurn(current.turn());
        setMoves(current.history());
        setMoveError(null);
        if (current.isGameOver()) setResultMessage(getGameResult(current));
        return true;
      } catch {
        if (botMove)
          setMoveError(
            "The engine returned an invalid move. Try starting a new game.",
          );
        return false;
      }
    },
    [],
  );

  const handlePieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: PieceDropHandlerArgs) => {
      if (
        !targetSquare ||
        resultMessage ||
        gameRef.current.turn() !== playerColor
      )
        return false;
      const from = sourceSquare as Square;
      const to = targetSquare as Square;
      const piece = gameRef.current.get(from);
      if (!piece || piece.color !== playerColor) return false;

      const promotes = gameRef.current
        .moves({ square: from, verbose: true })
        .some((move) => move.to === to && move.promotion);
      if (promotes) {
        setPromotionRequest({ from, to, color: piece.color });
        return false;
      }
      return makeMove(from, to);
    },
    [makeMove, playerColor, resultMessage],
  );

  useEffect(() => {
    const game = gameRef.current;
    if (
      resultMessage ||
      game.isGameOver() ||
      game.turn() !== botColor ||
      isAnalyzing
    )
      return;

    if (result?.fen === fen) {
      const candidates = result.moves.slice(0, moveStyle.multiPv);
      const bestMove =
        candidates[Math.floor(Math.random() * candidates.length)]?.uci;
      if (!bestMove || bestMove.length < 4) {
        return;
      }
      const promotion = bestMove[4] as "q" | "r" | "b" | "n" | undefined;
      const timer = window.setTimeout(() => {
        if (
          gameRef.current.fen() === fen &&
          gameRef.current.turn() === botColor &&
          !gameRef.current.isGameOver()
        ) {
          makeMove(
            bestMove.slice(0, 2) as Square,
            bestMove.slice(2, 4) as Square,
            promotion,
            true,
          );
        }
      }, 0);
      return () => window.clearTimeout(timer);
    }

    analyze(fen, { depth: 16, multiPv: moveStyle.multiPv, elo: level.elo });
  }, [
    analyze,
    botColor,
    fen,
    isAnalyzing,
    level.elo,
    makeMove,
    moveStyle.multiPv,
    result,
    resultMessage,
  ]);

  const boardOrientation = playerColor === "w" ? "white" : "black";
  const isPlayerTurn = turn === playerColor && !resultMessage;
  const missingBotMove =
    result?.fen === fen && result.moves.length === 0
      ? "The engine did not return a legal move. Try starting a new game."
      : null;
  const historyRows = useMemo(
    () =>
      Array.from({ length: Math.ceil(moves.length / 2) }, (_, index) => ({
        number: index + 1,
        white: moves[index * 2],
        black: moves[index * 2 + 1],
      })),
    [moves],
  );

  return (
    <section className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">
            Local practice · no rating changes
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-white">
            You vs {level.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Approx. {level.elo} Elo · {moveStyle.name} ·{" "}
            {playerColor === "w" ? "You play White" : "You play Black"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onRestart}
            className="flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900"
          >
            <ArrowPathIcon className="h-4 w-4" aria-hidden="true" /> New game
          </button>
          <button
            type="button"
            onClick={onExit}
            className="flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-white"
          >
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" /> Opponents
          </button>
        </div>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="relative mx-auto w-full max-w-[min(76vh,680px)] rounded-2xl border border-zinc-800 bg-zinc-900 p-2 sm:p-3">
          <Chessboard
            options={{
              position: fen,
              boardOrientation,
              allowDragging: isPlayerTurn && !promotionRequest,
              onPieceDrop: handlePieceDrop,
            }}
          />
          {promotionRequest && (
            <PromotionPicker
              color={promotionRequest.color}
              onSelectAction={(piece) => {
                makeMove(promotionRequest.from, promotionRequest.to, piece);
                setPromotionRequest(null);
              }}
              onCancelAction={() => setPromotionRequest(null)}
            />
          )}
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Game status</h2>
              <span
                className={`h-2 w-2 rounded-full ${isAnalyzing ? "animate-pulse bg-sky-300" : "bg-emerald-400"}`}
              />
            </div>
            <p className="mt-3 text-sm text-zinc-300">
              {resultMessage ??
                (isAnalyzing
                  ? "Bot is thinking…"
                  : isPlayerTurn
                    ? "Your move"
                    : "Bot to move")}
            </p>
            {(engineError || moveError || missingBotMove) && (
              <p role="alert" className="mt-3 text-xs leading-5 text-red-300">
                {engineError ?? moveError ?? missingBotMove}
              </p>
            )}
            {resultMessage && (
              <button
                type="button"
                onClick={onRestart}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-sky-300 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-sky-200"
              >
                <ArrowPathIcon className="h-4 w-4" aria-hidden="true" /> Play
                again
              </button>
            )}
            {!resultMessage && (
              <button
                type="button"
                onClick={() => {
                  stop();
                  setResultMessage("You resigned. The bot wins.");
                }}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-400 transition hover:border-red-400/40 hover:text-red-300"
              >
                <FlagIcon className="h-4 w-4" aria-hidden="true" /> Resign
              </button>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
            <div className="grid grid-cols-[2.5rem_1fr_1fr] border-b border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-500">
              <span>#</span>
              <span>White</span>
              <span>Black</span>
            </div>
            <div className="max-h-[50vh] overflow-y-auto">
              {historyRows.length ? (
                historyRows.map((row) => (
                  <div
                    key={row.number}
                    className="grid grid-cols-[2.5rem_1fr_1fr] border-b border-zinc-800/70 px-3 py-2 text-sm last:border-0"
                  >
                    <span className="text-zinc-600">{row.number}.</span>
                    <span className="text-zinc-200">{row.white ?? ""}</span>
                    <span className="text-zinc-200">{row.black ?? ""}</span>
                  </div>
                ))
              ) : (
                <p className="px-4 py-6 text-center text-sm text-zinc-500">
                  Moves will appear here.
                </p>
              )}
            </div>
          </section>
          <p className="text-xs leading-5 text-zinc-600">
            Practice games are stored only for this session. They do not enter
            your account history or online ratings.
          </p>
        </aside>
      </div>
    </section>
  );
}

function getGameResult(game: Chess): string {
  if (game.isCheckmate())
    return game.turn() === "w"
      ? "Checkmate — Black wins."
      : "Checkmate — White wins.";
  if (game.isStalemate()) return "Draw by stalemate.";
  if (game.isThreefoldRepetition()) return "Draw by threefold repetition.";
  if (game.isInsufficientMaterial()) return "Draw by insufficient material.";
  return "Draw.";
}
