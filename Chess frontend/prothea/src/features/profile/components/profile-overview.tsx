"use client";

import { useCurrentUser } from "../hooks/use-current-user";
import { ProfileRatings } from "./profile-ratings";
import { RecentMatches } from "./recent-matches";

export function ProfileOverview() {
  const { data, isLoading, isError } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm text-zinc-500">
            Loading profile...
          </p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm text-red-400">
            Failed to load profile.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
        <div>
          <h1 className="text-xl font-semibold text-white">
            {data.username}
          </h1>

          <p className="mt-1 text-sm text-zinc-500">
            {data.email}
          </p>
        </div>
      </section>

      <ProfileRatings />

      <RecentMatches />
    </div>
  );
}
