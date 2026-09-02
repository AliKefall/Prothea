export const GAME_MOVE_EVENT = "game_move";

export interface GameMovePayload {
  match_id: string;

  from: string;
  to: string;

  promotion?: "q" | "r" | "b" | "n";

  uci: string;
}
