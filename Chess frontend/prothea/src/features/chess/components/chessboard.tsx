"use client";

import { useEffect, useMemo, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard, type PieceDropHandlerArgs } from "react-chessboard";
import { useQueryClient } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/auth-store";
import { websocketManager } from "@/lib/websocket";

import { useMatch } from "../hooks/use-match";
import { useMatchMoves } from "../hooks/use-match-moves";
import { GameResult } from "./game-result";
import { GameClock } from "./game-clock";

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

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

interface GameMove {
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
  created_at: string;
}

interface WebSocketGameMoveMessage {
  type: "game_move";
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

interface GameClockState {
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

function parseTimestamp(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) ? timestamp : null;
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

  const [liveMoves, setLiveMoves] = useState<GameMove[]>([]);
  const [livePosition, setLivePosition] = useState<string | null>(null);

  const [clockSnapshot, setClockSnapshot] = useState<GameClockState | null>(
    null,
  );

  const [gameFinished, setGameFinished] = useState(false);
  const [finishResult, setFinishResult] = useState<GameFinishedPayload | null>(
    null,
  );

  const [drawOfferSent, setDrawOfferSent] = useState(false);
  const [drawOfferReceived, setDrawOfferReceived] = useState(false);

  const moves = useMemo<GameMove[]>(() => {
    const merged = new Map<number, GameMove>();

    for (const move of movesData ?? []) {
      if (!move.uci || move.uci.length < 4) {
        continue;
      }

      const from = move.uci.slice(0, 2);
      const to = move.uci.slice(2, 4);
      const promotion = move.uci.length > 4 ? move.uci.slice(4) : undefined;

      merged.set(move.move_number, {
        move_number: move.move_number,
        player_id: move.player_id,
        from,
        to,
        promotion,
        uci: move.uci,
        san: move.san,
        fen_after: move.fen_after,
        white_time_ms: move.white_time_ms,
        black_time_ms: move.black_time_ms,
        created_at: move.created_at,
      });
    }

    for (const move of liveMoves) {
      merged.set(move.move_number, move);
    }

    return Array.from(merged.values()).sort(
      (a, b) => a.move_number - b.move_number,
    );
  }, [movesData, liveMoves]);

  const latestPosition = useMemo(() => {
    if (moves.length === 0) {
      return STARTING_FEN;
    }

    return moves[moves.length - 1].fen_after;
  }, [moves]);

  const position = livePosition ?? latestPosition;

  const game = useMemo(() => {
    try {
      return new Chess(position);
    } catch {
      return new Chess(STARTING_FEN);
    }
  }, [position]);

  const initialTimeMs = useMemo(
    () => parseInitialTimeMs(match?.time_control),
    [match?.time_control],
  );

  const baseClock = useMemo<GameClockState>(() => {
    const lastMove = moves[moves.length - 1];

    if (!lastMove) {
      return {
        whiteTimeMs: initialTimeMs,
        blackTimeMs: initialTimeMs,
        lastMoveAt: null,
      };
    }

    const lastMoveAt = parseTimestamp(lastMove.created_at);

    return {
      whiteTimeMs: lastMove.white_time_ms,
      blackTimeMs: lastMove.black_time_ms,
      lastMoveAt,
    };
  }, [moves, initialTimeMs]);

  const effectiveClock = clockSnapshot ?? baseClock;

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
        setDrawOfferSent(false);
        setDrawOfferReceived(false);

        queryClient.setQueryData(
          ["match", matchId],
          (currentMatch: typeof match) => {
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

      if (message.type === "game_draw_offer") {
        const payload = message.payload as {
          match_id?: string;
        };

        if (!payload || payload.match_id !== matchId) {
          return;
        }

        setDrawOfferReceived(true);
        setDrawOfferSent(false);

        return;
      }

      if (message.type === "game_draw_decline") {
        const payload = message.payload as {
          match_id?: string;
        };

        if (!payload || payload.match_id !== matchId) {
          return;
        }

        setDrawOfferSent(false);

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

      const lastMoveAt = parseTimestamp(payload.last_move_at);

      if (lastMoveAt === null) {
        console.error(
          "Received an invalid move timestamp:",
          payload.last_move_at,
        );
        return;
      }

      try {
        new Chess(payload.fen_after);

        const newMove: GameMove = {
          move_number: payload.move_number,
          player_id: payload.player_id,
          from: payload.from,
          to: payload.to,
          promotion: payload.promotion,
          uci: payload.uci,
          san: payload.san,
          fen_after: payload.fen_after,
          white_time_ms: payload.white_time_ms,
          black_time_ms: payload.black_time_ms,
          created_at: payload.last_move_at,
        };

        setLivePosition(payload.fen_after);

        setLiveMoves((currentMoves) => {
          const filtered = currentMoves.filter(
            (move) => move.move_number !== payload.move_number,
          );

          return [...filtered, newMove].sort(
            (a, b) => a.move_number - b.move_number,
          );
        });

        setClockSnapshot({
          whiteTimeMs: payload.white_time_ms,
          blackTimeMs: payload.black_time_ms,
          lastMoveAt,
        });
      } catch (error) {
        console.error(
          "Unable to apply the chess position received over WebSocket:",
          error,
        );
      }
    }

    return websocketManager.subscribe(handleMessage);
  }, [matchId, queryClient]);

  useEffect(() => {
    if (!match || match.result === "pending") {
      return;
    }

    setGameFinished(true);
  }, [match]);

  if (isMatchLoading || isMovesLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-sm text-zinc-500">Loading game...</p>
      </div>
    );
  }

  if (isMatchError || !match || !user) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <p className="text-sm font-semibold text-white">
            Unable to load game
          </p>

