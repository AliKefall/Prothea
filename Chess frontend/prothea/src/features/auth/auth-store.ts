import { create } from "zustand";
import { User } from "./api/auth.types";

type AuthState = {
  accessToken: string | null;
  user: User | null;
  hydrated: boolean;

  setSession: (token: string, user: User) => void;
  clearSession: () => void;
  hydrate: () => void;
};

const USER_KEY = "user";

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  hydrated: false,

  setSession: (token, user) => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        // Remove tokens written by older app versions; access tokens stay in memory.
        localStorage.removeItem("access_token");
      } catch {
        // The in-memory session still works when browser storage is unavailable.
      }
    }

    set({
      accessToken: token,
      user,
    });
  },

  clearSession: () => {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("access_token");
        localStorage.removeItem(USER_KEY);
      } catch {
        // The in-memory session is cleared even if browser storage is unavailable.
      }
    }

    set({
      accessToken: null,
      user: null,
    });
  },

  hydrate: () => {
    let user: User | null = null;
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(USER_KEY);
        const parsed: unknown = stored ? JSON.parse(stored) : null;
        if (
          parsed &&
          typeof parsed === "object" &&
          "user_id" in parsed && typeof parsed.user_id === "string" &&
          "username" in parsed && typeof parsed.username === "string" &&
          "email" in parsed && typeof parsed.email === "string"
        ) {
          user = parsed as User;
        }
      } catch {
        user = null;
        try {
          localStorage.removeItem(USER_KEY);
        } catch {
          // Ignore unavailable browser storage.
        }
      }
      try {
        localStorage.removeItem("access_token");
      } catch {
        // Ignore unavailable browser storage.
      }
    }

    set({
      accessToken: null,
      user,
      hydrated: true,
    });
  },
}));
