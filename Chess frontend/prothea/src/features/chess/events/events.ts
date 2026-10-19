export const GAME_MOVE_EVENT = "game_move";
export const GET_OPENING_EVENT = "get_opening";
export const OPENING_ANALYSIS_EVENT = "opening_analysis";

export interface GameMovePayload {
  match_id: string;

  from: string;
  to: string;

  promotion?: "q" | "r" | "b" | "n";

  uci: string;
}
