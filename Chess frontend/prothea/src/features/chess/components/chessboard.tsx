"use client";

import { useEffect, useMemo, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard, type PieceDropHandlerArgs } from "react-chessboard";

import { useAuthStore } from "@/features/auth/auth-store";
import { websocketManager } from "@/lib/websocket";

import { useMatch } from "../hooks/use-match";
import { useMatchMoves } from "../hooks/use-match-moves";
import { useQueryClient } from "@tanstack/react-query";
import { GameResult } from "./game-result";

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

//NOTE: Tidy up this place, types and game logic must be sepearated.
//This one stays like this just for testing rn

interface ChessBoardProps {
  matchId: string;
}

interface GameMovePayload {
  match_id: string;
  move_number: number;
  player_id: string;
  from: string;
  to: string;
  promotion?: string;
  uci: string;
  san: string;
  fen_after: string;
  white_time_ms: number;
  black_time_ms: number;
  last_move_at: string;
}

interface WebSocketGameMoveMessage {
  type: string;
  payload: GameMovePayload;
}

interface GameFinishedPayload {
  match_id: string;

  result: "white" | "black" | "draw" | "abandoned";

  winner_id: string;
  loser_id: string;

  reason: string;

  white_rating_before: number;
  white_rating_after: number;

  black_rating_before: number;
  black_rating_after: number;

  created_at: string;
}

interface WebSocketGameFinishedMessage {
  type: "game_finished";
  payload: GameFinishedPayload;
}

interface ClockSnapshot {
  whiteTimeMs: number;
  blackTimeMs: number;
  lastMoveAt: number | null;
}

function parseInitialTimeMs(timeControl: string | undefined): number {
  if (!timeControl) {
    return 0;
  }

  const [minutes] = timeControl.split("+");
  const parsedMinutes = Number(minutes);

  if (!Number.isFinite(parsedMinutes) || parsedMinutes <= 0) {
    return 0;
  }

  return parsedMinutes * 60 * 1000;
}

