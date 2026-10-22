"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { websocketManager } from "@/lib/websocket";
import type { WebSocketMessage } from "@/lib/dispatcher";
import {
  GET_OPENING_LIBRARY_EVENT,
  OPENING_LIBRARY_EVENT,
} from "../events/events";

export interface OpeningEntry {
  eco: string;
  name: string;
  pgn: string;
}

interface OpeningLibraryMessage {
  openings: OpeningEntry[];
}

const OPENING_LIBRARY_QUERY_KEY = ["opening-library"] as const;
let requestPending = false;
let pendingTimeout: number | undefined;

export function useOpeningLibrary(enabled: boolean) {
  const queryClient = useQueryClient();
  const query = useQuery<OpeningEntry[]>({
    queryKey: OPENING_LIBRARY_QUERY_KEY,
    queryFn: async () => undefined as unknown as OpeningEntry[],
    enabled: false,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  });

  useEffect(() => {
    if (!enabled) return;

    const sendRequest = () => {
      if (
        !websocketManager.isConnected() ||
        queryClient.getQueryData<OpeningEntry[]>(OPENING_LIBRARY_QUERY_KEY) ||
        requestPending
      ) {
        return;
      }
      try {
        requestPending = true;
        websocketManager.send(GET_OPENING_LIBRARY_EVENT, {});
        window.clearTimeout(pendingTimeout);
        pendingTimeout = window.setTimeout(() => {
          requestPending = false;
        }, 15_000);
      } catch (error) {
        requestPending = false;
        window.clearTimeout(pendingTimeout);
        console.error("Unable to request the opening library:", error);
      }
    };

    const handleMessage = (message: WebSocketMessage) => {
      if (message.type !== OPENING_LIBRARY_EVENT) return;
      const payload = message.payload as OpeningLibraryMessage;
      if (!Array.isArray(payload?.openings)) return;
      requestPending = false;
      window.clearTimeout(pendingTimeout);
      queryClient.setQueryData(OPENING_LIBRARY_QUERY_KEY, payload.openings);
    };

    const unsubscribeMessage = websocketManager.subscribe(handleMessage);
    const unsubscribeConnection = websocketManager.subscribeConnection(() => {
      requestPending = false;
      window.clearTimeout(pendingTimeout);
      sendRequest();
    });
    sendRequest();

    return () => {
      unsubscribeMessage();
      unsubscribeConnection();
    };
  }, [enabled, queryClient]);

  return {
    ...query,
    isLoading: enabled && query.data === undefined,
  };
}
