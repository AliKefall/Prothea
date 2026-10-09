"use client";

// FIX #3: removed unused `useRef` import
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard, type PieceDropHandlerArgs } from "react-chessboard";
import { useQueryClient } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/auth-store";
import { websocketManager } from "@/lib/websocket";

import { useMatch } from "../hooks/use-match";
import { useMatchMoves } from "../hooks/use-match-moves";
import { GameResult } from "./game-result";
import { ChessWorkspace } from "./chess-workspace";
import { ChessSidebar } from "./chess-sidebar";
import type { ChessSidebarTab } from "./chess-sidebar-tabs";
import { MoveHistory } from "./move-history";
import { PromotionPicker } from "./promotion-picker";
import MatchmakingPanel from "@/features/matchmaking/components/matchmaking-panel";
import { useMatchmakingStore } from "@/features/matchmaking/store/matchmaking-store";
import { INITIAL_FEN } from "@/features/analysis/lib/position";

// NOTE: Tidy up this place.
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

interface ClockSnapshot {
  whiteTimeMs: number;
  blackTimeMs: number;
  lastMoveAt: number | null;
}

interface GamePresencePayload {
  match_id: string;
  player_id: string;
  deadline?: string;
}

interface WebSocketGameDisconnectedMessage {
  type: "game_player_disconnected";
  payload: GamePresencePayload;
}

