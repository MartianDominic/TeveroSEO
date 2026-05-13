/**
 * Topical Map Layout
 * Phase 98-06: React Flow layout calculation using Dagre
 *
 * Computes node positions for keyword clusters and calculates edge weights
 * based on semantic similarity (keyword overlap).
 */

import dagre from 'dagre';
import type { Node, Edge } from '@xyflow/react';
import type { TopicalCluster } from './types';

interface LayoutOptions {
  direction?: 'TB' | 'LR';
  nodeWidth?: number;
  nodeHeight?: number;
  rankSep?: number;
  nodeSep?: number;
}

interface ClusterNode extends Node {
  data: {
    cluster: TopicalCluster;
    volume: number;
    keywordCount: number;
  };
}

interface ClusterEdge extends Edge {
  data?: {
    similarity: number;
  };
}

/**
 * Calculate Dagre layout for topical clusters.
 *
 * @param clusters - Topical clusters to layout
 * @param edges - Similarity edges between clusters
 * @param options - Layout configuration
 * @returns Positioned nodes and styled edges for React Flow
 */
export function calculateLayout(
  clusters: TopicalCluster[],
  edges: Array<{ source: string; target: string; similarity: number }>,
  options: LayoutOptions = {}
): { nodes: ClusterNode[]; edges: ClusterEdge[] } {
  const {
    direction = 'TB',
    nodeWidth = 180,
    nodeHeight = 60,
    rankSep = 80,
    nodeSep = 40,
  } = options;

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: direction, ranksep: rankSep, nodesep: nodeSep });
  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes
  clusters.forEach((cluster) => {
    g.setNode(cluster.id, { width: nodeWidth, height: nodeHeight });
  });

  // Add edges
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  // Calculate layout
  dagre.layout(g);

  // Extract positioned nodes
  const nodes: ClusterNode[] = clusters.map((cluster) => {
    const node = g.node(cluster.id);
    return {
      id: cluster.id,
      position: {
        x: node.x - nodeWidth / 2,
        y: node.y - nodeHeight / 2,
      },
      data: {
        cluster,
        volume: cluster.volume,
        keywordCount: cluster.keywords.length,
      },
      type: 'clusterNode',
    };
  });

  // Extract edges with similarity for styling per D-05
  const layoutEdges: ClusterEdge[] = edges.map((edge, idx) => ({
    id: `e-${idx}`,
    source: edge.source,
    target: edge.target,
    data: { similarity: edge.similarity },
    style: {
      strokeWidth: getEdgeWidth(edge.similarity), // per D-05
      stroke: '#94a3b8', // slate-400
    },
    animated: edge.similarity > 0.7,
  }));

  return { nodes, edges: layoutEdges };
}

/**
 * Per D-05: Edge thickness reflects cluster similarity.
 *
 * @param similarity - Jaccard similarity score (0-1)
 * @returns Edge width in pixels
 */
function getEdgeWidth(similarity: number): number {
  if (similarity >= 0.8) return 4;
  if (similarity >= 0.6) return 3;
  if (similarity >= 0.4) return 2;
  return 1;
}

/**
 * Calculate similarity between clusters based on shared keywords.
 *
 * Uses Jaccard similarity: |A ∩ B| / |A ∪ B|
 *
 * @param clusters - Topical clusters to analyze
 * @returns Similarity edges (only > 0.1 threshold)
 */
export function calculateClusterSimilarity(
  clusters: TopicalCluster[]
): Array<{ source: string; target: string; similarity: number }> {
  const edges: Array<{ source: string; target: string; similarity: number }> = [];

  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      const a = clusters[i];
      const b = clusters[j];

      // Jaccard similarity of keyword sets
      const setA = new Set(a.keywords);
      const setB = new Set(b.keywords);
      const intersection = new Set([...setA].filter((x) => setB.has(x)));
      const union = new Set([...setA, ...setB]);
      const similarity = intersection.size / union.size;

      // Only create edge if similarity above threshold
      if (similarity > 0.1) {
        edges.push({ source: a.id, target: b.id, similarity });
      }
    }
  }

  return edges;
}
