"use client";

import { useQuery } from "@tanstack/react-query";

import { getMatchMoves } from "../api/match-api";

export function useMatchMoves(matchId: string) {
  return useQuery({
    queryKey: ["match", matchId, "moves"],
    queryFn: () => getMatchMoves(matchId),
    enabled: Boolean(matchId),
    staleTime: 5_000,
  });
}
