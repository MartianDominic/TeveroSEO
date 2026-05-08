/**
 * TopicClusterVisualization
 * Phase 96-04: Hub + Spoke SVG visualization
 * WCAG 2.1 AA compliant: role="img", aria-label, hidden data table
 */
import { useMemo } from "react";
import { Link2, Link2Off, ExternalLink, Check, X } from "lucide-react";
import type { TopicClusterWithPages } from "@/server/features/analytics/types";

interface TopicClusterVisualizationProps {
  cluster: TopicClusterWithPages;
  onSpokeClick?: (pageUrl: string) => void;
  width?: number;
  height?: number;
}

export function TopicClusterVisualization({
  cluster,
  onSpokeClick,
  width = 600,
  height = 400,
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

  // Calculate linked/unlinked counts for accessibility description
  const linkedCount = cluster.spokePages.filter((s) => s.linksToHub).length;
  const unlinkedCount = cluster.spokePages.length - linkedCount;

  // Generate accessible description for screen readers
  const generateClusterDescription = () => {
    const spokeDescriptions = cluster.spokePages
      .map((spoke) => `${truncateUrl(spoke.url, 50)}: ${spoke.linksToHub ? "linked" : "needs link"}`)
      .join("; ");
    return `Hub page has ${cluster.hubPage.clicks} clicks. Spoke pages: ${spokeDescriptions}. Content gaps identified: ${cluster.gaps.length}.`;
  };

  return (
    <div className="relative">
      {/* Coverage indicator */}
      <div className="absolute right-4 top-4 flex items-center gap-2 rounded-lg bg-white/90 px-3 py-2 shadow-sm dark:bg-gray-800/90">
        <div className="text-sm text-gray-600 dark:text-gray-300">Coverage</div>
        <div
          className={`text-lg font-bold ${
            cluster.coverage >= 80
              ? "text-green-600"
              : cluster.coverage >= 50
                ? "text-yellow-600"
                : "text-red-600"
          }`}
        >
          {cluster.coverage.toFixed(0)}%
        </div>
      </div>

      <svg
        width={width}
        height={height}
        className="mx-auto"
        role="img"
        aria-label={`Topic cluster visualization showing ${cluster.hubPage.url} as hub with ${cluster.spokePages.length} related pages. ${linkedCount} pages are linked, ${unlinkedCount} need links. Coverage: ${cluster.coverage.toFixed(0)}%.`}
      >
        <title>Topic cluster: {cluster.hubPage.url}</title>
        <desc>{generateClusterDescription()}</desc>
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
            className="fill-white text-xs font-bold"
          >
            HUB
          </text>
          <text
            x={centerX}
            y={centerY + 8}
            textAnchor="middle"
            className="fill-white/80 text-[10px]"
          >
            {formatNumber(cluster.hubPage.clicks)} clicks
          </text>
        </g>

        {/* Spoke circles with accessible status indicators */}
        {spokePositions.map((spoke, index) => (
          <g
            key={`spoke-${index}`}
            className="cursor-pointer transition-transform hover:scale-110 focus-visible:outline-none"
            onClick={() => onSpokeClick?.(spoke.url)}
            role="button"
            tabIndex={0}
            aria-label={`${truncateUrl(spoke.url)}: ${spoke.linksToHub ? "linked to hub" : "needs link to hub"}`}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSpokeClick?.(spoke.url);
              }
            }}
          >
            <circle
              cx={spoke.x}
              cy={spoke.y}
              r={spokeRadius}
              fill={spoke.linksToHub ? "#dcfce7" : "#fee2e2"}
              stroke={spoke.linksToHub ? "#22c55e" : "#ef4444"}
              strokeWidth={2}
              strokeDasharray={spoke.linksToHub ? undefined : "4,2"}
            />
            {/* Focus ring */}
            <circle
              cx={spoke.x}
              cy={spoke.y}
              r={spokeRadius + 4}
              fill="none"
              stroke="transparent"
              strokeWidth={2}
              className="group-focus-visible:stroke-indigo-500"
            />
            {/* Link icon with checkmark/X for non-color indication */}
            <foreignObject
              x={spoke.x - 8}
              y={spoke.y - 8}
              width={16}
              height={16}
            >
              {spoke.linksToHub ? (
                <Link2 className="h-4 w-4 text-green-600" aria-hidden="true" />
              ) : (
                <Link2Off className="h-4 w-4 text-red-500" aria-hidden="true" />
              )}
            </foreignObject>
            {/* Secondary status indicator: checkmark or X mark for colorblind users */}
            <g transform={`translate(${spoke.x + spokeRadius - 8}, ${spoke.y - spokeRadius - 4})`}>
              {spoke.linksToHub ? (
                <g aria-hidden="true">
                  <circle cx={6} cy={6} r={8} fill="#22c55e" />
                  <path d="M3 6l2 2 4-4" stroke="white" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </g>
              ) : (
                <g aria-hidden="true">
                  <circle cx={6} cy={6} r={8} fill="#ef4444" />
                  <path d="M3 3l6 6M9 3l-6 6" stroke="white" strokeWidth={2} fill="none" strokeLinecap="round" />
                </g>
              )}
            </g>
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
              className="fill-gray-600 text-[10px] dark:fill-gray-300"
            >
              {truncateUrl(spoke.url)}
            </text>
          );
        })}
      </svg>

      {/* Visually hidden data table for screen readers */}
      <div className="sr-only">
        <table>
          <caption>Topic cluster data for {cluster.hubPage.url}</caption>
          <thead>
            <tr>
              <th scope="col">Page URL</th>
              <th scope="col">Type</th>
              <th scope="col">Link Status</th>
              <th scope="col">Clicks</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{cluster.hubPage.url}</td>
              <td>Hub</td>
              <td>N/A</td>
              <td>{cluster.hubPage.clicks}</td>
            </tr>
            {cluster.spokePages.map((spoke) => (
              <tr key={spoke.url}>
                <td>{spoke.url}</td>
                <td>Spoke</td>
                <td>{spoke.linksToHub ? "Linked to hub" : "Needs link"}</td>
                <td>{spoke.clicks || "N/A"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Summary: {linkedCount} of {cluster.spokePages.length} spoke pages link to the hub.
          Coverage: {cluster.coverage.toFixed(0)}%.
          {cluster.gaps.length > 0 && ` Content gaps identified: ${cluster.gaps.join(", ")}.`}
        </p>
      </div>

      {/* Legend with icons for colorblind accessibility */}
      <div className="mt-4 flex justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500">
            <Check className="h-3 w-3 text-white" aria-hidden="true" />
          </div>
          <span className="text-gray-600 dark:text-gray-300">Links to hub (solid line)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500">
            <X className="h-3 w-3 text-white" aria-hidden="true" />
          </div>
          <span className="text-gray-600 dark:text-gray-300">Missing link (dashed line)</span>
        </div>
      </div>

      {/* Cluster metrics */}
      <div className="mt-4 grid grid-cols-3 gap-4 text-center">
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Clicks</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {formatNumber(cluster.totalClicks)}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
          <p className="text-xs text-gray-500 dark:text-gray-400">Impressions</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {formatNumber(cluster.totalImpressions)}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
          <p className="text-xs text-gray-500 dark:text-gray-400">Avg Position</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {cluster.avgPosition.toFixed(1)}
          </p>
        </div>
      </div>

      {/* Content gaps */}
      {cluster.gaps.length > 0 && (
        <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900/50 dark:bg-yellow-900/20">
          <h4 className="mb-2 font-medium text-yellow-800 dark:text-yellow-200">
            Content Gaps ({cluster.gaps.length})
          </h4>
          <ul className="space-y-1">
            {cluster.gaps.slice(0, 5).map((gap, index) => (
              <li
                key={index}
                className="text-sm text-yellow-700 dark:text-yellow-300"
              >
                - {gap}
              </li>
            ))}
            {cluster.gaps.length > 5 && (
              <li className="text-sm text-yellow-600 dark:text-yellow-400">
                +{cluster.gaps.length - 5} more gaps
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
