/**
 * TopicClusterVisualization
 * Phase 96-04: Hub + Spoke SVG visualization
 * UI-04/05/06: Uses design system tokens, error boundary, loading states.
 */
import { useMemo } from "react";
import { Link2, Link2Off } from "lucide-react";
import type { TopicClusterWithPages } from "@/server/features/analytics/types";
import { ChartErrorBoundary } from "@/components/charts/ChartErrorBoundary";
import { Skeleton } from "@/client/components/ui/skeleton";

interface TopicClusterVisualizationProps {
  cluster: TopicClusterWithPages;
  onSpokeClick?: (pageUrl: string) => void;
  width?: number;
  height?: number;
  isLoading?: boolean;
}

/**
 * Loading skeleton for TopicClusterVisualization
 */
function TopicClusterSkeleton({ width = 600, height = 400 }: { width?: number; height?: number }) {
  return (
    <div className="relative animate-pulse">
      <div className="absolute right-4 top-4 flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-6 w-10" />
      </div>
      <div className="flex items-center justify-center" style={{ width, height }}>
        {/* Central hub skeleton */}
        <Skeleton className="h-24 w-24 rounded-full" />
      </div>
      {/* Legend skeleton */}
      <div className="mt-4 flex justify-center gap-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
      {/* Metrics skeleton */}
      <div className="mt-4 grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg bg-muted p-3 text-center">
            <Skeleton className="mx-auto h-3 w-16 mb-2" />
            <Skeleton className="mx-auto h-6 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TopicClusterVisualization({
  cluster,
  onSpokeClick,
  width = 600,
  height = 400,
  isLoading = false,
}: TopicClusterVisualizationProps) {
  const centerX = width / 2;
  const centerY = height / 2;
  const hubRadius = 50;
  const spokeRadius = 30;
  const orbitRadius = Math.min(width, height) / 2 - spokeRadius - 20;

  const spokePositions = useMemo(() => {
    const spokes = cluster.spokePages;
    return spokes.map((spoke, index) => {
      const angle = (2 * Math.PI * index) / spokes.length - Math.PI / 2;
      return {
        ...spoke,
        x: centerX + orbitRadius * Math.cos(angle),
        y: centerY + orbitRadius * Math.sin(angle),
        angle,
      };
    });
  }, [cluster.spokePages, centerX, centerY, orbitRadius]);

  const formatNumber = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  const truncateUrl = (url: string, maxLength: number = 20) => {
    const path = url.replace(/^https?:\/\/[^/]+/, "");
    if (path.length <= maxLength) return path;
    return path.slice(0, maxLength - 3) + "...";
  };

  // Show skeleton while loading
  if (isLoading) {
    return <TopicClusterSkeleton width={width} height={height} />;
  }

  return (
    <ChartErrorBoundary fallbackHeight={height + 200}>
    <div className="relative">
      {/* Coverage indicator */}
      <div className="absolute right-4 top-4 flex items-center gap-2 rounded-lg bg-background/90 px-3 py-2 shadow-sm">
        <div className="text-sm text-muted-foreground">Coverage</div>
        <div
          className={`text-lg font-bold ${
            cluster.coverage >= 80
              ? "text-success"
              : cluster.coverage >= 50
                ? "text-warning"
                : "text-destructive"
          }`}
        >
          {cluster.coverage.toFixed(0)}%
        </div>
      </div>

      <svg width={width} height={height} className="mx-auto">
        {/* Connection lines from spokes to hub */}
        {spokePositions.map((spoke, index) => (
          <g key={`line-${index}`}>
            <line
              x1={centerX}
              y1={centerY}
              x2={spoke.x}
              y2={spoke.y}
              stroke={spoke.linksToHub ? "#22c55e" : "#ef4444"}
              strokeWidth={2}
              strokeDasharray={spoke.linksToHub ? undefined : "5,5"}
              opacity={0.6}
            />
          </g>
        ))}

        {/* Hub circle */}
        <g>
          <circle
            cx={centerX}
            cy={centerY}
            r={hubRadius}
            fill="#6366f1"
            stroke="#4f46e5"
            strokeWidth={3}
            className="drop-shadow-lg"
          />
          <text
            x={centerX}
            y={centerY - 8}
            textAnchor="middle"
            className="fill-white text-sm font-bold"
          >
            HUB
          </text>
          <text
            x={centerX}
            y={centerY + 8}
            textAnchor="middle"
            className="fill-white/80 text-sm"
          >
            {formatNumber(cluster.hubPage.clicks)} clicks
          </text>
        </g>

        {/* Spoke circles */}
        {spokePositions.map((spoke, index) => (
          <g
            key={`spoke-${index}`}
            className="cursor-pointer transition-transform hover:scale-110"
            onClick={() => onSpokeClick?.(spoke.url)}
          >
            <circle
              cx={spoke.x}
              cy={spoke.y}
              r={spokeRadius}
              fill={spoke.linksToHub ? "#dcfce7" : "#fee2e2"}
              stroke={spoke.linksToHub ? "#22c55e" : "#ef4444"}
              strokeWidth={2}
            />
            {/* Link icon */}
            <foreignObject
              x={spoke.x - 8}
              y={spoke.y - 8}
              width={16}
              height={16}
            >
              {spoke.linksToHub ? (
                <Link2 className="h-4 w-4 text-success" />
              ) : (
                <Link2Off className="h-4 w-4 text-destructive" />
              )}
            </foreignObject>
          </g>
        ))}

        {/* Spoke labels */}
        {spokePositions.map((spoke, index) => {
          const labelOffset = 45;
          const labelX =
            spoke.x + labelOffset * Math.cos(spoke.angle) * (spoke.x > centerX ? 1 : 1);
          const labelY = spoke.y + labelOffset * Math.sin(spoke.angle);
          const textAnchor = spoke.x > centerX ? "start" : "end";

          return (
            <text
              key={`label-${index}`}
              x={labelX}
              y={labelY}
              textAnchor={textAnchor}
              className="fill-muted-foreground text-sm"
            >
              {truncateUrl(spoke.url)}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="mt-4 flex justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-success" />
          <span className="text-muted-foreground">Links to hub</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-destructive" />
          <span className="text-muted-foreground">Missing link</span>
        </div>
      </div>

      {/* Cluster metrics */}
      <div className="mt-4 grid grid-cols-3 gap-4 text-center">
        <div className="rounded-lg bg-muted p-3">
          <p className="text-sm text-muted-foreground">Total Clicks</p>
          <p className="text-xl font-bold text-foreground">
            {formatNumber(cluster.totalClicks)}
          </p>
        </div>
        <div className="rounded-lg bg-muted p-3">
          <p className="text-sm text-muted-foreground">Impressions</p>
          <p className="text-xl font-bold text-foreground">
            {formatNumber(cluster.totalImpressions)}
          </p>
        </div>
        <div className="rounded-lg bg-muted p-3">
          <p className="text-sm text-muted-foreground">Avg Position</p>
          <p className="text-xl font-bold text-foreground">
            {cluster.avgPosition.toFixed(1)}
          </p>
        </div>
      </div>

      {/* Content gaps */}
      {cluster.gaps.length > 0 && (
        <div className="mt-4 rounded-lg border border-warning/30 bg-warning/10 p-4">
          <h4 className="mb-2 font-medium text-warning">
            Content Gaps ({cluster.gaps.length})
          </h4>
          <ul className="space-y-1">
            {cluster.gaps.slice(0, 5).map((gap, index) => (
              <li
                key={index}
                className="text-sm text-warning/80"
              >
                - {gap}
              </li>
            ))}
            {cluster.gaps.length > 5 && (
              <li className="text-sm text-warning/60">
                +{cluster.gaps.length - 5} more gaps
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
    </ChartErrorBoundary>
  );
}
