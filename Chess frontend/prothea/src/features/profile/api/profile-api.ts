import { http } from "@/lib/http";
import { CurrentUserProfile } from "../types/profile-types";

export async function getCurrentUser(): Promise<CurrentUserProfile> {
  const response = await http.get<CurrentUserProfile>("/profile");

  return response.data;
}

export async function getPlayerProfile(username: string): Promise<CurrentUserProfile> {
  const response = await http.get<CurrentUserProfile>(`/players/${encodeURIComponent(username)}`);
  return response.data;
}

export interface PlayerSearchResult {
  user_id: string;
  username: string;
}

export async function searchPlayers(query: string): Promise<PlayerSearchResult[]> {
  const response = await http.get<{ players: PlayerSearchResult[] }>("/players/search", {
    params: { q: query },
  });
  return response.data.players;
}
