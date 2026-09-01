export interface QueueEntry {
  user_id: string;
  username: string;
  rating: number;
  time_control: string;
  joined_at: string;
}

export interface MatchFound{
    id: string;
    white_username: string;
    white_id: string;
    black_username: string;
    black_id: string;
    white_rating: number;
    black_rating: number;
    time_control: string;
    created_at: string;
}
