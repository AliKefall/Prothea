import { useMutation } from "@tanstack/react-query";
import { rejectFriendRequest } from "../api/reject-friend-request";

export function useRejectFriendRequest() {
    return useMutation({
        mutationFn: rejectFriendRequest,
    })
}
