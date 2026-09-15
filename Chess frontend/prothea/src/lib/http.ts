"use client";

import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

import { useAuthStore } from "@/features/auth/auth-store";

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    request_id?: string;
  };
};

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

type FailedRequest = {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public requestId?: string,
  ) {
    super(message);

    this.name = "ApiError";
  }
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export const http = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

/*
 * The refresh endpoint uses an isolated Axios client.
 * This prevents a failed refresh request from entering
 * the normal authentication interceptor again.
 */
const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});


/* Alos if refresh endpoints throws another race condition
 * Change the backend for another algorithm
 */
http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

let isRefreshing = false;

let failedQueue: FailedRequest[] = [];

function processQueue(error: unknown, token?: string) {
  for (const request of failedQueue) {
    if (error) {
      request.reject(error);
      continue;
    }

    if (token) {
      request.resolve(token);
    }
  }

  failedQueue = [];
}

function isAuthEndpoint(url?: string): boolean {
  if (!url) {
    return false;
  }

  return (
    url.startsWith("/auth/login") ||
    url.startsWith("/auth/register") ||
    url.startsWith("/auth/refresh")
  );
}

http.interceptors.response.use(
  (response) => response,

  async (error: AxiosError<ApiErrorBody>) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;

    if (!originalRequest) {
      return Promise.reject(
        new ApiError(
          error.response?.status ?? 0,
          "request_failed",
          error.message,
        ),
      );
    }

    const status = error.response?.status;

    /*
     * Only regular authenticated requests are allowed
     * to enter the refresh flow.
     */
    const shouldRefresh =
      status === 401 &&
      !originalRequest._retry &&
      !isAuthEndpoint(originalRequest.url);

    if (!shouldRefresh) {
      const body = error.response?.data;

      return Promise.reject(
        new ApiError(
          status ?? 0,
          body?.error?.code ?? "request_failed",
          body?.error?.message ?? error.message,
          body?.error?.request_id,
        ),
      );
    }

    /*
     * If another request already owns the refresh operation,
     * wait for that operation instead of creating another one.
     */
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;

            resolve(http(originalRequest));
          },

          reject,
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const response = await refreshClient.post<{
        access_token: string;
      }>("/auth/refresh");

      const newAccessToken = response.data.access_token;

      const currentUser = useAuthStore.getState().user;

      if (!currentUser) {
        throw new Error("No user in auth store");
      }

      useAuthStore.getState().setSession(newAccessToken, currentUser);

      /*
       * Release all requests that were waiting for
       * the refreshed access token.
       */
      processQueue(null, newAccessToken);

      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

      return http(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError);

      useAuthStore.getState().clearSession();

      /*
       * Axios interceptors are outside the React component tree,
       * so useRouter() cannot be called here directly.
       *
       * Use a browser history navigation instead of
       * assigning window.location.href.
       */
      if (
        typeof window !== "undefined" &&
        window.location.pathname !== "/login"
      ) {
        window.history.pushState({}, "", "/login");

        window.dispatchEvent(new PopStateEvent("popstate"));
      }

      return Promise.reject(
        new ApiError(401, "session_expired", "Session expired"),
      );
    } finally {
      isRefreshing = false;
    }
  },
);
