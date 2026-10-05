importScripts(
  "/stockfish/stockfish-19-lite-single.js",
);

type EngineModule = {
  onmessage?: (event: MessageEvent) => void;
  postMessage?: (message: string) => void;
};

declare const Stockfish: () => EngineModule;

let engine: EngineModule | null = null;

initialize();

function initialize(): void {
  try {
    engine = Stockfish();

    if (!engine) {
      throw new Error(
        "Failed to initialize Stockfish",
      );
    }

    engine.onmessage = (
      event: MessageEvent,
    ) => {
      const message =
        typeof event.data === "string"
          ? event.data
          : "";

      if (!message) {
        return;
      }

      self.postMessage(message);
    };

    self.postMessage("ready");
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Stockfish initialization failed";

    self.postMessage(
      `error ${message}`,
    );
  }
}

self.onmessage = (
  event: MessageEvent<string>,
) => {
  if (!engine) {
    return;
  }

  engine.postMessage?.(
    event.data,
  );
};

export {};
