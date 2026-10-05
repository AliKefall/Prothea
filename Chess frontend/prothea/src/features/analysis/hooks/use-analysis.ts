"use client";

import { useCallback, useEffect, useRef } from "react";

import {
  getCachedAnalysis,
  setCachedAnalysis,
  type AnalysisCacheOptions,
} from "../lib/analysis-cache";
import { createMove } from "../lib/position";
import { useAnalysisTree } from "./use-analysis-tree";
import { useStockfish } from "./use-stockfish";
import type {
  AnalysisMove,
  AnalysisResult,
} from "../types/analysis";

const ENGINE_VERSION = "stockfish-19";
const DEFAULT_DEPTH = 18;
const DEFAULT_MULTI_PV = 3;

const CACHE_OPTIONS: AnalysisCacheOptions = {
  engineVersion: ENGINE_VERSION,
  depth: DEFAULT_DEPTH,
  multiPv: DEFAULT_MULTI_PV,
};

export function useAnalysis(initialFen: string) {
  const treeState = useAnalysisTree(initialFen);
  const stockfish = useStockfish();

  const analysisRequestRef = useRef<string | null>(null);

  const currentFen = treeState.currentNode.fen;

  const analyzeCurrentPosition = useCallback(() => {
    const cached = getCachedAnalysis(
      currentFen,
      CACHE_OPTIONS,
    );

    if (cached) {
      treeState.setAnalysis(
        treeState.currentNodeId,
        cached,
      );

      return;
    }

    const requestId = crypto.randomUUID();

    analysisRequestRef.current = requestId;

    stockfish.analyze(
      currentFen,
      {
        depth: DEFAULT_DEPTH,
        multiPv: DEFAULT_MULTI_PV,
      },
    );
  }, [
    currentFen,
    treeState.currentNode,
    treeState.currentNodeId,
    treeState.setAnalysis,
    stockfish.analyze,
  ]);

  useEffect(() => {
    if (!stockfish.result) {
      return;
    }

    const result = stockfish.result;

    if (result.fen !== treeState.currentNode.fen) {
      return;
    }

    setCachedAnalysis(
      result.fen,
      CACHE_OPTIONS,
      result,
    );

    treeState.setAnalysis(
      treeState.currentNodeId,
      result,
    );

    analysisRequestRef.current = null;
  }, [
    stockfish.result,
    treeState.currentNode,
    treeState.currentNodeId,
    treeState.setAnalysis,
  ]);

  const playMove = useCallback(
    (move: AnalysisMove) => {
      const nextNode = createMove(
        treeState.currentNode.fen,
        move.from,
        move.to,
        move.promotion,
      );

      if (!nextNode) {
        return false;
      }

      const nextFen = createMove(
        treeState.currentNode.fen,
        move.from,
        move.to,
        move.promotion,
      );

      if (!nextFen) {
        return false;
      }

      treeState.addVariation(
        treeState.currentNodeId,
        nextFen,
        nextNode,
      );

      return true;
    },
    [
      treeState.currentNode,
      treeState.currentNodeId,
      treeState.addVariation,
    ],
  );

  const selectNode = useCallback(
    (nodeId: string) => {
      stockfish.stop();
      treeState.selectNode(nodeId);
    },
    [stockfish.stop, treeState.selectNode],
  );

  const reset = useCallback(() => {
    stockfish.stop();
    treeState.reset();
  }, [stockfish.stop, treeState.reset]);

  return {
    tree: treeState.tree,
    currentNode: treeState.currentNode,
    currentFen,

    result: treeState.currentNode.analysis,

    isAnalyzing: stockfish.isAnalyzing,
    error: stockfish.error,

    analyzeCurrentPosition,
    playMove,
    selectNode,
    reset,
  };
}
