"use client";

import { useRatingStore } from "../rating-store";
import type { PlayerRatings as PlayerRatingsData } from "../types/profile-types";
import { RatingCard } from "./rating-card";

export function ProfileRatings({ ratings }: { ratings?: PlayerRatingsData }) {
  const storedBullet = useRatingStore((state) => state.bullet);
  const storedBlitz = useRatingStore((state) => state.blitz);
  const storedRapid = useRatingStore((state) => state.rapid);
  const bullet = ratings?.bullet ?? storedBullet;
  const blitz = ratings?.blitz ?? storedBlitz;
  const rapid = ratings?.rapid ?? storedRapid;

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-white">Ratings</h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
