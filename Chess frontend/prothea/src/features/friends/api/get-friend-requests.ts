import { http } from "@/lib/http";
import { FriendRequest } from "../store/types";

export interface GetFriendRequestsResponse {
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
}

export async function getFriendRequests(): Promise<GetFriendRequestsResponse> {
  const { data } =
    await http.get<GetFriendRequestsResponse>("/friends/requests");
  return data;
}
