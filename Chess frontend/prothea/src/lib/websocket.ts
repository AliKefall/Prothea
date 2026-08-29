import { WebSocketMessage } from "./dispatcher";

type Listener = (message: WebSocketMessage) => void;

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

const WS_URL = API_BASE_URL.replace(/^http/, "ws");

class WebSocketManager {
  private socket: WebSocket | null = null;
  private token: string | null = null;

  private listeners = new Set<Listener>();

  private reconnectAttempt = 0;
  private reconnectTimer: number | undefined;

  private manualClose = false;

  connect(accessToken: string) {
    this.token = accessToken;
    this.manualClose = false;

    if (
      this.socket?.readyState === WebSocket.OPEN ||
      this.socket?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    const url =
      `${WS_URL}/ws?token=${encodeURIComponent(accessToken)}`;

    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      console.log("WebSocket connected");

      this.reconnectAttempt = 0;
      this.reconnectTimer = undefined;
    };

    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(
          event.data,
        ) as WebSocketMessage;

        this.emit(message);
      } catch (error) {
        console.error(
          "Failed to parse WebSocket message:",
          error,
        );
      }
    };

    this.socket.onclose = (event) => {
      console.log(
        "WebSocket closed",
        {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        },
      );

      this.socket = null;

      if (!this.manualClose) {
        this.scheduleReconnect();
      }
    };

    this.socket.onerror = (error) => {
      console.error("WebSocket error:", error);

      /*
       * onclose will be triggered afterwards.
       * Reconnect logic therefore lives in onclose.
       */
      this.socket?.close();
    };
  }

  disconnect() {
    this.manualClose = true;

    if (this.reconnectTimer !== undefined) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    this.token = null;

    if (this.socket) {
      this.socket.close(1000, "logout");
      this.socket = null;
    }
  }

  send(
    type: string,
    payload: unknown,
  ) {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      throw new Error(
        "WebSocket is not connected",
      );
    }

    this.socket.send(
      JSON.stringify({
        type,
        payload,
      }),
    );
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(message: WebSocketMessage) {
    for (const listener of this.listeners) {
      try {
        listener(message);
      } catch (error) {
        console.error(
          "WebSocket listener error:",
          error,
        );
      }
    }
  }

  private scheduleReconnect() {
    if (
      this.manualClose ||
      !this.token ||
      this.reconnectTimer !== undefined
    ) {
      return;
    }

    const delay = Math.min(
      30_000,
      1_000 * 2 ** this.reconnectAttempt,
    );

    this.reconnectAttempt += 1;

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = undefined;

      if (!this.manualClose && this.token) {
        this.connect(this.token);
      }
    }, delay);
  }
}

export const websocketManager =
  new WebSocketManager();
