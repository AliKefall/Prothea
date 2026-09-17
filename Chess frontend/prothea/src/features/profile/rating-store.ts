import { create } from "zustand";

export type RatingType = "bullet" | "blitz" | "rapid";

export interface PlayerRating {
  rating: number;
  games_played: number;
}

export interface PlayerRatings {
  bullet: PlayerRating;
  blitz: PlayerRating;
  rapid: PlayerRating;
}

// A little bit of a note in here, after the user logs in
// if the ratings did not come from the backend yet
// typescript could confuse with undefined and null
// this is a gimmic for this language thats why I used partial in here
interface RatingState extends Partial<PlayerRatings> {
  setRatings: (ratings: PlayerRatings) => void;

  setRating: (type: RatingType, rating: PlayerRating) => void;

  clearRatings: () => void;
}

export const useRatingStore = create<RatingState>((set) => ({
  bullet: undefined,
  blitz: undefined,
  rapid: undefined,

  setRatings: (ratings) => {
    set({
      bullet: ratings.bullet,
      blitz: ratings.blitz,
      rapid: ratings.rapid,
    });
  },

  /*
   * Update only the rating category affected by
   * the latest finished game.
   */
  setRating: (type, rating) => {
    set({
      [type]: rating,
    });
  },

  clearRatings: () => {
    set({
      bullet: undefined,
      blitz: undefined,
      rapid: undefined,
    });
  },
}));
