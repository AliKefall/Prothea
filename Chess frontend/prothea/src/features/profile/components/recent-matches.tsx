"use client";

import Link from "next/link";
import { useState } from "react";
import type { RatingType, RecentMatch, RecentMatchResult } from "../types/profile-types";

const gameTabs = [
  { id: "bullet", label: "Bullet" },
  { id: "blitz", label: "Blitz" },
  { id: "rapid", label: "Rapid" },
  { id: "all", label: "All games" },
] as const;

type GameTab = (typeof gameTabs)[number]["id"];

export function RecentMatches({ matches }: { matches: RecentMatch[] }) {
  const [activeTab, setActiveTab] = useState<GameTab>("all");
  const filteredMatches = activeTab === "all"
    ? matches
    : matches.filter((match) => match.rating_type === activeTab);

  return (
    <section aria-labelledby="recent-games-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="recent-games-heading" className="text-xl font-semibold text-white">Game history</h2>
          <p className="mt-1 text-sm text-zinc-500">Browse completed games by time control.</p>
        </div>
        <span className="text-xs text-zinc-500">{matches.length} {matches.length === 1 ? "game" : "games"}</span>
      </div>

      <div role="tablist" aria-label="Game history time controls" className="flex gap-1 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900 p-1">
        {gameTabs.map((tab) => {
          const count = tab.id === "all"
            ? matches.length
            : matches.filter((match) => match.rating_type === tab.id).length;
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`games-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls="games-tab-panel"
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => {
                const currentIndex = gameTabs.findIndex((item) => item.id === tab.id);
                let nextIndex: number | null = null;
                if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % gameTabs.length;
                if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + gameTabs.length) % gameTabs.length;
                if (event.key === "Home") nextIndex = 0;
                if (event.key === "End") nextIndex = gameTabs.length - 1;
                if (nextIndex !== null) {
                  event.preventDefault();
                  const nextTab = gameTabs[nextIndex];
                  setActiveTab(nextTab.id);
                  document.getElementById(`games-tab-${nextTab.id}`)?.focus();
                }
              }}
              tabIndex={selected ? 0 : -1}
              className={[
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
                selected ? "bg-zinc-100 text-zinc-950" : "text-zinc-400 hover:bg-zinc-800 hover:text-white",
              ].join(" ")}
            >
              {tab.label}
              <span className={selected ? "text-zinc-600" : "text-zinc-500"}>{count}</span>
            </button>
          );
        })}
      </div>

      <div id="games-tab-panel" role="tabpanel" aria-labelledby={`games-tab-${activeTab}`} className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
        {filteredMatches.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="font-medium text-zinc-300">No {activeTab === "all" ? "completed" : activeTab} games yet</p>
            <p className="mt-1 text-sm text-zinc-500">Your finished games will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {filteredMatches.map((match) => <RecentMatchRow key={match.match_id} match={match} />)}
          </div>
        )}
      </div>
    </section>
  );
}

function RecentMatchRow({ match }: { match: RecentMatch }) {
  const ratingChange = match.rating_after - match.rating_before;

  return (
    <article className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${getResultDotClassName(match.result)}`} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-sm font-semibold text-white">{match.opponent.username}</span>
            <span className="rounded-md border border-zinc-700 px-1.5 py-0.5 text-[11px] text-zinc-400">{getRatingTypeLabel(match.rating_type)}</span>
            <span className="text-xs text-zinc-500">{match.time_control}</span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">{formatPlayedAt(match.played_at)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 pl-5 sm:shrink-0 sm:justify-end sm:pl-0">
        <div className="flex items-center gap-3">
          <span className={`text-sm font-medium ${getResultClassName(match.result)}`}>{getResultLabel(match.result)}</span>
          <div className="text-right">
            <p className="text-sm font-semibold text-white">{match.rating_after}</p>
            <p className={`text-xs ${getRatingChangeClassName(ratingChange)}`}>{formatRatingChange(ratingChange)}</p>
          </div>
        </div>
        <Link
          href={`/dashboard/analysis/${match.match_id}`}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          Analyze
        </Link>
      </div>
    </article>
  );
}

function getRatingTypeLabel(type: RatingType): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function getResultLabel(result: RecentMatchResult): string {
  switch (result) {
    case "win": return "Won";
    case "loss": return "Lost";
    case "draw": return "Draw";
    case "abandoned": return "Abandoned";
  }
}

function getResultClassName(result: RecentMatchResult): string {
  switch (result) {
    case "win": return "text-emerald-400";
    case "loss": return "text-red-400";
    case "draw": return "text-amber-300";
    case "abandoned": return "text-zinc-500";
  }
}

function getResultDotClassName(result: RecentMatchResult): string {
  switch (result) {
    case "win": return "bg-emerald-400";
    case "loss": return "bg-red-400";
    case "draw": return "bg-amber-300";
    case "abandoned": return "bg-zinc-600";
  }
}

function getRatingChangeClassName(change: number): string {
  if (change > 0) return "text-emerald-400";
  if (change < 0) return "text-red-400";
  return "text-zinc-500";
}

function formatRatingChange(change: number): string {
  if (change > 0) return `+${change}`;
  if (change < 0) return `${change}`;
  return "±0";
}

function formatPlayedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
