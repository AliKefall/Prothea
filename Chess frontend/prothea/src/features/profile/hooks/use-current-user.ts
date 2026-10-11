import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { getCurrentUser, getPlayerProfile } from "../api/profile-api";
import { useRatingStore } from "../rating-store";

export const currentUserQueryKey = ["current-user"] as const;

export function useCurrentUser(username?: string) {
  const setRatings = useRatingStore((state) => state.setRatings);

  const query = useQuery({
    queryKey: username ? ["player-profile", username] : currentUserQueryKey,
    queryFn: () => username ? getPlayerProfile(username) : getCurrentUser(),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!query.data || username) {
      return;
    }

    setRatings(query.data.ratings);
  }, [query.data, setRatings, username]);

  return query;
}
