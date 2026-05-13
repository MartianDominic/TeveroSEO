/**
 * Topical Map View
 * Phase 98-06: React Flow visualization of keyword clusters
 *
 * Displays topical clusters as interactive nodes with semantic edge weights.
 * Per D-04: BOFU=green, MOFU=amber, TOFU=blue.
 * Per D-05: Edge thickness reflects cluster similarity.
 */

'use client';

import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type NodeProps,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { TopicalCluster } from '@/lib/seo-chat/types';
import {
  calculateLayout,
  calculateClusterSimilarity,
} from '@/lib/seo-chat/topical-map-layout';

interface TopicalMapViewProps {
  clusters: TopicalCluster[];
  onClusterClick?: (cluster: TopicalCluster) => void;
}

/**
 * Custom node component for clusters.
 *
 * Displays cluster name, funnel badge, keyword count, and volume.
 * Per D-04: Funnel-specific border colors.
 */
function ClusterNode({ data }: NodeProps) {
  const { cluster, volume, keywordCount } = data as {
    cluster: TopicalCluster;
    volume: number;
    keywordCount: number;
  };

  return (
    <>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Card
        className={`w-44 cursor-pointer transition-shadow hover:shadow-md ${getFunnelBorderColor(cluster.funnel)}`}
      >
        <CardContent className="p-3">
          <p className="font-medium text-sm truncate">{cluster.name}</p>
          <div className="flex items-center justify-between mt-1.5">
            <Badge
              variant="outline"
              className={`text-xs ${getFunnelColor(cluster.funnel)}`}
            >
              {cluster.funnel.toUpperCase()}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {keywordCount} kw
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {formatVolume(volume)} vol
          </p>
        </CardContent>
      </Card>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </>
  );
}

/**
 * Per D-04: BOFU=green, MOFU=amber, TOFU=blue.
 */
function getFunnelColor(funnel: string): string {
  switch (funnel) {
    case 'bofu':
      return 'border-green-500 text-green-600 bg-green-50 dark:bg-green-950/30';
    case 'mofu':
      return 'border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/30';
    case 'tofu':
      return 'border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/30';
    default:
      return '';
  }
}

function getFunnelBorderColor(funnel: string): string {
  switch (funnel) {
    case 'bofu':
      return 'border-l-4 border-l-green-500';
    case 'mofu':
      return 'border-l-4 border-l-amber-500';
    case 'tofu':
      return 'border-l-4 border-l-blue-500';
    default:
      return '';
  }
}

function formatVolume(vol: number): string {
  if (vol >= 1000000) return `${(vol / 1000000).toFixed(1)}M`;
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}K`;
  return vol.toString();
}

const nodeTypes = { clusterNode: ClusterNode };

/**
 * Topical Map View - React Flow visualization.
 *
 * Renders keyword clusters as interactive nodes with semantic edges.
 * Uses Dagre for hierarchical layout and onlyRenderVisibleElements for performance.
 *
 * @param clusters - Topical clusters to visualize
 * @param onClusterClick - Callback when user clicks a cluster node
 */
export function TopicalMapView({
  clusters,
  onClusterClick,
}: TopicalMapViewProps) {
  // Calculate edges based on cluster similarity
  const edges = useMemo(() => calculateClusterSimilarity(clusters), [clusters]);

  // Calculate layout
  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
    () => calculateLayout(clusters, edges),
    [clusters, edges]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edgeState, setEdges, onEdgesChange] = useEdgesState(layoutEdges);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const cluster = clusters.find((c) => c.id === node.id);
      if (cluster && onClusterClick) {
        onClusterClick(cluster);
      }
    },
    [clusters, onClusterClick]
  );

  if (clusters.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>No clusters to display. Run keyword analysis first.</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edgeState}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        // Per RESEARCH.md: onlyRenderVisibleElements for 400+ nodes
        onlyRenderVisibleElements={clusters.length > 50}
        minZoom={0.1}
        maxZoom={2}
      >
        <Background color="#e2e8f0" gap={16} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const cluster = node.data?.cluster as TopicalCluster | undefined;
            if (!cluster) return '#94a3b8';
            switch (cluster.funnel) {
              case 'bofu':
                return '#22c55e'; // green-500
              case 'mofu':
                return '#f59e0b'; // amber-500
              case 'tofu':
                return '#3b82f6'; // blue-500
              default:
                return '#94a3b8';
            }
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
      </ReactFlow>
    </div>
  );
}
