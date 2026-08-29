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

const ACCESS_KEY = "access_token";
const USER_KEY = "user";

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  hydrated: false,

  setSession: (token, user) => {
    localStorage.setItem(ACCESS_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));

    set({
      accessToken: token,
      user,
    });
  },

  clearSession: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(USER_KEY);

    set({
      accessToken: null,
      user: null,
    });
  },

  hydrate: () => {
    const token = localStorage.getItem(ACCESS_KEY);
    const user = localStorage.getItem(USER_KEY);

    set({
      accessToken: token,
      user: user ? JSON.parse(user) : null,
      hydrated: true,
    });
  },
}));
