"use client";

import { useCallback, useState } from "react";

import {
  addNode,
  createAnalysisTree,
  getChildren,
  getCurrentNode,
  getNode,
  getParent,
  getPathToNode,
  setCurrentNode,
  setNodeAnalysis,
} from "../lib/analysis-tree";
import type {
  AnalysisMove,
  AnalysisNode,
  AnalysisNodeId,
  AnalysisResult,
  AnalysisTree,
} from "../types/analysis";

export function useAnalysisTree(initialFen: string) {
  const [tree, setTree] = useState<AnalysisTree>(() =>
    createAnalysisTree(initialFen),
  );

  const currentNode = getCurrentNode(tree);

  const addVariation = useCallback(
    (
      parentId: AnalysisNodeId,
      fen: string,
      move: AnalysisMove,
    ) => {
      setTree((current) =>
        addNode(current, parentId, {
          fen,
          move,
          analysis: null,
        }),
      );
    },
    [],
  );

  const selectNode = useCallback(
    (nodeId: AnalysisNodeId) => {
      setTree((current) =>
        setCurrentNode(current, nodeId),
      );
    },
    [],
  );

  const setAnalysis = useCallback(
    (
      nodeId: AnalysisNodeId,
      analysis: AnalysisResult,
    ) => {
      setTree((current) =>
        setNodeAnalysis(
          current,
          nodeId,
          analysis,
        ),
      );
    },
    [],
  );

  const getTreeNode = useCallback(
    (nodeId: AnalysisNodeId): AnalysisNode | null => {
      return getNode(tree, nodeId);
    },
    [tree],
  );

  const getNodeChildren = useCallback(
    (nodeId: AnalysisNodeId): AnalysisNode[] => {
      return getChildren(tree, nodeId);
    },
    [tree],
  );

  const getNodeParent = useCallback(
    (nodeId: AnalysisNodeId): AnalysisNode | null => {
      return getParent(tree, nodeId);
    },
    [tree],
  );

  const getNodePath = useCallback(
    (nodeId: AnalysisNodeId): AnalysisNode[] => {
      return getPathToNode(tree, nodeId);
    },
    [tree],
  );

  const reset = useCallback(() => {
    setTree(createAnalysisTree(initialFen));
  }, [initialFen]);

  return {
    tree,
    currentNode,
    currentNodeId: tree.currentNodeId,
    addVariation,
    selectNode,
    setAnalysis,
    getNode: getTreeNode,
    getChildren: getNodeChildren,
    getParent: getNodeParent,
    getPath: getNodePath,
    reset,
  };
}
