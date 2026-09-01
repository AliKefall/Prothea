"use client";

import { useEffect } from "react";

import { useAuthStore } from "@/features/auth/auth-store";
import { websocketManager } from "@/lib/websocket";

import { MATCH_FOUND_EVENT, MatchFoundWebSocketEvent } from "../events/events";

import { useMatchmakingStore } from "../store/matchmaking-store";

export function useMatchmakingWebSocket() {
  const accessToken = useAuthStore((state) => state.accessToken);

  const setMatch = useMatchmakingStore((state) => state.setMatch);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    websocketManager.connect(accessToken);

    const unsubscribe = websocketManager.subscribe((message) => {
      if (message.type !== MATCH_FOUND_EVENT) {
        return;
      }

      const event = message as MatchFoundWebSocketEvent;

      const payload = event.payload;

      if (
        !payload.id ||
        !payload.white_id ||
        !payload.black_id ||
        !payload.white_username ||
        !payload.black_username ||
        !payload.time_control ||
        !payload.created_at
      ) {
        console.error("Invalid match found payload:", payload);
        return;
      }

      setMatch(payload);
    });

    return unsubscribe;
  }, [accessToken, setMatch]);
}
