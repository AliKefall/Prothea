export type AnalysisMove = {
    from: string;
    to: string;
    san: string;
    uci: string;
    promotion?: string;
}

export type EngineMove = {
    uci: string;
    san: string;
    evaluation: number | null;
    depth: number;
    mate?: number;
}

export type AnalysisResult = {
    fen: string;
    moves: EngineMove[];
    depth: number;
}
