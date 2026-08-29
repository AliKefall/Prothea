import { create } from "zustand";
import type { FriendsState } from "./types";

export const useFriendsStore = create<FriendsState>(() => ({
  friends: [],

  incomingRequests: [],

  outgoingRequests: [],
}));
