import { create } from "zustand";
import { MatchFound } from "./types";

export type MatchmakingStatus = "idle" | "searching" | "matched" | "error";

interface MatchmakingState {
  status: MatchmakingStatus;
  timeControl: string | null;
  error: string | null;
  match: MatchFound | null;

  startSearching: (timeControl: string) => void;
  stopSearching: () => void;
  setMatch: (match: MatchFound) => void;
  setError: (error: string) => void;
  reset: () => void;
}

export const useMatchmakingStore = create<MatchmakingState>((set) => ({
  status: "idle",
  timeControl: null,
  error: null,
  match: null,

  startSearching: (timeControl) =>
    set({
      status: "searching",
      timeControl,
      error: null,
      match: null,
    }),

  stopSearching: () =>
    set({
      status: "idle",
      timeControl: null,
      error: null,
      match: null,
    }),

  setMatch: (match) =>
    set({
      status: "matched",
      timeControl: match.time_control,
      error: null,
      match,
    }),

  setError: (error) =>
    set({
      status: "error",
      error,
    }),

  reset: () =>
    set({
      status: "idle",
      timeControl: null,
      error: null,
      match: null,
    }),
}));
