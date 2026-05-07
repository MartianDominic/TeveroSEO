/**
 * KPI Card Component
 * Phase 96-02: Master Dashboard
 *
 * Design System v6 compliant:
 * - Newsreader serif for primary numeral (--num-card)
 * - Ghost-edge shadows (--shadow-card)
 * - tabular-nums for data alignment
 * - Delta with semantic color (success/error)
 */
import { Card, CardContent } from '@/client/components/ui/card';

interface KPICardProps {
  title: string;
  value: number;
  change: number; // Percentage change (e.g., 15.2 for +15.2%)
  format?: 'number' | 'decimal' | 'percent';
  invertChange?: boolean; // For position where lower is better
}

export function KPICard({
  title,
  value,
  change,
  format = 'number',
  invertChange = false,
}: KPICardProps) {
  const formattedValue = formatValue(value, format);
  const isPositive = invertChange ? change < 0 : change > 0;
  const changeColor = isPositive
    ? 'text-success'
    : change < 0
      ? 'text-error'
      : 'text-text-3';

  return (
    <Card className="bg-surface shadow-card hover:shadow-lift transition-shadow">
      <CardContent className="pt-6 pb-4 px-6">
        {/* Primary numeral - Newsreader serif */}
        <div className="font-display text-[clamp(36px,3vw,44px)] font-normal tracking-[-0.026em] tabular-nums lining-nums text-text-1">
          {formattedValue}
        </div>

        {/* Title */}
        <div className="text-[13px] text-text-3 mt-1">{title}</div>

        {/* Delta */}
        {change !== 0 && (
          <div className={`text-[13px] font-medium mt-2 tabular-nums ${changeColor}`}>
            {change > 0 ? '+' : ''}
            {change.toFixed(1)}%
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatValue(value: number, format: string): string {
  switch (format) {
    case 'decimal':
      return value.toFixed(1);
    case 'percent':
      return `${(value * 100).toFixed(1)}%`;
    default:
      // Compact number formatting
      if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(1)}M`;
      } else if (value >= 1_000) {
        return `${(value / 1_000).toFixed(1)}K`;
      }
      return value.toLocaleString();
  }
}
