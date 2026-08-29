import { useMutation } from "@tanstack/react-query";
import { acceptFriendRequest } from "../api/accept-friend-request";

export function useAcceptFriendRequest() {
  return useMutation({
    mutationFn: acceptFriendRequest,
  });
}
