"use client";

import { useCurrentUser } from "../hooks/use-current-user";
import { RecentMatch, RecentMatchResult } from "../types/profile-types";

export function RecentMatches() {
  const { data, isLoading, isError } = useCurrentUser();

  if (isLoading) {
    return (
      <section>
        <h2 className="mb-4 text-lg font-semibold text-white">Recent Games</h2>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-sm text-zinc-500">Loading games...</p>
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section>
        <h2 className="mb-4 text-lg font-semibold text-white">Recent Games</h2>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-sm text-red-400">Failed to load recent games.</p>
        </div>
      </section>
    );
  }

  const matches = data?.recent_matches ?? [];

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-white">Recent Games</h2>

      <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
        {matches.length === 0 ? (
          <div className="p-4">
            <p className="text-sm text-zinc-500">No completed games yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {matches.map((match) => (
              <RecentMatchRow key={match.match_id} match={match} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function RecentMatchRow({ match }: { match: RecentMatch }) {
  const ratingChange = match.rating_after - match.rating_before;

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-white">
            {match.opponent.username}
          </span>

          <span className="text-xs text-zinc-500">{match.time_control}</span>
        </div>

        <p className="mt-1 text-xs text-zinc-500">
          {formatPlayedAt(match.played_at)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <span
          className={`text-sm font-medium ${getResultClassName(match.result)}`}
        >
          {getResultLabel(match.result)}
        </span>

        <div className="text-right">
          <p className="text-sm font-medium text-white">{match.rating_after}</p>

          <p className={`text-xs ${getRatingChangeClassName(ratingChange)}`}>
            {formatRatingChange(ratingChange)}
          </p>
        </div>
      </div>
    </div>
  );
}

function getResultLabel(result: RecentMatchResult): string {
  switch (result) {
    case "win":
      return "Won";

    case "loss":
      return "Lost";

    case "draw":
      return "Draw";

    case "abandoned":
      return "Abandoned";
  }
}

function getResultClassName(result: RecentMatchResult): string {
  switch (result) {
    case "win":
      return "text-emerald-400";

    case "loss":
      return "text-red-400";

    case "draw":
      return "text-yellow-400";

    case "abandoned":
      return "text-zinc-500";
  }
}

function getRatingChangeClassName(change: number): string {
  if (change > 0) {
    return "text-emerald-400";
  }

  if (change < 0) {
    return "text-red-400";
  }

  return "text-zinc-500";
}

function formatRatingChange(change: number): string {
  if (change > 0) {
    return `+${change}`;
  }

  if (change < 0) {
    return `${change}`;
  }

  return "±0";
}

function formatPlayedAt(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
