"use client";

import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { websocketManager } from "@/lib/websocket";
import type { WebSocketMessage } from "@/lib/dispatcher";
import {
  GET_OPENING_EVENT,
  OPENING_ANALYSIS_EVENT,
} from "../events/events";

export interface OpeningAnalysis {
  opening: { eco: string; name: string; pgn: string } | null;
  matched_plies: number;
  total_plies: number;
  exit_ply?: number;
  exit_move?: string;
}

interface OpeningAnalysisMessage {
  match_id: string;
  line_key: string;
  analysis: OpeningAnalysis;
}

const pendingOpeningRequests = new Set<string>();

export function useMatchOpening(matchId: string, moves: readonly string[]) {
  const queryClient = useQueryClient();
  const sequence = moves.join(" ");
  const lineKey = `${matchId}|${sequence}`;
  const queryKey = useMemo(
    () => ["match", matchId, "opening", lineKey] as const,
    [lineKey, matchId],
  );
  const query = useQuery<OpeningAnalysis>({
    queryKey,
    queryFn: async () => undefined as unknown as OpeningAnalysis,
    enabled: false,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 15 * 60 * 1000,
  });

  useEffect(() => {
    const sendRequest = () => {
      if (
        moves.length === 0 ||
        !websocketManager.isConnected() ||
        queryClient.getQueryData<OpeningAnalysis>(queryKey) !== undefined ||
        pendingOpeningRequests.has(lineKey)
      ) {
        return;
      }
      try {
        pendingOpeningRequests.add(lineKey);
        websocketManager.send(GET_OPENING_EVENT, {
          match_id: matchId,
          moves,
        });
        window.setTimeout(() => pendingOpeningRequests.delete(lineKey), 15_000);
      } catch (error) {
        pendingOpeningRequests.delete(lineKey);
        console.error("Unable to request opening analysis:", error);
      }
    };

    const handleMessage = (message: WebSocketMessage) => {
      if (message.type !== OPENING_ANALYSIS_EVENT) return;
      const payload = message.payload as OpeningAnalysisMessage;
      if (!payload || payload.match_id !== matchId || !payload.analysis) return;
      pendingOpeningRequests.delete(payload.line_key);
      queryClient.setQueryData(
        ["match", matchId, "opening", payload.line_key],
        payload.analysis,
      );
    };

    const unsubscribeMessage = websocketManager.subscribe(handleMessage);
    const unsubscribeConnection = websocketManager.subscribeConnection(() => {
      pendingOpeningRequests.delete(lineKey);
      sendRequest();
    });
    sendRequest();

    return () => {
      unsubscribeMessage();
      unsubscribeConnection();
      pendingOpeningRequests.delete(lineKey);
    };
  }, [lineKey, matchId, moves, queryClient, queryKey]);

  return query;
}
