"use client";

import { useEffect, useState } from "react";
import { BoltIcon, ClockIcon, FireIcon, MagnifyingGlassIcon, UserGroupIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";

import { startMatchmaking, stopMatchmaking } from "@/features/matchmaking/store/actions";
import { useMatchmakingStore } from "@/features/matchmaking/store/matchmaking-store";
import { useMatchmakingWebSocket } from "../hooks/use-matchmaking-websocket";

const timeControlGroups = [
  { name: "Bullet", caption: "Fast reflexes", Icon: BoltIcon, controls: ["1+0", "1+1", "2+1"] },
  { name: "Blitz", caption: "Quick strategy", Icon: FireIcon, controls: ["3+0", "3+2", "5+0"] },
  { name: "Rapid", caption: "Take your time", Icon: ClockIcon, controls: ["10+0", "10+5", "15+10", "30+0", "30+20"] },
];

interface MatchmakingPanelProps {
  embedded?: boolean;
}

export default function MatchmakingPanel({ embedded = false }: MatchmakingPanelProps) {
  const router = useRouter();
  useMatchmakingWebSocket();

  const status = useMatchmakingStore((state) => state.status);
  const timeControl = useMatchmakingStore((state) => state.timeControl);
  const error = useMatchmakingStore((state) => state.error);
  const match = useMatchmakingStore((state) => state.match);
  const [selectedTimeControl, setSelectedTimeControl] = useState(() => timeControl ?? timeControlGroups[0].controls[0]);

  const isSearching = status === "searching";
  const isMatched = status === "matched";

  useEffect(() => {
    if (isMatched && match) router.replace(`/dashboard/chess/${match.id}`);
  }, [isMatched, match, router]);

  async function handleFindGame() {
    await startMatchmaking(selectedTimeControl);
  }

  async function handleCancel() {
    await stopMatchmaking();
  }

  return (
    <main className={embedded ? "h-full overflow-y-auto bg-zinc-900 p-4 text-white" : "min-h-screen bg-zinc-950 px-6 py-12 text-white"}>
      <div className={embedded ? "w-full" : "mx-auto w-full max-w-3xl"}>
        <header className={embedded ? "mb-5" : "mb-8"}>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sky-400/10 text-sky-300 ring-1 ring-sky-300/20">
              <UserGroupIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className={embedded ? "text-lg font-bold" : "text-3xl font-bold tracking-tight"}>Find a game</h1>
              <p className="mt-1 text-sm text-zinc-400">Choose your pace and get paired with an opponent.</p>
            </div>
          </div>
        </header>

        {!isMatched && (
          <div className={embedded ? "space-y-3" : "space-y-4"}>
            {timeControlGroups.map(({ name, caption, Icon, controls }) => (
              <section key={name} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 shadow-sm shadow-black/10">
                <div className="mb-3 flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-zinc-800 text-zinc-300">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold">{name}</h2>
                    <p className="text-xs text-zinc-500">{caption}</p>
                  </div>
                </div>
                <div className={embedded ? "grid grid-cols-3 gap-2" : "grid grid-cols-2 gap-2 sm:grid-cols-3"}>
                  {controls.map((control) => {
                    const selected = selectedTimeControl === control;
                    return (
                      <button
                        key={control}
                        type="button"
                        disabled={isSearching}
                        aria-pressed={selected}
                        onClick={() => setSelectedTimeControl(control)}
                        className={`group rounded-xl border px-3 py-3 text-left transition duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${selected ? "border-sky-300/70 bg-sky-300/10 ring-1 ring-sky-300/20" : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-600 hover:bg-zinc-800/70"}`}
                      >
                        <span className={`block font-mono text-base font-bold ${selected ? "text-sky-200" : "text-zinc-100"}`}>{control}</span>
                        <span className="mt-1 block text-[11px] text-zinc-500">{control.split("+")[0]} min</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {isSearching && (
          <section aria-live="polite" className="mt-5 rounded-2xl border border-sky-300/20 bg-sky-300/6 p-5">
            <div className="flex items-center gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sky-300/10 text-sky-200">
                <MagnifyingGlassIcon className="h-5 w-5 animate-pulse" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Finding your opponent</p>
                <p className="mt-1 text-sm text-zinc-400">Searching for a {timeControl} game</p>
              </div>
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
            </div>
            <button type="button" onClick={() => void handleCancel()} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800">
              <XMarkIcon className="h-4 w-4" aria-hidden="true" /> Cancel search
            </button>
          </section>
        )}

        {!isSearching && !isMatched && !match && (
          <button type="button" onClick={() => void handleFindGame()} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-300 px-4 py-3.5 text-sm font-bold text-zinc-950 shadow-lg shadow-sky-950/20 transition hover:bg-sky-200">
            <MagnifyingGlassIcon className="h-5 w-5" aria-hidden="true" /> Find opponent
          </button>
        )}

        {error && <div role="alert" className="mt-4 rounded-xl border border-red-900/70 bg-red-950/40 px-4 py-3 text-sm text-red-300">{error}</div>}

        {isMatched && match && (
          <section className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/6 p-5">
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300"><UserGroupIcon className="h-5 w-5" aria-hidden="true" /></div>
              <div><p className="font-semibold text-emerald-200">Match found</p><p className="mt-1 text-xs text-zinc-400">{match.time_control}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[{ name: match.white_username, rating: match.white_rating, color: "White" }, { name: match.black_username, rating: match.black_rating, color: "Black" }].map((player) => (
                <div key={player.color} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                  <p className="text-xs text-zinc-500">{player.color}</p><p className="mt-1 truncate text-sm font-semibold">{player.name}</p><p className="mt-1 text-xs text-zinc-500">Rating {player.rating}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
