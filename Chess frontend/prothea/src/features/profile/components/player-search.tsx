"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MagnifyingGlassIcon, UserCircleIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";

import { searchPlayers } from "../api/profile-api";

export function PlayerSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim();
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(normalizedQuery), 350);
    return () => window.clearTimeout(timeout);
  }, [normalizedQuery]);

  const search = useQuery({
    queryKey: ["player-search", debouncedQuery],
    queryFn: () => searchPlayers(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  });
  const showResults = normalizedQuery.length >= 2;

  function openPlayer(username: string) {
    setQuery("");
    router.push(`/dashboard/players/${encodeURIComponent(username)}`);
  }

  return (
    <div className="relative z-30 w-full max-w-2xl">
      <label htmlFor="player-search" className="sr-only">Search players</label>
      <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/80 px-4 shadow-sm transition focus-within:border-sky-400/50 focus-within:ring-2 focus-within:ring-sky-400/10">
        <MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-zinc-500" aria-hidden="true" />
        <input
          id="player-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a player by username"
          autoComplete="off"
          className="h-12 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
        />
      </div>

      {showResults && (
        <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/40">
          {normalizedQuery.length >= 2 && debouncedQuery !== normalizedQuery ? (
            <p className="px-4 py-3 text-sm text-zinc-500">Searching players…</p>
          ) : search.isLoading ? (
            <p className="px-4 py-3 text-sm text-zinc-500">Searching players…</p>
          ) : search.isError ? (
            <p role="alert" className="px-4 py-3 text-sm text-red-300">Could not search players.</p>
          ) : search.data?.length ? (
            <ul aria-label="Player search results" className="divide-y divide-zinc-800/80">
              {search.data.map((player) => (
                <li key={player.user_id}>
                  <button
                    type="button"
                    onClick={() => openPlayer(player.username)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-zinc-900"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-zinc-800 text-zinc-300">
                      <UserCircleIcon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="truncate text-sm font-medium text-zinc-100">{player.username}</span>
                    <span className="ml-auto text-xs text-zinc-500">View profile</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-zinc-500">No players found.</p>
          )}
        </div>
      )}
    </div>
  );
}
