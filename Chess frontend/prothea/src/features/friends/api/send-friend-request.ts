import { http } from "@/lib/http";

export interface SendFriendRequestBody {
  username: string;
}

export interface SendFriendRequestResponse {
  message: string;
}

export async function sendFriendRequest(
  body: SendFriendRequestBody,
): Promise<SendFriendRequestResponse> {
  const { data } = await http.post<SendFriendRequestResponse>(
    "/friends/requests",
    body,
  );

  return data;
}
