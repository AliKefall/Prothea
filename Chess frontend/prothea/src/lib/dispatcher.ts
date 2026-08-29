export interface WebSocketMessage<T = unknown> {
  id?: string;
  type: string;
  payload: T;
  created_at: string;
}

