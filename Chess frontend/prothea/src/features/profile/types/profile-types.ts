export type RatingType = "bullet" | "blitz" | "rapid";

export interface PlayerRating {
  rating: number;
  games_played: number;
}

export interface PlayerRatings {
  bullet: PlayerRating;
  blitz: PlayerRating;
  rapid: PlayerRating;
}

export interface RecentMatchOpponent {
  id: string;
  username: string;
}

export type RecentMatchResult = "win" | "loss" | "draw" | "abandoned";

export interface RecentMatch {
  match_id: string;
  opponent: RecentMatchOpponent;
  result: RecentMatchResult;
  time_control: string;
  rating_before: number;
  rating_after: number;
  played_at: string;
}

export interface CurrentUserProfile {
  user_id: string;
  username: string;
  email: string;
  ratings: PlayerRatings;
  recent_matches: RecentMatch[];
}
