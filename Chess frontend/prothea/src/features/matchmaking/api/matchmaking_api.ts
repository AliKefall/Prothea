import { http } from "@/lib/http";

export interface EnqueueRequest {
  time_control: string;
}

export interface EnqueueResponse {
  message: string;
}

export interface DequeueRequest {
  time_control: string;
}

export interface DequeueResponse {
  message: string;
}

export async function enqueueMatchmaking(
  timeControl: string,
): Promise<EnqueueResponse> {
  const response = await http.post<EnqueueResponse>(
    "/matchmaking/enqueue",
    {
      time_control: timeControl,
    },
  );

  return response.data;
}

export async function dequeueMatchmaking(
  timeControl: string,
): Promise<DequeueResponse> {
  const response = await http.delete<DequeueResponse>(
    "/matchmaking/queue",
    {
      data: {
        time_control: timeControl,
      },
    },
  );

  return response.data;
}
