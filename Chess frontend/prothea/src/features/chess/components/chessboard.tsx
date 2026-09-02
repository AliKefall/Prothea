"use client";

import { useState } from "react";
import { Chess } from "chess.js";
import { Chessboard, PieceDropHandlerArgs } from "react-chessboard";

import { useAuthStore } from "@/features/auth/auth-store";
import { useMatch } from "../hooks/use-match";
import { useMatchMoves } from "../hooks/use-match-moves";
import { websocketManager } from "@/lib/websocket";

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";

interface ChessBoardProps {
  matchId: string;
}

export function ChessBoard({ matchId }: ChessBoardProps) {
  const user = useAuthStore((state) => state.user);

  const {
    data: match,
    isLoading: isMatchLoading,
    isError: isMatchError,
  } = useMatch(matchId);

  const { data: moves = [], isLoading: isMovesLoading } =
    useMatchMoves(matchId);

  const [position, setPosition] = useState(STARTING_FEN);
  const [game] = useState(() => new Chess());

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

    try {
      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });

      if (!move) {
        return false;
      }

      setPosition(game.fen());

      const uci = `${sourceSquare}${targetSquare}${move.promotion ?? ""}`;

      websocketManager.send("game_move", {
        match_id: matchId,
        from: sourceSquare,
        to: targetSquare,
        promotion: move.promotion,
        uci,
      });

      return true;
    } catch (error) {
      console.error("Failed to make chess move:", error);

      return false;
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-zinc-950 p-6 text-white">
      <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-center">
        <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Chess section */}
          <section className="flex min-w-0 flex-col items-center">
            {/* Opponent */}
            <div className="mb-3 flex w-full max-w-130 items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800 text-sm font-bold">
                  {opponentUsername.charAt(0).toUpperCase()}
                </div>

                <div>
                  <p className="text-sm font-semibold">{opponentUsername}</p>

                  <p className="text-xs text-zinc-500">{opponentRating}</p>
                </div>
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2">
                <span className="font-mono text-xl font-bold">10:00</span>
              </div>
            </div>

            {/* Board */}
            <div className="w-full max-w-130 overflow-hidden rounded-lg shadow-2xl">
              <Chessboard
                options={{
                  position,
                  boardOrientation: isWhite ? "white" : "black",
                  allowDragging: true,
                  onPieceDrop: handlePieceDrop,
                }}
              />
            </div>

            {/* Player */}
            <div className="mt-3 flex w-full max-w-130 items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-sm font-bold text-black">
                  {myUsername.charAt(0).toUpperCase()}
                </div>

                <div>
                  <p className="text-sm font-semibold">{myUsername}</p>

                  <p className="text-xs text-zinc-500">{myRating}</p>
                </div>
              </div>

              <div className="rounded-lg bg-white px-4 py-2 text-black">
                <span className="font-mono text-xl font-bold">10:00</span>
              </div>
            </div>

            <p className="mt-3 max-w-130 truncate font-mono text-[10px] text-zinc-700">
              {match.id}
            </p>
          </section>

          {/* Side panel */}
          <aside className="flex h-130 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
            <div className="border-b border-zinc-800 px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">Game</h2>

                  <p className="mt-1 text-xs text-zinc-500">
                    Rated · {match.time_control}
                  </p>
                </div>

                <span className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-400">
                  {match.result === "pending" ? "Ongoing" : match.result}
                </span>
              </div>
            </div>

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
                  <div className="grid grid-cols-[36px_1fr_1fr] bg-zinc-950 text-xs text-zinc-500">
                    <div className="px-3 py-2">#</div>

                    <div className="px-3 py-2">White</div>

                    <div className="px-3 py-2">Black</div>
                  </div>

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
                  className="rounded-lg bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-500/20"
                >
                  Resign
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
