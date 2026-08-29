import { useAuthStore } from "@/features/auth/auth-store";
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

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
 * Refresh request must use a separate axios instance.
 * Otherwise a failed refresh could trigger another refresh.
 */
const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

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
    } else if (token) {
      request.resolve(token);
    }
  }

  failedQueue = [];
}

function isAuthEndpoint(url?: string) {
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
     * Authentication endpoints should not trigger
     * the refresh flow.
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
     * Another request is already refreshing the token.
     * Queue this request until the refresh completes.
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

      processQueue(null, newAccessToken);

      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

      return http(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError);

      useAuthStore.getState().clearSession();

      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }

      return Promise.reject(
        new ApiError(401, "session_expired", "Session expired"),
      );
    } finally {
      isRefreshing = false;
    }
  },
);
