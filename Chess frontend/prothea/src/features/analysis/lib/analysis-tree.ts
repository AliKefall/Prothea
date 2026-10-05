import { AnalysisNode, AnalysisNodeId, AnalysisTree } from "../types/analysis";

function createNodeId(): AnalysisNodeId {
  return crypto.randomUUID();
}

// Finally learning trees gives their fruit. (sob, sob...)

export function createAnalysisTree(initialFen: string): AnalysisTree {
  const rootId = createNodeId();

  const root: AnalysisNode = {
    id: rootId,
    parentId: null,
    fen: initialFen,
    move: null,
    children: [],
    analysis: null,
  };

  return {
    rootId,
    nodes: {
      [rootId]: root,
    },
    currentNodeId: rootId,
  };
}

export function getNode(
  tree: AnalysisTree,
  nodeId: AnalysisNodeId,
): AnalysisNode | null {
  return tree.nodes[nodeId] ?? null;
}

export function getCurrentNode(tree: AnalysisTree): AnalysisNode {
  return tree.nodes[tree.currentNodeId];
}

export function getChildren(
  tree: AnalysisTree,
  nodeId: AnalysisNodeId,
): AnalysisNode[] {
  const node = tree.nodes[nodeId];

  if (!node) {
    return [];
  }

  return node.children
    .map((childId) => tree.nodes[childId])
    .filter((child): child is AnalysisNode => child !== undefined);
}

export function addNode(
  tree: AnalysisTree,
  parentId: AnalysisNodeId,
  node: Omit<AnalysisNode, "id" | "parentId" | "children">,
): AnalysisTree {
  const parent = tree.nodes[parentId];

  if (!parent) {
    return tree;
  }

  const nodeId = createNodeId();

  const newNode: AnalysisNode = {
    ...node,
    id: nodeId,
    parentId,
    children: [],
  };

  return {
    ...tree,
    nodes: {
      ...tree.nodes,
      [nodeId]: newNode,
      [parentId]: {
        ...parent,
        children: [...parent.children, nodeId],
      },
    },

    currentNodeId: nodeId,
  };
}

export function setCurrentNode(
  tree: AnalysisTree,
  nodeId: AnalysisNodeId,
): AnalysisTree {
  if (!tree.nodes[nodeId]) {
    return tree;
  }

  return {
    ...tree,
    currentNodeId: nodeId,
  };
}

export function setNodeAnalysis(
  tree: AnalysisTree,
  nodeId: AnalysisNodeId,
  analysis: AnalysisNode["analysis"],
): AnalysisTree {
  const node = tree.nodes[nodeId];

  if (!node) {
    return tree;
  }

  return {
    ...tree,
    nodes: {
      ...tree.nodes,
      [nodeId]: {
        ...node,
        analysis,
      },
    },
  };
}

export function getParent(
  tree: AnalysisTree,
  nodeId: AnalysisNodeId,
): AnalysisNode | null {
  const node = tree.nodes[nodeId];

  if (!node?.parentId) {
    return null;
  }

  return tree.nodes[node.parentId] ?? null;
}

export function getPathToNode(
  tree: AnalysisTree,
  nodeId: AnalysisNodeId,
): AnalysisNode[] {
  const path: AnalysisNode[] = [];
  let current = tree.nodes[nodeId];

  while (current) {
    path.unshift(current);

    if (!current.parentId) {
      break;
    }

    current = tree.nodes[current.parentId];
  }
  return path;
}
