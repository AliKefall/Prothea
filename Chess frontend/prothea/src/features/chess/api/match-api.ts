import { http } from "@/lib/http";

export type MatchResult = "pending" | "white" | "black" | "draw" | "abandoned";

export interface Match {
  id: string;

  white_id: string;
  white_username: string;
  white_rating: number;

  black_id: string;
  black_username: string;
  black_rating: number;

  time_control: string;

  result: MatchResult;

  created_at: string;
  finished_at: string | null;
}

export async function getMatch(matchId: string): Promise<Match> {
  const response = await http.get<Match>(`/matches/${matchId}`);

  return response.data;
}

export interface MatchMove {
  id: number;

  match_id: string;
  move_number: number;
  player_id: string;

  san: string;
  uci: string;

  fen_after: string;

  white_time_ms: number;
  black_time_ms: number;

  created_at: string;
}

export async function getMatchMoves(
  matchId: string,
): Promise<MatchMove[]> {
  const response = await http.get<MatchMove[]>(
    `/matches/${matchId}/moves`,
  );

  return response.data;
}
