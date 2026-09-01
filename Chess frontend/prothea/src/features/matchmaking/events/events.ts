import type { MatchFound } from "../store/types";

export const MATCH_FOUND_EVENT = "match_found";

export interface MatchFoundWebSocketEvent {
  type: typeof MATCH_FOUND_EVENT;
  payload: MatchFound;
}
