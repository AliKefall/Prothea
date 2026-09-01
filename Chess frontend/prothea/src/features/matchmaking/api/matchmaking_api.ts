import { http } from "@/lib/http";

// This one is for enqueue
export interface EnqueueRequest {
  time_control: string;
}

export interface EnqueueResponse {
  time_control: string;
}

// This one is for dequeue, they are totally similar but if anytime we want to add more
// to any of them this will give us a chance to do that without refactoring too much.

export interface DequeueRequest {
  time_control: string;
}

export interface DequeueResponse {
  time_control: string;
}

export async function enqueueMatch(
  timeControl: string,
): Promise<EnqueueResponse> {
  const response = await http.post<EnqueueResponse>("/matchmaking/enqueue", {
    time_control: timeControl,
  });

  return response.data;
}

// If use wants to dequeue himself from the matchmaking service.
// it should be used carefully this one here is just a ticking race condition bomb
export async function dequeueMatch(
  timeControl: string,
): Promise<DequeueRequest> {
  const response = await http.post<EnqueueResponse>("/matchmaking/dequeue", {
    time_control: timeControl,
  });

  return response.data;
}
