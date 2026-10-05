import type {
  AnalysisMove,
  OpeningInfo,
} from "../types/analysis";

export type OpeningDefinition = OpeningInfo & {
  moves: string[];
};

function isPrefix(
  moves: string[],
  definition: string[],
): boolean {
  if (moves.length < definition.length) {
    return false;
  }

  return definition.every(
    (move, index) => moves[index] === move,
  );
}

export function detectOpening(
  moves: AnalysisMove[],
  definitions: OpeningDefinition[],
): OpeningInfo | null {
  if (moves.length === 0 || definitions.length === 0) {
    return null;
  }

  const moveSequence = moves.map(
    (move) => move.uci,
  );

  let bestMatch: OpeningDefinition | null = null;

  for (const opening of definitions) {
    if (!isPrefix(moveSequence, opening.moves)) {
      continue;
    }

    if (
      !bestMatch ||
      opening.moves.length >
        bestMatch.moves.length
    ) {
      bestMatch = opening;
    }
  }

  if (!bestMatch) {
    return null;
  }

  return {
    eco: bestMatch.eco,
    name: bestMatch.name,
    ...(bestMatch.variation
      ? { variation: bestMatch.variation }
      : {}),
  };
}
