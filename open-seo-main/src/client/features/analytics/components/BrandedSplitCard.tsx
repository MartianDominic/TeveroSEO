/**
 * Branded Split Card Component
 * Phase 96-05: Client Portal
 *
 * Two-column card showing branded vs non-branded traffic split.
 * Design System v6: ghost-edge shadows, Newsreader for numerals.
 *
 * Visual representation:
 * +--------------------+--------------------+
 * | Branded: 12.3K     | Non-Branded: 32.9K |
 * | [progress bar]     | [progress bar]     |
 * +--------------------+--------------------+
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/ui/card';

interface BrandedMetrics {
  clicks: number;
  impressions: number;
}

interface BrandedSplitCardProps {
  branded: BrandedMetrics;
  nonBranded: BrandedMetrics;
  brandedPercent: number;
  nonBrandedPercent: number;
  showClicks?: boolean;
  showImpressions?: boolean;
}

export function BrandedSplitCard({
  branded,
  nonBranded,
  brandedPercent,
  nonBrandedPercent,
  showClicks = true,
  showImpressions = true,
}: BrandedSplitCardProps) {
  return (
    <Card className="bg-surface shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-[15px] font-medium text-text-1">
          Branded vs Non-Branded
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="grid grid-cols-2 gap-6">
          {/* Branded Column */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-accent" />
              <span className="text-[13px] text-text-2">Branded</span>
            </div>

            {showClicks && (
              <div>
                <div className="font-display text-[clamp(24px,2vw,32px)] font-normal tracking-[-0.026em] tabular-nums text-text-1">
                  {formatCompact(branded.clicks)}
                </div>
                <div className="text-[12px] text-text-3">clicks</div>
              </div>
            )}

            {showImpressions && (
              <div className="mt-2">
                <div className="text-[15px] font-medium tabular-nums text-text-2">
                  {formatCompact(branded.impressions)}
                </div>
                <div className="text-[12px] text-text-3">impressions</div>
              </div>
            )}

            {/* Progress bar */}
            <div className="mt-2">
              <div className="h-2 bg-surface-raised rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-500"
                  style={{ width: `${brandedPercent}%` }}
                />
              </div>
              <div className="text-[12px] text-text-3 mt-1 tabular-nums">
                {brandedPercent.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Non-Branded Column */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-text-3" />
              <span className="text-[13px] text-text-2">Non-Branded</span>
            </div>

            {showClicks && (
              <div>
                <div className="font-display text-[clamp(24px,2vw,32px)] font-normal tracking-[-0.026em] tabular-nums text-text-1">
                  {formatCompact(nonBranded.clicks)}
                </div>
                <div className="text-[12px] text-text-3">clicks</div>
              </div>
            )}

            {showImpressions && (
              <div className="mt-2">
                <div className="text-[15px] font-medium tabular-nums text-text-2">
                  {formatCompact(nonBranded.impressions)}
                </div>
                <div className="text-[12px] text-text-3">impressions</div>
              </div>
            )}

            {/* Progress bar */}
            <div className="mt-2">
              <div className="h-2 bg-surface-raised rounded-full overflow-hidden">
                <div
                  className="h-full bg-text-3 rounded-full transition-all duration-500"
                  style={{ width: `${nonBrandedPercent}%` }}
                />
              </div>
              <div className="text-[12px] text-text-3 mt-1 tabular-nums">
                {nonBrandedPercent.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
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