function formatClock(timeMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(timeMs / 1000));

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function ChessBoard({ matchId }: ChessBoardProps) {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const {
    data: match,
    isLoading: isMatchLoading,
    isError: isMatchError,
  } = useMatch(matchId);

  const { data: movesData, isLoading: isMovesLoading } = useMatchMoves(matchId);

  /*
   * Memoize the fallback array so an undefined query result
   * does not produce a new reference during every render.
   */
  const moves = useMemo(() => {
    return movesData ?? [];
  }, [movesData]);

  /*
   * REST gives us the latest persisted board position.
   * The initial FEN is used until the first move exists.
   */
  const latestPosition = useMemo(() => {
    if (moves.length === 0) {
      return STARTING_FEN;
    }

    return moves[moves.length - 1].fen_after;
  }, [moves]);

  /*
   * WebSocket updates may arrive after the initial HTTP request.
   * This state stores the newest server-authoritative position.
   */
  const [livePosition, setLivePosition] = useState<string | null>(null);

  /*
   * Keep the latest clock snapshot received from the backend.
   * The client derives the visible countdown from this anchor.
   */
  const [clockSnapshot, setClockSnapshot] = useState<ClockSnapshot | null>(
    null,
  );

  /*
   * This timestamp drives the visual clock only.
   * Actual game time is still controlled by the backend.
   */
  const [clockNow, setClockNow] = useState(() => Date.now());

  /*
   * A finished flag prevents new local interactions after the
   * server declares the match over.
   */
  const [gameFinished, setGameFinished] = useState(false);

  /*
   * Store the complete finish payload so the UI can display
   * the final result and updated ratings.
   */
  const [finishResult, setFinishResult] = useState<GameFinishedPayload | null>(
    null,
  );

  /*
   * Prefer the live server position when one is available.
   * Otherwise fall back to the latest persisted board state.
   */
  const position = livePosition ?? latestPosition;

  /*
   * Chess.js is derived from the current FEN rather than stored
   * as mutable React state.
   */
  const game = useMemo(() => {
    return new Chess(position);
  }, [position]);

  /*
   * Convert the match time control into milliseconds.
   *
   * Examples:
   * 10+0 -> 600000 ms
   * 5+3  -> 300000 ms
   */
  const initialTimeMs = useMemo(() => {
    return parseInitialTimeMs(match?.time_control);
  }, [match?.time_control]);

  /*
   * Reconstruct the clock when the page is loaded from REST.
   *
   * Before the first move, neither player has consumed any time.
   * After moves exist, the most recent move timestamp acts as the
   * local reference point for the current clock snapshot.
   */
  const baseClock = useMemo<ClockSnapshot>(() => {
    const lastMove = moves[moves.length - 1];

    if (!lastMove) {
      return {
        whiteTimeMs: initialTimeMs,
        blackTimeMs: initialTimeMs,
        lastMoveAt: null,
      };
    }

    const lastMoveAt = Date.parse(lastMove.created_at);

    return {
      whiteTimeMs: lastMove.white_time_ms,
      blackTimeMs: lastMove.black_time_ms,
      lastMoveAt: Number.isFinite(lastMoveAt) ? lastMoveAt : null,
    };
  }, [moves, initialTimeMs]);

  const effectiveClock = clockSnapshot ?? baseClock;

  /*
   * Refresh the displayed clock only while the match is active.
   * A 250 ms interval keeps the countdown visually smooth.
   */
  useEffect(() => {
    if (
      match?.result !== "pending" ||
      gameFinished ||
      effectiveClock.lastMoveAt === null
    ) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setClockNow(Date.now());
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [match?.result, gameFinished, effectiveClock.lastMoveAt]);

  /*
   * Listen for authoritative game events from the WebSocket layer.
   * Move events update the board and clock, while finish events
   * freeze the game and preserve the final result data.
   */
  useEffect(() => {
    function handleMessage(message: unknown) {
      if (
        typeof message !== "object" ||
        message === null ||
        !("type" in message) ||
        !("payload" in message)
      ) {
        return;
      }

      if (message.type === "game_finished") {
        const wsMessage = message as WebSocketGameFinishedMessage;
        const payload = wsMessage.payload;

        if (!payload || payload.match_id !== matchId) {
          return;
        }

        setGameFinished(true);
        setFinishResult(payload);
        setClockNow(Date.now());

        /*
         * Synchronize the cached match with the authoritative
         * result received from the WebSocket server.
         */
        queryClient.setQueryData<typeof match>(
          ["match", matchId],
          (currentMatch) => {
            if (!currentMatch) {
              return currentMatch;
            }

            return {
              ...currentMatch,
              result: payload.result,
              white_rating: payload.white_rating_after,
              black_rating: payload.black_rating_after,
            };
          },
        );

        return;
      }

      if (message.type !== "game_move") {
        return;
      }

      const wsMessage = message as WebSocketGameMoveMessage;
      const payload = wsMessage.payload;

      if (!payload || payload.match_id !== matchId) {
        return;
      }

      const lastMoveAt = Date.parse(payload.last_move_at);

      if (!Number.isFinite(lastMoveAt)) {
        console.error(
          "Received an invalid move timestamp:",
          payload.last_move_at,
        );

        return;
      }

      try {
        /*
         * Reject malformed board positions before touching the
         * visible state.
         */
        new Chess(payload.fen_after);

        /*
         * Apply the server's canonical FEN to the local board.
         */
        setLivePosition(payload.fen_after);

        /*
         * Replace the local clock anchor with the backend snapshot.
         */
        setClockSnapshot({
          whiteTimeMs: payload.white_time_ms,
          blackTimeMs: payload.black_time_ms,
          lastMoveAt,
        });

        /*
         * Re-anchor the client-side visual countdown immediately.
         */
        setClockNow(Date.now());
      } catch (error) {
        console.error(
          "Unable to apply the chess position received over WebSocket:",
          error,
        );
      }
    }

    const unsubscribe = websocketManager.subscribe(handleMessage);

    return unsubscribe;
  }, [matchId, queryClient]);

  /*
   * The elapsed duration is used only to animate the active player's
   * clock between authoritative backend updates.
   */
  const elapsedMs =
    effectiveClock.lastMoveAt === null
      ? 0
      : Math.max(0, clockNow - effectiveClock.lastMoveAt);

  const isWhiteTurn = game.turn() === "w";

  const whiteDisplayTime = Math.max(
    0,
    effectiveClock.whiteTimeMs - (isWhiteTurn ? elapsedMs : 0),
  );

  const blackDisplayTime = Math.max(
    0,
    effectiveClock.blackTimeMs - (!isWhiteTurn ? elapsedMs : 0),
  );

  if (isMatchLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-zinc-950 text-white">
        <p className="text-sm text-zinc-500">Loading game...</p>
      </div>
    );
  }

  if (isMatchError || !match || !user) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-zinc-950 text-white">
        <div className="text-center">
          <p className="text-sm font-semibold">Unable to load game</p>

          <p className="mt-1 text-xs text-zinc-500">
            Game information could not be loaded.
          </p>
        </div>
      </div>
    );
  }

  const isWhite = match.white_id === user.user_id;

  const myColor = isWhite ? "w" : "b";

  const myUsername = isWhite ? match.white_username : match.black_username;

  const myRating = isWhite ? match.white_rating : match.black_rating;

  const opponentUsername = isWhite
    ? match.black_username
    : match.white_username;

  const opponentRating = isWhite ? match.black_rating : match.white_rating;

  function handlePieceDrop({
    sourceSquare,
    targetSquare,
  }: PieceDropHandlerArgs): boolean {
    if (!targetSquare) {
      return false;
    }

    /*
     * Do not allow moves after the server has ended the match.
     */
    if (gameFinished || match?.result !== "pending") {
      return false;
    }

    /*
     * Confirm that the source square contains a real piece.
     */
    const piece = game.get(sourceSquare as Square);

    if (!piece) {
      return false;
    }

    /*
     * The client blocks attempts to move an opponent's piece.
     */
    if (piece.color !== myColor) {
      return false;
    }

    /*
     * This is only a UI-side guard.
     * The backend performs the authoritative turn validation.
     */
    if (game.turn() !== myColor) {
      return false;
    }

    try {
      /*
       * Validate the move using a temporary Chess.js instance.
       * The visible board remains untouched until the server
       * accepts and broadcasts the move.
       */
      const nextGame = new Chess(game.fen());

      const move = nextGame.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });

      if (!move) {
        return false;
      }

      const uci = `${sourceSquare}${targetSquare}` + `${move.promotion ?? ""}`;

      /*
       * Send the candidate move to the backend.
       *
       * No local board mutation occurs here. The authoritative
       * game_move event is responsible for changing the position.
       */
      websocketManager.send("game_move", {
        match_id: matchId,
        from: sourceSquare,
        to: targetSquare,
        promotion: move.promotion ?? "",
        uci,
      });

      return true;
    } catch (error) {
      console.error("Failed to create chess move:", error);

      return false;
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-zinc-950 p-6 text-white">
      <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-center">
        <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Main chess area */}
          <section className="flex min-w-0 flex-col items-center">
            {/* Opponent information and clock */}
            <div className="mb-3 flex w-full max-w-130 items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800 text-sm font-bold">
                  {opponentUsername.charAt(0).toUpperCase()}
                </div>

                <div>
                  <p className="text-sm font-semibold">{opponentUsername}</p>

                  <p className="text-xs text-zinc-500">
                    {finishResult
                      ? isWhite
                        ? finishResult.black_rating_after
                        : finishResult.white_rating_after
                      : opponentRating}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2">
                <span className="font-mono text-xl font-bold">
                  {formatClock(isWhite ? blackDisplayTime : whiteDisplayTime)}
                </span>
              </div>
            </div>

            {/* Chess board */}
            <div className="w-full max-w-130 overflow-hidden rounded-lg shadow-2xl">
              <Chessboard
                options={{
                  position,
                  boardOrientation: isWhite ? "white" : "black",
                  allowDragging: !gameFinished && match.result === "pending",
                  onPieceDrop: handlePieceDrop,
                }}
              />
            </div>

            {/* Current player information and clock */}
            <div className="mt-3 flex w-full max-w-130 items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-sm font-bold text-black">
                  {myUsername.charAt(0).toUpperCase()}
                </div>

                <div>
                  <p className="text-sm font-semibold">{myUsername}</p>

                  <p className="text-xs text-zinc-500">
                    {finishResult
                      ? isWhite
                        ? finishResult.white_rating_after
                        : finishResult.black_rating_after
                      : myRating}
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-white px-4 py-2 text-black">
                <span className="font-mono text-xl font-bold">
                  {formatClock(isWhite ? whiteDisplayTime : blackDisplayTime)}
                </span>
              </div>
            </div>

            <p className="mt-3 max-w-130 truncate font-mono text-[10px] text-zinc-700">
              {match.id}
            </p>
          </section>

          {/* Game information sidebar */}
          <aside className="flex h-130 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
            {/* Match header */}
            <div className="border-b border-zinc-800 px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">Game</h2>

                  <p className="mt-1 text-xs text-zinc-500">
                    Rated · {match.time_control}
                  </p>
                </div>

                <span className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-400">
                  {gameFinished
                    ? "Finished"
                    : match.result === "pending"
                      ? "Ongoing"
                      : match.result}
                </span>
              </div>
            </div>

            {/* Move history */}
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {isMovesLoading ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-zinc-500">Loading moves...</p>
                </div>
              ) : moves.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-zinc-500">No moves yet.</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-zinc-800">
                  {/* Move table heading */}
                  <div className="grid grid-cols-[36px_1fr_1fr] bg-zinc-950 text-xs text-zinc-500">
                    <div className="px-3 py-2">#</div>

                    <div className="px-3 py-2">White</div>

                    <div className="px-3 py-2">Black</div>
                  </div>

                  {/* Pair white and black moves by move number */}
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
              )}
            </div>

            {gameFinished && finishResult && (
              <GameResult
                result={finishResult.result}
                reason={finishResult.reason}
                isWhite={isWhite}
                whiteRatingBefore={finishResult.white_rating_before}
                whiteRatingAfter={finishResult.white_rating_after}
                blackRatingBefore={finishResult.black_rating_before}
                blackRatingAfter={finishResult.black_rating_after}
              />
            )}
            {/* Match controls */}
            {!gameFinished && (
              <div className="border-t border-zinc-800 p-4">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800"
                  >
                    Draw
                  </button>

                  <button
  type="button"
  disabled={gameFinished || match.result !== "pending"}
  onClick={() => {
    websocketManager.send("game_resign", {
      match_id: matchId,
    });
  }}
  className="rounded-lg bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
>
  Resign
</button>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
