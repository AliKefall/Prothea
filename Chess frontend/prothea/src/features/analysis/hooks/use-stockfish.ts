"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AnalysisResult } from "../types/analysis";

type AnalysisOptions = {
  depth: number;
  multiPv: number;
};

type AnalysisState = {
  result: AnalysisResult | null;
  isAnalyzing: boolean;
  error: string | null;
};

type WorkerReadyMessage = {
  type: "ready";
};

type WorkerResultMessage = {
  type: "result";
  requestId: string;
  result: AnalysisResult;
};

type WorkerErrorMessage = {
  type: "error";
  requestId?: string;
  message: string;
};

type WorkerMessage =
  | WorkerReadyMessage
  | WorkerResultMessage
  | WorkerErrorMessage;

function createRequestId(): string {
  return crypto.randomUUID();
}

export function useStockfish() {
  const workerRef = useRef<Worker | null>(null);
  const activeRequestRef = useRef<string | null>(null);

  const [state, setState] = useState<AnalysisState>({
    result: null,
    isAnalyzing: false,
    error: null,
  });

  useEffect(() => {
    const worker = new Worker(
      new URL(
        "../workers/stockfish-worker.ts",
        import.meta.url,
      ),
    );

    workerRef.current = worker;

    const handleMessage = (
      event: MessageEvent<WorkerMessage>,
    ) => {
      const message = event.data;

      switch (message.type) {
        case "ready":
          return;

        case "result": {
          if (
            message.requestId !==
            activeRequestRef.current
          ) {
            return;
          }

          setState({
            result: message.result,
            isAnalyzing: false,
            error: null,
          });

          activeRequestRef.current = null;

          return;
        }

        case "error": {
          if (
            message.requestId !== undefined &&
            message.requestId !==
              activeRequestRef.current
          ) {
            return;
          }

          setState({
            result: null,
            isAnalyzing: false,
            error: message.message,
          });

          activeRequestRef.current = null;

          return;
        }
      }
    };

    worker.addEventListener(
      "message",
      handleMessage,
    );

    worker.addEventListener(
      "error",
      handleWorkerError,
    );

    return () => {
      worker.terminate();
      workerRef.current = null;
      activeRequestRef.current = null;
    };
  }, []);

  const analyze = useCallback(
    (fen: string, options: AnalysisOptions) => {
      const worker = workerRef.current;

      if (!worker) {
        setState((current) => ({
          ...current,
          error: "Stockfish worker is not available",
        }));

        return;
      }

      const requestId = createRequestId();

      activeRequestRef.current = requestId;

      setState({
        result: null,
        isAnalyzing: true,
        error: null,
      });

      worker.postMessage({
        type: "analyze",
        requestId,
        fen,
        depth: options.depth,
        multiPv: options.multiPv,
      });
    },
    [],
  );

  const stop = useCallback(() => {
    const worker = workerRef.current;

    if (!worker) {
      return;
    }

    const requestId = activeRequestRef.current;

    worker.postMessage({
      type: "stop",
      requestId,
    });

    activeRequestRef.current = null;

    setState((current) => ({
      ...current,
      isAnalyzing: false,
    }));
  }, []);

  const clear = useCallback(() => {
    setState({
      result: null,
      isAnalyzing: false,
      error: null,
    });
  }, []);

  return {
    result: state.result,
    isAnalyzing: state.isAnalyzing,
    error: state.error,
    analyze,
    stop,
    clear,
  };
}

function handleWorkerError(): void {
  /*
   * Worker errors are handled by the hook state through
   * the worker error event.
   */
}
