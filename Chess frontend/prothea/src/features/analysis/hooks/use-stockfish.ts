"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AnalysisResult, EngineMove } from "../types/analysis";

type AnalysisOptions = { depth: number; multiPv: number };
type AnalysisState = { result: AnalysisResult | null; isAnalyzing: boolean; error: string | null };
type PendingAnalysis = { fen: string; options: AnalysisOptions };

const ENGINE_URL = "/stockfish/stockfish-19-lite-single.js";
const ENGINE_RESPONSE_TIMEOUT_MS = 20_000;
const UI_UPDATE_INTERVAL_MS = 120;

export function useStockfish() {
  const workerRef = useRef<Worker | null>(null);
  const readyRef = useRef(false);
  const activeRef = useRef<PendingAnalysis | null>(null);
  const pendingRef = useRef<PendingAnalysis | null>(null);
  const startRef = useRef<((request: PendingAnalysis) => void) | null>(null);
  const stoppingRef = useRef(false);
  const linesRef = useRef(new Map<number, EngineMove>());
  const startupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analysisTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uiUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestPartialResultRef = useRef<AnalysisResult | null>(null);
  const lastUiUpdateAtRef = useRef(0);
  const [state, setState] = useState<AnalysisState>({ result: null, isAnalyzing: false, error: null });

  useEffect(() => {
    const worker = new Worker(ENGINE_URL);
    workerRef.current = worker;

    const startAnalysis = (request: PendingAnalysis) => {
      activeRef.current = request;
      linesRef.current.clear();
      latestPartialResultRef.current = null;
      lastUiUpdateAtRef.current = 0;
      if (uiUpdateTimerRef.current) {
        clearTimeout(uiUpdateTimerRef.current);
        uiUpdateTimerRef.current = null;
      }
      if (analysisTimerRef.current) clearTimeout(analysisTimerRef.current);
      analysisTimerRef.current = setTimeout(() => {
        if (activeRef.current !== request || linesRef.current.size > 0) return;
        stoppingRef.current = true;
        worker.postMessage("stop");
        setState({ result: null, isAnalyzing: false, error: "Stockfish did not return an evaluation. Check the engine and WASM assets." });
      }, ENGINE_RESPONSE_TIMEOUT_MS);
      worker.postMessage(`setoption name MultiPV value ${request.options.multiPv}`);
      worker.postMessage("ucinewgame");
      worker.postMessage(`position fen ${request.fen}`);
      worker.postMessage(`go depth ${request.options.depth}`);
    };
    startRef.current = startAnalysis;

    const handleMessage = (event: MessageEvent<unknown>) => {
      if (typeof event.data !== "string") return;
      const line = event.data.trim();

      if (line === "uciok") {
        worker.postMessage("isready");
        return;
      }
      if (line === "readyok") {
        readyRef.current = true;
        if (startupTimerRef.current) clearTimeout(startupTimerRef.current);
        const next = pendingRef.current;
        pendingRef.current = null;
        if (next) startAnalysis(next);
        return;
      }
      if (line.startsWith("info ")) {
        const active = activeRef.current;
        const parsed = parseInfoLine(line, active?.fen ?? "");
        if (active && parsed) {
          if (analysisTimerRef.current) {
            clearTimeout(analysisTimerRef.current);
            analysisTimerRef.current = null;
          }
          linesRef.current.set(parsed.multiPv, parsed.move);
          const partialResult: AnalysisResult = {
            fen: active.fen,
            depth: parsed.move.depth,
            moves: [...linesRef.current.entries()].sort(([a], [b]) => a - b).map(([, move]) => move),
          };
          latestPartialResultRef.current = partialResult;
          const elapsed = Date.now() - lastUiUpdateAtRef.current;
          const publishPartialResult = () => {
            const latest = latestPartialResultRef.current;
            if (!latest || !activeRef.current || pendingRef.current) return;
            lastUiUpdateAtRef.current = Date.now();
            setState({ result: latest, isAnalyzing: true, error: null });
          };
          if (elapsed >= UI_UPDATE_INTERVAL_MS) {
            publishPartialResult();
          } else if (!uiUpdateTimerRef.current) {
            uiUpdateTimerRef.current = setTimeout(() => {
              uiUpdateTimerRef.current = null;
              publishPartialResult();
            }, UI_UPDATE_INTERVAL_MS - elapsed);
          }
        }
        return;
      }
      if (!line.startsWith("bestmove ")) return;
      if (uiUpdateTimerRef.current) {
        clearTimeout(uiUpdateTimerRef.current);
        uiUpdateTimerRef.current = null;
      }
      latestPartialResultRef.current = null;
      if (analysisTimerRef.current) {
        clearTimeout(analysisTimerRef.current);
        analysisTimerRef.current = null;
      }

      if (stoppingRef.current) {
        stoppingRef.current = false;
        activeRef.current = null;
        linesRef.current.clear();
        const next = pendingRef.current;
        pendingRef.current = null;
        if (next) startAnalysis(next);
        return;
      }

      const active = activeRef.current;
      if (!active) return;
      const result: AnalysisResult = {
        fen: active.fen,
        depth: active.options.depth,
        moves: [...linesRef.current.entries()].sort(([a], [b]) => a - b).map(([, move]) => move),
      };
      activeRef.current = null;
      linesRef.current.clear();
      setState({ result, isAnalyzing: false, error: null });
    };

    const handleError = (event: ErrorEvent) => {
      if (startupTimerRef.current) clearTimeout(startupTimerRef.current);
      if (analysisTimerRef.current) clearTimeout(analysisTimerRef.current);
      if (uiUpdateTimerRef.current) clearTimeout(uiUpdateTimerRef.current);
      uiUpdateTimerRef.current = null;
      latestPartialResultRef.current = null;
      setState({ result: null, isAnalyzing: false, error: event.message || "Stockfish failed to load" });
      activeRef.current = null;
      pendingRef.current = null;
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    startupTimerRef.current = setTimeout(() => {
      if (readyRef.current) return;
      setState({ result: null, isAnalyzing: false, error: "Stockfish could not initialize. Check the engine and WASM assets." });
    }, ENGINE_RESPONSE_TIMEOUT_MS);
    worker.postMessage("uci");

    return () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
      worker.terminate();
      if (startupTimerRef.current) clearTimeout(startupTimerRef.current);
      if (analysisTimerRef.current) clearTimeout(analysisTimerRef.current);
      if (uiUpdateTimerRef.current) clearTimeout(uiUpdateTimerRef.current);
      latestPartialResultRef.current = null;
      workerRef.current = null;
      startRef.current = null;
      readyRef.current = false;
      activeRef.current = null;
      pendingRef.current = null;
    };
  }, []);

  const analyze = useCallback((fen: string, options: AnalysisOptions) => {
    const worker = workerRef.current;
    if (!worker) {
      setState({ result: null, isAnalyzing: false, error: "Stockfish is starting" });
      return;
    }

    const request = { fen, options };
    if (uiUpdateTimerRef.current) {
      clearTimeout(uiUpdateTimerRef.current);
      uiUpdateTimerRef.current = null;
    }
    latestPartialResultRef.current = null;
    setState({ result: null, isAnalyzing: true, error: null });
    if (!readyRef.current) {
      pendingRef.current = request;
      return;
    }
    if (activeRef.current || stoppingRef.current) {
      pendingRef.current = request;
      if (analysisTimerRef.current) {
        clearTimeout(analysisTimerRef.current);
        analysisTimerRef.current = null;
      }
      if (!stoppingRef.current) {
        stoppingRef.current = true;
        worker.postMessage("stop");
      }
      return;
    }
    startRef.current?.(request);
  }, []);

  const stop = useCallback(() => {
    pendingRef.current = null;
    if (uiUpdateTimerRef.current) {
      clearTimeout(uiUpdateTimerRef.current);
      uiUpdateTimerRef.current = null;
    }
    latestPartialResultRef.current = null;
    if (activeRef.current && workerRef.current) {
      stoppingRef.current = true;
      workerRef.current.postMessage("stop");
    }
    setState((current) => ({ ...current, isAnalyzing: false }));
  }, []);

  const clear = useCallback(() => {
    setState({ result: null, isAnalyzing: false, error: null });
  }, []);

  return { result: state.result, isAnalyzing: state.isAnalyzing, error: state.error, analyze, stop, clear };
}

