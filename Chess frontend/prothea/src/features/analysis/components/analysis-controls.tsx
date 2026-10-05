"use client";

import { useCallback } from "react";

import type { AnalysisNode } from "../types/analysis";

type AnalysisControlsProps = {
  currentNode: AnalysisNode;
  parentNode: AnalysisNode | null;
  hasChildren: boolean;
  isAnalyzing: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onAnalyze: () => void;
  onStop: () => void;
};

export function AnalysisControls({
  currentNode,
  parentNode,
  hasChildren,
  isAnalyzing,
  onPrevious,
  onNext,
  onAnalyze,
  onStop,
}: AnalysisControlsProps) {
  const handlePrevious = useCallback(() => {
    if (!parentNode) {
      return;
    }

    onPrevious();
  }, [parentNode, onPrevious]);

  const handleNext = useCallback(() => {
    if (!hasChildren) {
      return;
    }

    onNext();
  }, [hasChildren, onNext]);

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handlePrevious}
          disabled={!parentNode}
          className="rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>

        <button
          type="button"
          onClick={handleNext}
          disabled={!hasChildren}
          className="rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>

      <div className="flex items-center gap-2">
        {isAnalyzing ? (
          <button
            type="button"
            onClick={onStop}
            className="rounded-md border px-3 py-2 text-sm"
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={onAnalyze}
            className="rounded-md border px-3 py-2 text-sm"
          >
            Analyze
          </button>
        )}
      </div>

      <span className="sr-only">
        Current node: {currentNode.id}
      </span>
    </div>
  );
}
