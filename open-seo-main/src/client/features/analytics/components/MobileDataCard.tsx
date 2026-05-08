/**
 * Mobile Data Card Component
 * Phase 96: CPR-010
 *
 * Card-based display for tabular data on mobile devices.
 * Used as an alternative to data tables on narrow screens.
 *
 * Design System v6: Ghost-edge shadows, consistent spacing.
 */
import { Badge, cn } from "@tevero/ui";

// ============================================================================
// Types
// ============================================================================

export interface MobileDataCardProps {
  /** Primary identifier/title for the card */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Badge content (e.g., position, status) */
  badge?: {
    value: string | number;
    variant?: "default" | "success" | "warning" | "error";
  };
  /** Key-value pairs to display */
  metrics?: Array<{
    label: string;
    value: string | number;
    change?: {
      value: number;
      direction: "up" | "down" | "flat";
    };
  }>;
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Additional CSS classes */
  className?: string;
}

export interface MobileDataListProps<T> {
  /** Data items to render */
  data: T[];
  /** Render function for each item */
  renderCard: (item: T, index: number) => React.ReactNode;
  /** Empty state message */
  emptyMessage?: string;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Components
// ============================================================================

/**
 * Single data card for mobile display.
 */
export function MobileDataCard({
  title,
  subtitle,
  badge,
  metrics,
  action,
  className,
}: MobileDataCardProps) {
  return (
    <div
      className={cn(
        "bg-surface rounded-lg p-4 shadow-card",
        // Touch-friendly spacing
        "active:bg-surface-active transition-colors",
        className
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-[14px] font-medium text-text-1 truncate">{title}</h3>
          {subtitle && (
            <p className="text-[12px] text-text-3 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        {badge && (
          <Badge
            variant={badge.variant || "default"}
            className="shrink-0 text-[12px] font-medium"
          >
            {badge.value}
          </Badge>
        )}
      </div>

      {/* Metrics row */}
      {metrics && metrics.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          {metrics.map((metric, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <span className="text-[12px] text-text-3">{metric.label}:</span>
              <span className="text-[13px] font-medium text-text-1">
                {metric.value}
              </span>
              {metric.change && (
                <span
                  className={cn(
                    "text-[11px] font-medium",
                    metric.change.direction === "up" && "text-success",
                    metric.change.direction === "down" && "text-error",
                    metric.change.direction === "flat" && "text-text-3"
                  )}
                >
                  {metric.change.direction === "up" && "+"}
                  {metric.change.direction === "down" && "-"}
                  {Math.abs(metric.change.value)}%
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Action button */}
      {action && (
        <button
          onClick={action.onClick}
          className={cn(
            "mt-3 w-full min-h-[44px]", // Apple touch target
            "px-3 py-2 text-[13px] font-medium",
            "text-accent bg-accent/10 hover:bg-accent/20",
            "rounded-md transition-colors"
          )}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/**
 * List of mobile data cards.
 */
export function MobileDataList<T>({
  data,
  renderCard,
  emptyMessage = "No data available",
  className,
}: MobileDataListProps<T>) {
  if (data.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-[14px] text-text-3">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {data.map((item, index) => renderCard(item, index))}
    </div>
  );
}

// ============================================================================
// Keyword-Specific Card
// ============================================================================

export interface KeywordCardData {
  keyword: string;
  position: number;
  positionChange?: number;
  clicks: number;
  impressions: number;
  ctr: number;
  url?: string;
}

/**
 * Pre-built card for keyword data display.
 */
export function KeywordMobileCard({
  data,
  onViewDetails,
}: {
  data: KeywordCardData;
  onViewDetails?: (keyword: string) => void;
}) {
  const positionBadgeVariant =
    data.position <= 3 ? "success" : data.position <= 10 ? "default" : "warning";

  return (
    <MobileDataCard
      title={data.keyword}
      subtitle={data.url}
      badge={{
        value: `#${data.position}`,
        variant: positionBadgeVariant,
      }}
      metrics={[
        {
          label: "Clicks",
          value: data.clicks.toLocaleString(),
        },
        {
          label: "Impr",
          value: data.impressions.toLocaleString(),
        },
        {
          label: "CTR",
          value: `${(data.ctr * 100).toFixed(1)}%`,
        },
        ...(data.positionChange !== undefined
          ? [
              {
                label: "Pos",
                value: data.position,
                change: {
                  value: Math.abs(data.positionChange),
                  direction: (data.positionChange < 0
                    ? "up"
                    : data.positionChange > 0
                    ? "down"
                    : "flat") as "up" | "down" | "flat",
                },
              },
            ]
          : []),
      ]}
      action={
        onViewDetails
          ? {
              label: "View Details",
              onClick: () => onViewDetails(data.keyword),
            }
          : undefined
      }
    />
  );
}