function parseInfoLine(line: string, fen: string): { multiPv: number; move: EngineMove } | null {
  const tokens = line.trim().split(/\s+/);
  const depth = readInteger(tokens, "depth");
  const multiPv = readInteger(tokens, "multipv") ?? 1;
  const scoreIndex = tokens.indexOf("score");
  const pvIndex = tokens.indexOf("pv");
  if (depth === null || scoreIndex < 0 || pvIndex < 0 || pvIndex + 1 >= tokens.length) return null;

  const scoreType = tokens[scoreIndex + 1];
  const scoreValue = Number(tokens[scoreIndex + 2]);
  const uci = tokens[pvIndex + 1];
  if (!Number.isFinite(scoreValue) || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return null;

  const whitePerspective = fen.split(" ")[1] === "b" ? -1 : 1;
  return {
    multiPv,
    move: {
      uci,
      san: uci,
      evaluation: scoreType === "cp" ? scoreValue / 100 * whitePerspective : null,
      depth,
      ...(scoreType === "mate" ? { mate: scoreValue * whitePerspective } : {}),
    },
  };
}

function readInteger(tokens: string[], key: string): number | null {
  const index = tokens.indexOf(key);
  if (index < 0 || index + 1 >= tokens.length) return null;
  const value = Number(tokens[index + 1]);
  return Number.isInteger(value) ? value : null;
}