interface WebSocketGameReconnectedMessage {
  type: "game_player_reconnected";
  payload: GamePresencePayload;
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

const StableGameChessboard = memo(function StableGameChessboard({
  position,
  boardOrientation,
  allowDragging,
  onPieceDrop,
}: {
  position: string;
  boardOrientation: "white" | "black";
  allowDragging: boolean;
  onPieceDrop: (args: PieceDropHandlerArgs) => boolean;
}) {
  const checkedKingSquare = useMemo(() => {
    const currentPosition = new Chess(position);
    if (!currentPosition.isCheck()) return undefined;
    return currentPosition
      .board()
      .flat()
      .find(
        (piece) =>
          piece?.type === "k" && piece.color === currentPosition.turn(),
      )?.square;
  }, [position]);
  const squareStyles = useMemo(
    () =>
      checkedKingSquare
        ? {
            [checkedKingSquare]: {
              background: "rgba(239, 68, 68, 0.62)",
              boxShadow: "inset 0 0 0 4px rgba(127, 29, 29, 0.9)",
            },
          }
        : {},
    [checkedKingSquare],
  );

  return (
    <Chessboard
      options={{
        position,
        boardOrientation,
        allowDragging,
        onPieceDrop,
        squareStyles,
      }}
    />
  );
});

export function ChessBoard({ matchId }: ChessBoardProps) {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const resetMatchmaking = useMatchmakingStore((state) => state.reset);

  const [disconnectDeadline, setDisconnectDeadline] = useState<number | null>(
    null,
  );

  const [disconnectedPlayerId, setDisconnectedPlayerId] = useState<
    string | null
  >(null);

  const [presenceNow, setPresenceNow] = useState(() => Date.now());

  const {
    data: match,
    isLoading: isMatchLoading,
    isError: isMatchError,
  } = useMatch(matchId);

  const { data: movesData, isLoading: isMovesLoading } = useMatchMoves(matchId);

  const [liveMoves, setLiveMoves] = useState<GameMove[]>([]);
  // FIX #4: `livePosition` and `clockSnapshot` states removed. Both duplicated data
  // already derived from `moves`, and could go stale after a refetch.
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [gameFinished, setGameFinished] = useState(false);
  const [finishResult, setFinishResult] = useState<GameFinishedPayload | null>(
    null,
  );
  const [drawOfferSent, setDrawOfferSent] = useState(false);
  const [drawOfferReceived, setDrawOfferReceived] = useState(false);
  // FIX #2: typed state so it matches ChessSidebar's `ChessSidebarTab` prop
  const [activeTab, setActiveTab] = useState<ChessSidebarTab>("moves");
  const [promotionRequest, setPromotionRequest] = useState<{
    from: string;
    to: string;
    color: "w" | "b";
  } | null>(null);
  const [selectedMoveNumber, setSelectedMoveNumber] = useState<number | null>(
    null,
  );

  const moves = useMemo<GameMove[]>(() => {
    const merged = new Map<number, GameMove>();

    for (const move of movesData ?? []) {
      const uci = move.uci;

      if (!uci || uci.length < 4) {
        console.error("Received invalid persisted chess move:", move);
        continue;
      }

      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promotion = uci.length > 4 ? uci.slice(4) : undefined;

      merged.set(move.move_number, {
        move_number: move.move_number,
        player_id: move.player_id,
        from,
        to,
        promotion,
        uci,
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

  const livePosition = useMemo(() => {
    if (moves.length === 0) {
      return INITIAL_FEN;
    }

    return moves[moves.length - 1].fen_after;
  }, [moves]);

  const selectedMove = useMemo(
    () => moves.find((move) => move.move_number === selectedMoveNumber),
    [moves, selectedMoveNumber],
  );

  const isReviewingMove = selectedMove !== undefined;

  const position = selectedMove?.fen_after ?? livePosition;

  const game = useMemo(() => {
    return new Chess(livePosition);
  }, [livePosition]);

  const initialTimeMs = useMemo(() => {
    return parseInitialTimeMs(match?.time_control);
  }, [match?.time_control]);

  const baseClock = useMemo<ClockSnapshot>(() => {
    const lastMove = moves[moves.length - 1];

    if (!lastMove) {
      const matchCreatedAt = Date.parse(match?.created_at ?? "");

      return {
        whiteTimeMs: initialTimeMs,
        blackTimeMs: initialTimeMs,
        lastMoveAt: Number.isFinite(matchCreatedAt) ? matchCreatedAt : null,
      };
    }

    const lastMoveAt = Date.parse(lastMove.created_at);

    return {
      whiteTimeMs: lastMove.white_time_ms,
      blackTimeMs: lastMove.black_time_ms,
      lastMoveAt: Number.isFinite(lastMoveAt) ? lastMoveAt : null,
    };
  }, [moves, initialTimeMs, match?.created_at]);

  const clockAnchor = baseClock.lastMoveAt;

  useEffect(() => {
    if (match?.result !== "pending" || gameFinished || clockAnchor === null) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setClockNow(Date.now());
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [match?.result, gameFinished, clockAnchor]);

  useEffect(() => {
    if (disconnectDeadline === null) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setPresenceNow(Date.now());
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [disconnectDeadline]);

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
        setDisconnectedPlayerId(null);
        setDisconnectDeadline(null);
        setPresenceNow(Date.now());
        setDrawOfferSent(false);
        setDrawOfferReceived(false);
        setClockNow(Date.now());
        setActiveTab("moves");
        resetMatchmaking();
        void queryClient.invalidateQueries({
          queryKey: ["match", matchId, "moves"],
        });

        queryClient.setQueryData(
          ["match", matchId],
          // FIX #5: renamed param (it shadowed the later `currentMatch` const)
          (previousMatch: typeof match) => {
            if (!previousMatch) {
              return previousMatch;
            }

            return {
              ...previousMatch,
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

      if (message.type === "game_player_disconnected") {
        const wsMessage = message as WebSocketGameDisconnectedMessage;

        const payload = wsMessage.payload;

        if (!payload || payload.match_id !== matchId) {
          return;
        }

        const deadline = Date.parse(payload.deadline ?? "");

        if (!Number.isFinite(deadline)) {
          console.error("received invalid disconnect deadline: ", payload);

          return;
        }

        setDisconnectedPlayerId(payload.player_id);
        setDisconnectDeadline(deadline);
        setPresenceNow(Date.now());

        return;
      }

      if (message.type === "game_player_reconnected") {
        const wsMessage = message as WebSocketGameReconnectedMessage;

        const payload = wsMessage.payload;

        if (!payload || payload.match_id !== matchId) {
          return;
        }

        setDisconnectedPlayerId((currentPlayerID) =>
          currentPlayerID === payload.player_id ? null : currentPlayerID,
        );

        setDisconnectDeadline(null);
        setPresenceNow(Date.now());

        return;
      }

      if (message.type === "game_presence_sync") {
        const payload = message.payload as {
          match_id?: string;
          disconnected_player_id?: string;
          deadline?: string;
        };

        if (!payload || payload.match_id !== matchId) {
          return;
        }

        if (!payload.disconnected_player_id || !payload.deadline) {
          setDisconnectedPlayerId(null);
          setDisconnectDeadline(null);
          setPresenceNow(Date.now());

          return;
        }

        const deadline = Date.parse(payload.deadline);

        if (!Number.isFinite(deadline)) {
          console.error("Received invalid presence sync deadline:", payload);

          return;
        }

        setDisconnectedPlayerId(payload.disconnected_player_id);

        setDisconnectDeadline(deadline);

        setPresenceNow(Date.now());

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

      if (!Number.isFinite(Date.parse(payload.last_move_at))) {
        console.error(
          "Received an invalid move timestamp:",
          payload.last_move_at,
          payload,
        );

        return;
      }

      try {
        new Chess(payload.fen_after);

        setLiveMoves((currentMoves) => {
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

          const existingIndex = currentMoves.findIndex(
            (move) => move.move_number === payload.move_number,
          );

          if (existingIndex !== -1) {
            const updated = [...currentMoves];
            updated[existingIndex] = newMove;
            return updated;
          }

          return [...currentMoves, newMove];
        });

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
  }, [matchId, queryClient, resetMatchmaking]);

  useEffect(() => {
    const refreshGameState = () => {
      void queryClient.invalidateQueries({
        queryKey: ["match", matchId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["match", matchId, "moves"],
      });
    };

    const unsubscribe = websocketManager.subscribeConnection(refreshGameState);

    if (websocketManager.isConnected()) {
      refreshGameState();
    }

    return unsubscribe;
  }, [matchId, queryClient]);

  useEffect(() => {
    const syncPresence = () => {
      if (!websocketManager.isConnected()) {
        return;
      }

      try {
        websocketManager.send("game_presence_sync_request", {
          match_id: matchId,
        });
      } catch (error) {
        console.error("Failed to request game presence sync:", error);
      }
    };

    const unsubscribe = websocketManager.subscribeConnection(syncPresence);

    if (websocketManager.isConnected()) {
      syncPresence();
    }

    return unsubscribe;
  }, [matchId]);

  const elapsedMs =
    baseClock.lastMoveAt === null
      ? 0
      : Math.max(0, clockNow - baseClock.lastMoveAt);

  const isWhiteTurn = game.turn() === "w";

  const whiteDisplayTime = Math.max(
    0,
    baseClock.whiteTimeMs - (isWhiteTurn ? elapsedMs : 0),
  );

  const blackDisplayTime = Math.max(
    0,
    baseClock.blackTimeMs - (!isWhiteTurn ? elapsedMs : 0),
  );

  const isWhite = match && user ? match.white_id === user.user_id : true;
  const myColor = isWhite ? "w" : "b";
  const submitGameMove = useCallback(
    (
      sourceSquare: string,
      targetSquare: string,
      promotion?: "q" | "r" | "b" | "n",
    ): boolean => {
      try {
        const nextGame = new Chess(game.fen());
        const move = nextGame.move({
          from: sourceSquare,
          to: targetSquare,
          ...(promotion ? { promotion } : {}),
        });
        if (!move) return false;

        websocketManager.send("game_move", {
          match_id: matchId,
          from: sourceSquare,
          to: targetSquare,
          promotion: move.promotion ?? "",
          uci: `${move.from}${move.to}${move.promotion ?? ""}`,
        });
        return true;
      } catch (error) {
        console.error("Failed to create chess move:", error);
        return false;
      }
    },
    [game, matchId],
  );
  const handlePieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean => {
      if (!targetSquare || !match || !user) return false;
      if (gameFinished || match.result !== "pending" || isReviewingMove) return false;

      const piece = game.get(sourceSquare as Square);
      if (!piece || piece.color !== myColor || game.turn() !== myColor) return false;

      const promotionMove = game
        .moves({ verbose: true })
        .find((move) => move.from === sourceSquare && move.to === targetSquare && move.promotion);
      if (promotionMove) {
        setPromotionRequest({ from: sourceSquare, to: targetSquare, color: piece.color });
        return false;
      }

      return submitGameMove(sourceSquare, targetSquare);
    },
    [game, gameFinished, isReviewingMove, match, myColor, submitGameMove, user],
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

  const currentMatch = match;
  const currentUser = user;

  const myUsername = isWhite
    ? currentMatch.white_username
    : currentMatch.black_username;
  const myRating = isWhite
    ? currentMatch.white_rating
    : currentMatch.black_rating;
  const opponentUsername = isWhite
    ? currentMatch.black_username
    : currentMatch.white_username;
  const opponentRating = isWhite
    ? currentMatch.black_rating
    : currentMatch.white_rating;

  const disconnectRemainingMs =
    disconnectDeadline === null
      ? 0
      : Math.max(0, disconnectDeadline - presenceNow);

  const disconnectRemainingSeconds = Math.ceil(disconnectRemainingMs / 1000);

  const isOpponentDisconnected =
    disconnectedPlayerId !== null &&
    disconnectedPlayerId !== currentUser?.user_id;
  const isCurrentUserDisconnected =
    disconnectedPlayerId === currentUser?.user_id;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-zinc-950 p-6 text-white aspect-square">
      <div className="mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-6xl items-start justify-center pt-2">
        {/* FIX #1: ChessWorkspace expects `board` and `sidebar` props, not children */}
        <ChessWorkspace
          board={
            <div className="flex min-w-0 flex-col items-center self-start">
              <div className="mb-3 flex w-full max-w-130 items-center justify-between">
                {disconnectDeadline !== null && (
                  <div className="mb-3 w-full max-w-130 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-zinc-200">
                          {isOpponentDisconnected
                            ? `${opponentUsername} disconnected`
                            : isCurrentUserDisconnected
                              ? "You are disconnected"
                              : "Player disconnected"}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          Reconnect before the game is abondoned.
                        </p>
                        <span className="font-mono text-lg font-semibold text-white">
                          {disconnectRemainingSeconds}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
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

              <div className="relative aspect-square w-full max-w-130 shrink-0 overflow-hidden rounded-lg shadow-2xl">
                <StableGameChessboard
                  position={position}
                  boardOrientation={isWhite ? "white" : "black"}
                  allowDragging={
                    !promotionRequest &&
                    !gameFinished &&
                    currentMatch.result === "pending" &&
                    !isReviewingMove
                  }
                  onPieceDrop={handlePieceDrop}
                />
                {promotionRequest && (
                  <PromotionPicker
                    color={promotionRequest.color}
                    onCancelAction={() => setPromotionRequest(null)}
                    onSelectAction={(promotion) => {
                      if (
                        submitGameMove(
                          promotionRequest.from,
                          promotionRequest.to,
                          promotion,
                        )
                      ) {
                        setPromotionRequest(null);
                      }
                    }}
                  />
                )}
              </div>

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
                {currentMatch.id}
              </p>
            </div>
          }
          sidebar={
            <ChessSidebar
              activeTab={activeTab}
              showMatchmaking={
                gameFinished || currentMatch.result !== "pending"
              }
              statusLabel={
                gameFinished
                  ? "Finished"
                  : currentMatch.result === "pending"
                    ? "Ongoing"
                    : currentMatch.result
              }
              timeControl={currentMatch.time_control}
              onTabChange={setActiveTab}
              footer={
                <>
                  {drawOfferReceived && !gameFinished && (
                    <div className="border-t border-zinc-800 px-5 py-4">
                      <div className="mb-3">
                        <p className="text-sm font-semibold">Draw offer</p>

                        <p className="mt-1 text-xs text-zinc-500">
                          Your opponent has offered a draw.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            websocketManager.send("game_draw_accept", {
                              match_id: matchId,
                            });

                            setDrawOfferReceived(false);
                          }}
                          className="rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200"
                        >
                          Accept
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            websocketManager.send("game_draw_decline", {
                              match_id: matchId,
                            });

                            setDrawOfferReceived(false);
                          }}
                          className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  )}

                  {gameFinished &&
                    finishResult &&
                    activeTab !== "matchmaking" && (
                      <GameResult
                        matchId={matchId}
                        result={finishResult.result}
                        reason={finishResult.reason}
                        isWhite={isWhite}
                        whiteRatingBefore={finishResult.white_rating_before}
                        whiteRatingAfter={finishResult.white_rating_after}
                        blackRatingBefore={finishResult.black_rating_before}
                        blackRatingAfter={finishResult.black_rating_after}
                      />
                    )}

                  {!gameFinished && !drawOfferReceived && (
                    <div className="border-t border-zinc-800 p-4">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={
                            currentMatch.result !== "pending" || drawOfferSent
                          }
                          onClick={() => {
                            websocketManager.send("game_draw_offer", {
                              match_id: matchId,
                            });

                            setDrawOfferSent(true);
                          }}
                          className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {drawOfferSent ? "Draw offered" : "Draw"}
                        </button>

                        <button
                          type="button"
                          disabled={currentMatch.result !== "pending"}
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
                </>
              }
            >
              {activeTab === "moves" && (
                <MoveHistory
                  moves={moves}
                  isLoading={isMovesLoading}
                  selectedMoveNumber={
                    isReviewingMove ? selectedMoveNumber : null
                  }
                  onMoveSelect={setSelectedMoveNumber}
                />
              )}

              {activeTab === "chat" && (
                <div className="flex h-full items-center justify-center p-6">
                  <div className="text-center">
                    <p className="text-sm font-medium text-zinc-300">
                      Game chat
                    </p>

                    <p className="mt-1 text-xs text-zinc-600">
                      Chat will be added here.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === "replay" && (
                <div className="p-6">
                  <p className="text-sm font-medium text-zinc-300">Replay</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Select a move to inspect that position. The board remains
                    read-only while reviewing history.
                  </p>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      disabled={!isReviewingMove}
                      onClick={() => setSelectedMoveNumber(null)}
                      className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Return to live position
                    </button>
                  </div>
                  {selectedMove && (
                    <p className="mt-4 text-sm text-zinc-300">
                      Viewing move {Math.ceil(selectedMove.move_number / 2)}:{" "}
                      {selectedMove.san}
                    </p>
                  )}
                </div>
              )}

              {activeTab === "matchmaking" && <MatchmakingPanel embedded />}
            </ChessSidebar>
          }
        />
      </div>
    </div>
  );
}
