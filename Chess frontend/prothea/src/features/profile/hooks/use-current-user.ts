import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { getCurrentUser } from "../api/profile-api";
import { useRatingStore } from "../rating-store";

export const currentUserQueryKey = ["current-user"] as const;

export function useCurrentUser() {
  const setRatings = useRatingStore((state) => state.setRatings);

  const query = useQuery({
    queryKey: currentUserQueryKey,
    queryFn: getCurrentUser,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!query.data) {
      return;
    }

    setRatings(query.data.ratings);
  }, [query.data, setRatings]);

  return query;
}
