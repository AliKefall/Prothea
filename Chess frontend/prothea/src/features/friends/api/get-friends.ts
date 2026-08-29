import { http } from "@/lib/http";
import { Friend } from "../store/types";

export interface GetFriendsResponse {
  friends: Friend[];
}

export async function getFriends(): Promise<GetFriendsResponse> {
  const { data } = await http.get<GetFriendsResponse>("/friends");

  return data;
}
