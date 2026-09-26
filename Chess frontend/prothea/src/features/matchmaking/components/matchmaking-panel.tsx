"use client";

import { useEffect, useState } from "react";

import {
  startMatchmaking,
  stopMatchmaking,
} from "@/features/matchmaking/store/actions";

import { useMatchmakingStore } from "@/features/matchmaking/store/matchmaking-store";
import { useMatchmakingWebSocket } from "../hooks/use-matchmaking-websocket";
import { useRouter } from "next/navigation";

const timeControls = {
  Bullet: ["1+0", "1+1", "2+1"],
  Blitz: ["3+0", "3+2", "5+0", "5+3"],
  Rapid: ["10+0", "10+5", "15+10", "30+0", "30+20"],
};

interface MatchmakingPanelProps {
  embedded?: boolean;
}

export default function MatchmakingPanel({
  embedded = false,
}: MatchmakingPanelProps) {
  const router = useRouter();

  useMatchmakingWebSocket();

  const status = useMatchmakingStore((state) => state.status);
  const timeControl = useMatchmakingStore((state) => state.timeControl);
  const error = useMatchmakingStore((state) => state.error);
  const match = useMatchmakingStore((state) => state.match);
  const reset = useMatchmakingStore((state) => state.reset);

  const [selectedTimeControl, setSelectedTimeControl] = useState("10+0");

  const isSearching = status === "searching";
  const isMatched = status === "matched";

  // Matchmaking state is global. Clear a completed match before showing a new queue.
  useEffect(() => {
    reset();
  }, [reset]);

  useEffect(() => {
    if (!isMatched || !match) {
      return;
    }

    router.replace(`/dashboard/chess/${match.id}`);
  }, [isMatched, match, router]);

  async function handleFindGame() {
    await startMatchmaking(selectedTimeControl);
  }

  async function handleCancel() {
    await stopMatchmaking();
  }

  return (
    <main
      className={
        embedded
          ? "bg-zinc-900 p-5 text-white"
          : "min-h-screen bg-zinc-950 px-6 py-12 text-white"
      }
    >
      <div className="mx-auto w-full max-w-2xl">
        <div className={embedded ? "mb-5" : "mb-8"}>
          <h1 className={embedded ? "text-lg font-bold" : "text-3xl font-bold"}>
            Find a game
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Choose a time control and find an opponent.
          </p>
        </div>

        {/* Time Controls */}
        {!isMatched && (
          <div className="space-y-6">
            {Object.entries(timeControls).map(([category, controls]) => (
              <section key={category}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
                  {category}
                </h2>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {controls.map((control) => {
                    const selected = selectedTimeControl === control;

                    return (
                      <button
                        key={control}
                        type="button"
                        disabled={isSearching}
                        onClick={() => setSelectedTimeControl(control)}
                        className={[
                          "rounded-lg border px-4 py-4 text-left transition",
                          selected
                            ? "border-white bg-white text-black"
                            : "border-zinc-800 bg-zinc-900 text-white hover:border-zinc-600",
                          isSearching && "cursor-not-allowed opacity-50",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <div className="text-lg font-semibold">{control}</div>

                        <div
                          className={[
                            "mt-1 text-xs",
                            selected ? "text-zinc-600" : "text-zinc-500",
                          ].join(" ")}
                        >
                          {control.split("+")[0]} min
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Searching */}
        {isSearching && (
          <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex items-center gap-4">
              <div className="h-3 w-3 animate-pulse rounded-full bg-green-500" />

              <div>
                <p className="font-semibold">Searching for an opponent...</p>

                <p className="mt-1 text-sm text-zinc-500">
                  Time control: {timeControl}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleCancel()}
              className="mt-5 w-full rounded-lg border border-zinc-700 px-4 py-3 text-sm font-semibold transition hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Find Game */}
        {!isSearching && !isMatched && !match && (
          <button
            type="button"
            onClick={() => void handleFindGame()}
            className="mt-8 w-full rounded-lg bg-white px-4 py-4 text-sm font-bold text-black transition hover:bg-zinc-200"
          >
            Find Game
          </button>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Match Found */}
        {isMatched && match && (
          <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="mb-6 text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-green-500">
                Match Found
              </p>

              <p className="mt-2 text-sm text-zinc-500">{match.time_control}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-zinc-950 p-4">
                <p className="text-sm font-semibold">{match.white_username}</p>

                <p className="mt-1 text-xs text-zinc-500">
                  Rating {match.white_rating}
                </p>
              </div>

              <div className="rounded-lg bg-zinc-950 p-4 text-right">
                <p className="text-sm font-semibold">{match.black_username}</p>

                <p className="mt-1 text-xs text-zinc-500">
                  Rating {match.black_rating}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-center">
              <p className="text-xs text-zinc-500">Match ID</p>

              <p className="mt-1 break-all font-mono text-xs text-zinc-300">
                {match.id}
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
