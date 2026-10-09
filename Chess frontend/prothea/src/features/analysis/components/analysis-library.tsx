"use client";

import { RecentMatches } from "@/features/profile/components/recent-matches";
import { useCurrentUser } from "@/features/profile/hooks/use-current-user";

export function AnalysisLibrary() {
  const { data, isLoading, isError } = useCurrentUser();

  if (isLoading) {
    return <div className="space-y-4" aria-live="polite"><div className="h-20 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" /><div className="h-64 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" /></div>;
  }

  if (isError || !data) {
    return <div role="alert" className="rounded-2xl border border-red-900/60 bg-red-950/20 p-6 text-sm text-red-400">Could not load your games for analysis.</div>;
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 text-white">
      <header className="rounded-2xl border border-zinc-800 bg-linear-to-br from-zinc-900 to-zinc-950 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">Analysis workspace</p>
        <h1 className="mt-2 text-2xl font-semibold">Game analysis</h1>
        <p className="mt-2 max-w-xl text-sm text-zinc-400">Choose a completed game to review its moves, explore alternatives, and compare engine suggestions.</p>
      </header>
      <RecentMatches matches={data.recent_matches} />
    </main>
  );
}
