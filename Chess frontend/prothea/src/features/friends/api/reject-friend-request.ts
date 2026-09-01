import { http } from "@/lib/http";

export interface RejectFriendRequestBody {
  username: string;
}

export interface RejectFriendRequestResponse {
  message: string;
}

export async function rejectFriendRequest(
  body: RejectFriendRequestBody,
): Promise<RejectFriendRequestResponse> {
  const { data } = await http.post<RejectFriendRequestResponse>(
    "/friends/requests/reject",
    body,
  );

  return data;
}
