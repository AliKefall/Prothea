import { useQuery } from "@tanstack/react-query";
import { getFriends } from "../api/get-friends";
import { getFriendRequests } from "../api/get-friend-requests";
import { useEffect } from "react";
import { friendsActions } from "../store/actions";

export function useFriends() {
  const friendsQuery = useQuery({
    queryKey: ["friends"],
    queryFn: getFriends,
    staleTime: Infinity,
  });

  const requestQuery = useQuery({
    queryKey: ["friend-requests"],
    queryFn: getFriendRequests,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (friendsQuery.data) {
      friendsActions.setFriends(friendsQuery.data.friends);
    }
  }, [friendsQuery.data]);

  useEffect(() => {
    if (requestQuery.data) {
      friendsActions.setIncomingRequests(requestQuery.data.incoming);
      friendsActions.setOutgoingRequests(requestQuery.data.outgoing);
    }
  }, [requestQuery.data]);

  return {
    isLoading: friendsQuery.isLoading || requestQuery.isLoading,

    isError: friendsQuery.isError || requestQuery.isError,

    error: friendsQuery.error ?? requestQuery.error,
  };
}
