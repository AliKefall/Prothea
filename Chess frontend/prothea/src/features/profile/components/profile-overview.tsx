"use client";

import { useCurrentUser } from "../hooks/use-current-user";
import { ProfileRatings } from "./profile-ratings";
import { RecentMatches } from "./recent-matches";
import { PlayerFriendAction } from "./player-friend-action";

export function ProfileOverview({ username }: { username?: string }) {
  const { data, isLoading, isError } = useCurrentUser(username);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6" aria-live="polite">
        <div className="h-28 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
        <div className="h-36 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
        <div className="h-72 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div role="alert" className="rounded-2xl border border-red-900/60 bg-red-950/20 p-6">
          <p className="text-sm text-red-400">
            Failed to load profile.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 sm:p-8">
        <div aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-zinc-800 text-xl font-bold text-white">
          {data.username.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Player profile</p>
          <h1 className="mt-1 truncate text-2xl font-semibold text-white">{data.username}</h1>
        </div>
        {username && <PlayerFriendAction userId={data.user_id} username={data.username} />}
      </section>

      <ProfileRatings ratings={data.ratings} />

      <RecentMatches matches={data.recent_matches} />
    </div>
  );
}
