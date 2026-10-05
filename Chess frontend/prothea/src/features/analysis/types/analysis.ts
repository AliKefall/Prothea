export type AnalysisNodeId = string;

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
    evaluation: string;
    depth: number;
    mate?: number;
}

export type AnalysisResult = {
    fen: string;
    moves: EngineMove[];
    depth: number;
}

export type AnalysisNode = {
    id: AnalysisNodeId;
    parentId: AnalysisNodeId | null;
    fen: string;
    move: AnalysisMove | null;
    children: AnalysisNodeId[];
    analysis: AnalysisResult | null;
}

export type AnalysisTree = {
    rootId: AnalysisNodeId;
    nodes: Record<AnalysisNodeId, AnalysisNode>;
    currentNodeId: AnalysisNodeId;
}

export type OpeningInfo = {
    name: string;
    variation?: string;
    eco?: string;
}
