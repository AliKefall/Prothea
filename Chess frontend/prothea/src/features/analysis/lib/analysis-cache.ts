import { AnalysisResult } from "../types/analysis";

export type AnalysisCacheOptions = {
  engineVersion: string;
  depth: number;
  multiPv: number;
};

export type AnalysisCacheKey = string;

const cache = new Map<AnalysisCacheKey, AnalysisResult>();

function normalizeFen(fen: string): string {
  return fen.trim().replace(/\s+/g, " ");
}

export function createAnalysisCacheKey(
  fen: string,
  options: AnalysisCacheOptions,
): AnalysisCacheKey {
  return [
    normalizeFen(fen),
    options.engineVersion,
    `depth:${options.depth}`,
    `multipv:${options.multiPv}`,
  ].join("|");
}

export function getCachedAnalysis(
  fen: string,
  options: AnalysisCacheOptions,
): AnalysisResult | null {
  const key = createAnalysisCacheKey(fen, options);
  return cache.get(key) ?? null;
}

export function setCachedAnalysis(
  fen: string,
  options: AnalysisCacheOptions,
  result: AnalysisResult,
): void {
  const key = createAnalysisCacheKey(fen, options);

  cache.set(key, result);
}

export function hasCachedAnalysiz(
    fen: string,
    options: AnalysisCacheOptions,
): boolean {
    const key = createAnalysisCacheKey(fen, options)
    return cache.has(key)
}

export function clearAnalysisCache(): void {
  cache.clear();
}

export function deleteCachedAnalysis(
  fen: string,
  options: AnalysisCacheOptions,
): boolean {
  const key = createAnalysisCacheKey(fen, options);

  return cache.delete(key);
}

export function getAnalysisCacheSize(): number {
  return cache.size;
}
