import { http } from "@/lib/http";

export interface AcceptFriendRequestBody {
  username: string;
}

export interface AcceptFriendRequestResponse {
  message: string;
}

export async function acceptFriendRequest(
  body: AcceptFriendRequestBody,
): Promise<AcceptFriendRequestResponse> {
  const { data } = await http.post<AcceptFriendRequestResponse>(
    "/friends/requests/accept",
    body,
  );

  return data;
}
