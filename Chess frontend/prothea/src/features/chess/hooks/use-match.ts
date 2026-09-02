"use client";

import { useQuery } from "@tanstack/react-query";
import { getMatch } from "../api/match-api";

export function useMatch(matchId: string) {
    return useQuery({
        queryKey: ["match", matchId],
        queryFn: () => getMatch(matchId),
        enabled: Boolean(matchId),
        staleTime: 30_000,
    })
}
