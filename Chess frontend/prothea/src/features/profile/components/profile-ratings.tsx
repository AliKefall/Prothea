"use client";

import { useRatingStore } from "../rating-store";
import { RatingCard } from "./rating-card";

export function ProfileRatings() {
  const bullet = useRatingStore((state) => state.bullet);
  const blitz = useRatingStore((state) => state.blitz);
  const rapid = useRatingStore((state) => state.rapid);

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-white">Ratings</h2>

      <div className="grid grid-cols-3 gap-3">
        <RatingCard
          title="Bullet"
          rating={bullet?.rating}
          gamesPlayed={bullet?.games_played}
        />

        <RatingCard
          title="Blitz"
          rating={blitz?.rating}
          gamesPlayed={blitz?.games_played}
        />

        <RatingCard
          title="Rapid"
          rating={rapid?.rating}
          gamesPlayed={rapid?.games_played}
        />
      </div>
    </section>
  );
}
