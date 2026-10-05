import type {
  AnalysisResult,
  EngineMove,
} from "../types/analysis";

type AnalyzeMessage = {
  type: "analyze";
  requestId: string;
  fen: string;
  depth: number;
  multiPv: number;
};

type StopMessage = {
  type: "stop";
  requestId?: string;
};

type WorkerMessage =
  | AnalyzeMessage
  | StopMessage;

type EngineReadyMessage = {
  type: "ready";
};

type EngineResultMessage = {
  type: "result";
  requestId: string;
  result: AnalysisResult;
};

type EngineErrorMessage = {
  type: "error";
  requestId?: string;
  message: string;
};

type EngineResponse =
  | EngineReadyMessage
  | EngineResultMessage
  | EngineErrorMessage;

type StockfishMessageEvent =
  | string
  | {
      data?: string;
    };

let engineReady = false;
let activeRequestId: string | null = null;

let currentFen = "";
let currentDepth = 0;

const engineLines = new Map<
  number,
  EngineMove
>();

importScripts(
  "/stockfish/stockfish-19-lite-single.js",
);

const stockfish = self as typeof self & {
  postMessage: typeof self.postMessage;
  onmessage:
    | ((event: MessageEvent) => void)
    | null;
};

stockfish.onmessage = (
  event: MessageEvent<StockfishMessageEvent>,
) => {
  const line = normalizeMessage(
    event.data,
  );

  if (!line) {
    return;
  }

  handleEngineLine(line);
};

stockfish.postMessage("uci");

function handleEngineLine(
  line: string,
): void {
  if (line === "uciok") {
    stockfish.postMessage("isready");
    return;
  }

  if (line === "readyok") {
    engineReady = true;

    postMessage({
      type: "ready",
    } satisfies EngineReadyMessage);

    return;
  }

  if (!engineReady) {
    return;
  }

  if (line.startsWith("info ")) {
    handleInfoLine(line);
    return;
  }

  if (line.startsWith("bestmove ")) {
    handleBestMove();
  }
}

self.onmessage = (
  event: MessageEvent<WorkerMessage>,
) => {
  const message = event.data;

  switch (message.type) {
    case "analyze":
      handleAnalyze(message);
      break;

    case "stop":
      handleStop(message);
      break;
  }
};

function handleAnalyze(
  message: AnalyzeMessage,
): void {
  if (!engineReady) {
    postError(
      message.requestId,
      "Stockfish is not ready",
    );

    return;
  }

  activeRequestId = message.requestId;

  currentFen = message.fen;
  currentDepth = message.depth;

  engineLines.clear();

  stockfish.postMessage(
    `setoption name MultiPV value ${message.multiPv}`,
  );

  stockfish.postMessage(
    "ucinewgame",
  );

  stockfish.postMessage(
    `position fen ${message.fen}`,
  );

  stockfish.postMessage(
    `go depth ${message.depth}`,
  );
}

function handleStop(
  message: StopMessage,
): void {
  if (
    message.requestId !== undefined &&
    message.requestId !== activeRequestId
  ) {
    return;
  }

  stockfish.postMessage("stop");

  activeRequestId = null;
  engineLines.clear();
}

function handleInfoLine(
  line: string,
): void {
  if (!activeRequestId) {
    return;
  }

  const parsed = parseInfoLine(line);

  if (!parsed) {
    return;
  }

  engineLines.set(
    parsed.multiPv,
    parsed.move,
  );
}

function handleBestMove(): void {
  if (!activeRequestId) {
    return;
  }

  const requestId =
    activeRequestId;

  const moves = [
    ...engineLines.entries(),
  ]
    .sort(([a], [b]) => a - b)
    .map(([, move]) => move);

  const result: AnalysisResult = {
    fen: currentFen,
    moves,
    depth: currentDepth,
  };

  engineLines.clear();
  activeRequestId = null;

  postMessage({
    type: "result",
    requestId,
    result,
  } satisfies EngineResultMessage);
}

function parseInfoLine(
  line: string,
): {
  multiPv: number;
  move: EngineMove;
} | null {
  const tokens =
    line.trim().split(/\s+/);

  const depth = readInteger(
    tokens,
    "depth",
  );

  const multiPv = readInteger(
    tokens,
    "multipv",
  );

  const scoreIndex =
    tokens.indexOf("score");

  const pvIndex =
    tokens.indexOf("pv");

  if (
    depth === null ||
    multiPv === null ||
    scoreIndex === -1 ||
    pvIndex === -1 ||
    pvIndex + 1 >= tokens.length
  ) {
    return null;
  }

  const scoreType =
    tokens[scoreIndex + 1];

  const scoreValue = Number(
    tokens[scoreIndex + 2],
  );

  const uci =
    tokens[pvIndex + 1];

  if (
    !scoreType ||
    !Number.isFinite(scoreValue) ||
    !isValidUciMove(uci)
  ) {
    return null;
  }

  const evaluation =
    scoreType === "cp"
      ? scoreValue / 100
      : null;

  const mate =
    scoreType === "mate"
      ? scoreValue
      : undefined;

  return {
    multiPv,
    move: {
      uci,
      san: uci,
      evaluation,
      depth,
      ...(mate !== undefined
        ? { mate }
        : {}),
    },
  };
}

function readInteger(
  tokens: string[],
  key: string,
): number | null {
  const index =
    tokens.indexOf(key);

  if (
    index === -1 ||
    index + 1 >= tokens.length
  ) {
    return null;
  }

  const value = Number(
    tokens[index + 1],
  );

  return Number.isInteger(value)
    ? value
    : null;
}

function isValidUciMove(
  value: string,
): boolean {
  return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(
    value,
  );
}

function normalizeMessage(
  message: StockfishMessageEvent,
): string | null {
  if (typeof message === "string") {
    return message.trim();
  }

  if (
    message &&
    typeof message.data === "string"
  ) {
    return message.data.trim();
  }

  return null;
}

function postError(
  requestId: string | undefined,
  error: unknown,
): void {
  const message =
    error instanceof Error
      ? error.message
      : "Stockfish analysis failed";

  postMessage({
    type: "error",
    ...(requestId
      ? { requestId }
      : {}),
    message,
  } satisfies EngineErrorMessage);
}

export {};