          <p className="mt-1 text-xs text-zinc-500">
            Game information could not be loaded.
          </p>
        </div>
      </div>
    );
  }

  const currentMatch = match;

  const isWhitePlayer = currentMatch.white_player_id === user.id;
  const isBlackPlayer = currentMatch.black_player_id === user.id;

  const playerColor: "w" | "b" = isWhitePlayer ? "w" : "b";

  const isMyTurn =
    !gameFinished &&
    currentMatch.result === "pending" &&
    game.turn() === playerColor;

  const whiteClockActive =
    !gameFinished && currentMatch.result === "pending" && game.turn() === "w";

  const blackClockActive =
    !gameFinished && currentMatch.result === "pending" && game.turn() === "b";

  function handlePieceDrop({
    sourceSquare,
    targetSquare,
    piece,
  }: PieceDropHandlerArgs): boolean {
    if (!isMyTurn) {
      return false;
    }

    if (!targetSquare) {
      return false;
    }

    const from = sourceSquare as Square;
    const to = targetSquare as Square;

    const promotion =
      piece.endsWith("P") && to[1] === "8"
        ? "q"
        : piece.endsWith("P") && to[1] === "1"
          ? "q"
          : undefined;

    const localGame = new Chess(game.fen());

    try {
      const move = localGame.move({
        from,
        to,
        promotion,
      });

      if (!move) {
        return false;
      }

      websocketManager.send(
        JSON.stringify({
          type: "game_move",
          payload: {
            match_id: matchId,
            from,
            to,
            promotion,
            uci: `${from}${to}${promotion ?? ""}`,
          },
        }),
      );

      return true;
    } catch {
      return false;
    }
  }

  function handleResign() {
    if (gameFinished || currentMatch.result !== "pending") {
      return;
    }

    websocketManager.send(
      JSON.stringify({
        type: "game_resign",
        payload: {
          match_id: matchId,
        },
      }),
    );
  }

  function handleDrawOffer() {
    if (gameFinished || currentMatch.result !== "pending" || drawOfferSent) {
      return;
    }

    websocketManager.send(
      JSON.stringify({
        type: "game_draw_offer",
        payload: {
          match_id: matchId,
        },
      }),
    );

    setDrawOfferSent(true);
  }

  function handleDrawAccept() {
    if (!drawOfferReceived) {
      return;
    }

    websocketManager.send(
      JSON.stringify({
        type: "game_draw_accept",
        payload: {
          match_id: matchId,
        },
      }),
    );

    setDrawOfferReceived(false);
  }

  function handleDrawDecline() {
    if (!drawOfferReceived) {
      return;
    }

    websocketManager.send(
      JSON.stringify({
        type: "game_draw_decline",
        payload: {
          match_id: matchId,
        },
      }),
    );

    setDrawOfferReceived(false);
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex items-center justify-between rounded-lg bg-zinc-900 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-white">
              {currentMatch.black_username}
            </p>

            <p className="text-xs text-zinc-500">Black</p>
          </div>

          <GameClock
            timeMs={effectiveClock.blackTimeMs}
            lastMoveAt={effectiveClock.lastMoveAt}
            active={blackClockActive}
          />
        </div>

        <div className="mx-auto w-full max-w-[720px]">
          <Chessboard
            position={position}
            onPieceDrop={handlePieceDrop}
            boardOrientation={playerColor === "w" ? "white" : "black"}
            arePiecesDraggable={isMyTurn}
            animationDuration={150}
          />
        </div>

        <div className="flex items-center justify-between rounded-lg bg-zinc-900 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-white">
              {currentMatch.white_username}
            </p>

            <p className="text-xs text-zinc-500">White</p>
          </div>

          <GameClock
            timeMs={effectiveClock.whiteTimeMs}
            lastMoveAt={effectiveClock.lastMoveAt}
            active={whiteClockActive}
          />
        </div>
      </div>

      <aside className="w-full shrink-0 lg:w-80">
        <div className="flex flex-col gap-4 rounded-lg bg-zinc-900 p-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Moves</h2>

            <div className="mt-3 max-h-96 overflow-y-auto">
              {moves.length === 0 ? (
                <p className="text-xs text-zinc-500">No moves yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {moves.map((move, index) => (
                    <div
                      key={move.move_number}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className="w-6 text-right text-xs text-zinc-600">
                        {index + 1}.
                      </span>

                      <span className="text-zinc-300">{move.san}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {!gameFinished && currentMatch.result === "pending" && (
            <div className="flex flex-col gap-2">
              {drawOfferReceived ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleDrawAccept}
                    className="flex-1 rounded-md bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900"
                  >
                    Accept draw
                  </button>

                  <button
                    type="button"
                    onClick={handleDrawDecline}
                    className="flex-1 rounded-md bg-zinc-800 px-3 py-2 text-sm font-medium text-white"
                  >
                    Decline
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleDrawOffer}
                  disabled={drawOfferSent}
                  className="rounded-md bg-zinc-800 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {drawOfferSent ? "Draw offered" : "Offer draw"}
                </button>
              )}

              <button
                type="button"
                onClick={handleResign}
                className="rounded-md bg-zinc-800 px-3 py-2 text-sm font-medium text-red-400"
              >
                Resign
              </button>
            </div>
          )}

          {gameFinished && finishResult && (
            <GameResult
              result={finishResult.result}
              winnerId={finishResult.winner_id}
              loserId={finishResult.loser_id}
              reason={finishResult.reason}
              whiteRatingBefore={finishResult.white_rating_before}
              whiteRatingAfter={finishResult.white_rating_after}
              blackRatingBefore={finishResult.black_rating_before}
              blackRatingAfter={finishResult.black_rating_after}
              userId={user.user_id}
            />
          )}
        </div>
      </aside>
    </div>
  );
}
