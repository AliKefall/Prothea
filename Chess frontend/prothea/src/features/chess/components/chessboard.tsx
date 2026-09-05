"use client";

import { useEffect, useMemo, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard, type PieceDropHandlerArgs } from "react-chessboard";

import { useAuthStore } from "@/features/auth/auth-store";
import { websocketManager } from "@/lib/websocket";

import { useMatch } from "../hooks/use-match";
import { useMatchMoves } from "../hooks/use-match-moves";

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

interface WebSocketGameMoveMessage {
  type: string;
  payload: GameMovePayload;
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

  const {
    data: match,
    isLoading: isMatchLoading,
    isError: isMatchError,
  } = useMatch(matchId);

  const { data: movesData, isLoading: isMovesLoading } = useMatchMoves(matchId);

  /*
   * movesData undefined olduğunda her render'da yeni []
   * oluşturmamak için useMemo kullanıyoruz.
   */
  const moves = useMemo(() => {
    return movesData ?? [];
  }, [movesData]);

  /*
   * HTTP üzerinden gelen son FEN.
   *
   * Henüz hamle yoksa başlangıç pozisyonu kullanılır.
   */
  const latestPosition = useMemo(() => {
    if (moves.length === 0) {
      return STARTING_FEN;
    }

    return moves[moves.length - 1].fen_after;
  }, [moves]);

  /*
   * WebSocket üzerinden gelen en son authoritative position.
   */
  const [livePosition, setLivePosition] = useState<string | null>(null);

  /*
   * WebSocket üzerinden gelen en son authoritative clock.
   */
  const [clockSnapshot, setClockSnapshot] = useState<ClockSnapshot | null>(
    null,
  );

  /*
   * Frontend clock'un "şu anı".
   */
  const [clockNow, setClockNow] = useState(() => Date.now());

  /*
   * Live position varsa onu kullan.
   * Yoksa REST API'den gelen son pozisyonu kullan.
   */
  const position = livePosition ?? latestPosition;

  /*
   * Chess instance state olarak tutulmuyor.
   * Position değiştikçe yeniden oluşturuluyor.
   */
  const game = useMemo(() => {
    return new Chess(position);
  }, [position]);

  /*
   * Maçın başlangıç süresi.
   *
   * Örneğin:
   * 10+0 -> 600000 ms
   * 5+3  -> 300000 ms
   */
  const initialTimeMs = useMemo(() => {
    return parseInitialTimeMs(match?.time_control);
  }, [match?.time_control]);

  /*
   * Sayfa yeniden açıldığında REST API'den alınan
   * mevcut clock snapshot'ını oluştur.
   *
   * Henüz hamle yoksa saat çalışmaz.
   *
   * Hamle varsa son hamlenin oluşturulma zamanı,
   * backend snapshot'ının zamanına yaklaşık referans olur.
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
   * Clock sadece oyun devam ederken çalışıyor.
   *
   * 250 ms'de bir UI güncelleniyor.
   * Gerçek saat backend'de authoritative.
   */
  useEffect(() => {
    if (match?.result !== "pending" || effectiveClock.lastMoveAt === null) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setClockNow(Date.now());
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [match?.result, effectiveClock.lastMoveAt]);

  /*
   * Backend'den game_move eventlerini dinle.
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

      const wsMessage = message as WebSocketGameMoveMessage;

      if (wsMessage.type !== "game_move") {
        return;
      }

      const payload = wsMessage.payload;

      if (!payload || payload.match_id !== matchId) {
        return;
      }

      const lastMoveAt = Date.parse(payload.last_move_at);

      if (!Number.isFinite(lastMoveAt)) {
        console.error(
          "Invalid last_move_at received from server:",
          payload.last_move_at,
        );

        return;
      }

      try {
        /*
         * Backend'in gönderdiği FEN geçerli mi?
         */
        new Chess(payload.fen_after);

        /*
         * Backend authoritative position.
         */
        setLivePosition(payload.fen_after);

        /*
         * Backend authoritative clock.
         */
        setClockSnapshot({
          whiteTimeMs: payload.white_time_ms,
          blackTimeMs: payload.black_time_ms,
          lastMoveAt,
        });

        /*
         * Event geldiği anda clockNow'u güncelle.
         */
        setClockNow(Date.now());
      } catch (error) {
        console.error("Failed to apply websocket chess move:", error);
      }
    }

    const unsubscribe = websocketManager.subscribe(handleMessage);

    return unsubscribe;
  }, [matchId]);

  /*
   * Oyuncuların ekranda göreceği gerçek saatler.
   *
   * İlk hamleden önce elapsedMs = 0.
   *
   * Hamle yapıldıktan sonra sadece sıradaki oyuncunun
   * zamanı azalır.
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
     * Oyun bitmişse hamle gönderme.
     */
    if (match?.result !== "pending") {
      return false;
    }

    /*
     * Source square üzerinde gerçekten taş var mı?
     */
    const piece = game.get(sourceSquare as Square);

    if (!piece) {
      return false;
    }

    /*
     * Oyuncu sadece kendi taşını oynayabilir.
     */
    if (piece.color !== myColor) {
      return false;
    }

    /*
     * Oyuncunun sırası değilse frontend'de engelle.
     *
     * Backend bunu ayrıca kontrol ediyor.
     */
    if (game.turn() !== myColor) {
      return false;
    }

    try {
      /*
       * Gerçek game instance'ını değiştirmiyoruz.
       *
       * Sadece hamlenin legal olup olmadığını
       * kontrol etmek için kopya kullanıyoruz.
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
       * Hamleyi backend'e gönder.
       *
       * Board henüz local olarak değiştirilmez.
       *
       * Backend kabul ederse game_move eventini
       * bize gönderir ve FEN authoritative olarak
       * uygulanır.
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
                <span className="font-mono text-xl font-bold">
                  {formatClock(isWhite ? blackDisplayTime : whiteDisplayTime)}
                </span>
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
                <span className="font-mono text-xl font-bold">
                  {formatClock(isWhite ? whiteDisplayTime : blackDisplayTime)}
                </span>
              </div>
            </div>

            <p className="mt-3 max-w-130 truncate font-mono text-[10px] text-zinc-700">
              {match.id}
            </p>
          </section>

          {/* Side panel */}
          <aside className="flex h-130 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
            {/* Header */}
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

            {/* Moves */}
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
                  {/* Header */}
                  <div className="grid grid-cols-[36px_1fr_1fr] bg-zinc-950 text-xs text-zinc-500">
                    <div className="px-3 py-2">#</div>

                    <div className="px-3 py-2">White</div>

                    <div className="px-3 py-2">Black</div>
                  </div>

                  {/* Moves */}
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

            {/* Controls */}
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
