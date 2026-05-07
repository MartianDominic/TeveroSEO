/**
 * Site Table Component
 * Phase 96-02: Master Dashboard
 *
 * CSS Grid table with sparklines and tag badges.
 * Design System v6: hover-reveal arrows, sliding underline tabs.
 */
import { SparklineChart } from './SparklineChart';
import { Badge } from '@/client/components/ui/badge';
import type { SiteMetrics } from '@/server/features/analytics/types';

interface SiteTableProps {
  sites: SiteMetrics[];
  onSiteClick?: (siteId: string) => void;
}

export function SiteTable({ sites, onSiteClick }: SiteTableProps) {
  return (
    <div className="bg-surface rounded-[12px] shadow-card overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[minmax(200px,2fr)_100px_120px_80px_80px_minmax(100px,1fr)_32px] gap-4 px-7 py-4 border-b border-hairline-2 text-[13px] text-text-3 font-medium">
        <div>Site</div>
        <div className="text-right">Clicks</div>
        <div className="w-32">Trend</div>
        <div className="text-right">Pos.</div>
        <div className="text-right">CTR</div>
        <div>Tags</div>
        <div></div>
      </div>

      {/* Rows */}
      {sites.map((site) => (
        <div
          key={site.siteId}
          className="grid grid-cols-[minmax(200px,2fr)_100px_120px_80px_80px_minmax(100px,1fr)_32px] gap-4 px-7 py-4 border-b border-hairline-3 hover:bg-surface-2 transition-colors cursor-pointer group"
          onClick={() => onSiteClick?.(site.siteId)}
        >
          {/* Site name */}
          <div>
            <div className="text-[14px] text-text-1 font-medium truncate">
              {site.siteName}
            </div>
            <div className="text-[12px] text-text-3 truncate">{site.siteUrl}</div>
          </div>

          {/* Clicks with change */}
          <div className="text-right">
            <div className="text-[14px] text-text-1 tabular-nums">
              {formatCompact(site.metrics.clicks)}
            </div>
            <div
              className={`text-[12px] tabular-nums ${
                site.comparison.clicksChange > 0 ? 'text-success' : 'text-error'
              }`}
            >
              {site.comparison.clicksChange > 0 ? '+' : ''}
              {site.comparison.clicksChange.toFixed(1)}%
            </div>
          </div>

          {/* Sparkline */}
          <div className="w-32">
            <SparklineChart data={site.trend} height={36} showTooltip={false} />
          </div>

          {/* Position */}
          <div className="text-right text-[14px] text-text-1 tabular-nums">
            {site.metrics.position.toFixed(1)}
          </div>

          {/* CTR */}
          <div className="text-right text-[14px] text-text-1 tabular-nums">
            {(site.metrics.ctr * 100).toFixed(1)}%
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1">
            {site.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-[12px]">
                {tag}
              </Badge>
            ))}
            {site.tags.length > 3 && (
              <Badge variant="outline" className="text-[12px] text-text-3">
                +{site.tags.length - 3}
              </Badge>
            )}
          </div>

          {/* Arrow - hover reveal */}
          <div className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-accent transform group-hover:translate-x-[2px] transition-transform">
              →
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  } else if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}
