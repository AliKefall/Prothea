import { QueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
        retry: (failureCount, error: unknown) => {
          const err = error as AxiosError;

          if (!err?.response) {
            return failureCount < 2;
          }

          if (err.response?.status === 401) {
            return false;
          }

          if (err.response?.status >= 500) {
            return failureCount < 3;
          }
          return false;
        },
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
