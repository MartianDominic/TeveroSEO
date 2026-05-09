/**
 * Privacy Blur Component
 * Phase 96: CPR-003 - Privacy blur mode for sensitive metrics
 *
 * Applies CSS blur effect to sensitive data in client portal.
 * Can be toggled on/off based on privacy mode settings.
 *
 * Design System v6 compliant: Geist font, ghost-edge shadows.
 */
"use client";

import { ReactNode, useState, useCallback } from "react";

import { cn } from "@/lib/utils";

/**
 * Blur intensity levels
 */
export type BlurIntensity = "light" | "medium" | "heavy";

/**
 * Sensitive metric types that should be blurred
 */
export const SENSITIVE_METRICS = [
  "revenue",
  "conversionValue",
  "costPerAcquisition",
  "clientSpend",
  "cost",
  "cpc",
  "budget",
  "profit",
  "margin",
  "mrr",
  "arpu",
] as const;

export type SensitiveMetric = (typeof SENSITIVE_METRICS)[number];

/**
 * Check if a metric key is considered sensitive
 */
export function isSensitiveMetric(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return SENSITIVE_METRICS.some(
    (metric) =>
      lowerKey.includes(metric.toLowerCase()) ||
      lowerKey === metric.toLowerCase()
  );
}

/**
 * Props for PrivacyBlur component
 */
export interface PrivacyBlurProps {
  /** Whether blur effect is enabled */
  enabled: boolean;
  /** Content to blur */
  children: ReactNode;
  /** Blur intensity level */
  blurIntensity?: BlurIntensity;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show "click to reveal" on hover */
  revealOnHover?: boolean;
  /** Callback when user clicks to reveal (requires auth) */
  onRevealRequest?: () => void;
}

/** Blur CSS values for each intensity */
const BLUR_VALUES: Record<BlurIntensity, string> = {
  light: "blur-[2px]",
  medium: "blur-[4px]",
  heavy: "blur-[8px]",
};

/**
 * Privacy Blur wrapper component.
 *
 * Wraps content and applies blur effect when enabled.
 * Optionally allows click-to-reveal functionality.
 *
 * @example
 * ```tsx
 * <PrivacyBlur enabled={privacyMode} blurIntensity="medium">
 *   <MetricValue>${revenue.toLocaleString()}</MetricValue>
 * </PrivacyBlur>
 * ```
 */
export function PrivacyBlur({
  enabled,
  children,
  blurIntensity = "medium",
  className,
  revealOnHover = false,
  onRevealRequest,
}: PrivacyBlurProps) {
  const [isRevealed, setIsRevealed] = useState(false);

  const handleClick = useCallback(() => {
    if (enabled && onRevealRequest) {
      onRevealRequest();
    }
  }, [enabled, onRevealRequest]);

  // If not enabled, just render children
  if (!enabled) {
    return <span className={className}>{children}</span>;
  }

  // If revealed (after successful auth), show without blur
  if (isRevealed) {
    return <span className={className}>{children}</span>;
  }

  return (
    <span
      className={cn(
        "relative inline-block select-none transition-all duration-200",
        BLUR_VALUES[blurIntensity],
        revealOnHover && "hover:blur-[1px] cursor-pointer",
        onRevealRequest && "cursor-pointer",
        className
      )}
      onClick={handleClick}
      role={onRevealRequest ? "button" : undefined}
      aria-label={onRevealRequest ? "Click to reveal sensitive data" : undefined}
    >
      {children}
    </span>
  );
}

/**
 * Props for PrivacyMetricCard component
 */
export interface PrivacyMetricCardProps {
  /** Metric label */
  label: string;
  /** Metric value */
  value: string | number;
  /** Metric key for sensitivity check */
  metricKey: string;
  /** Whether privacy mode is enabled */
  privacyMode: boolean;
  /** Blur intensity level */
  blurIntensity?: BlurIntensity;
  /** Additional CSS classes */
  className?: string;
  /** Optional trend indicator */
  trend?: "up" | "down" | "neutral";
  /** Optional trend percentage */
  trendPercent?: number;
}

/**
 * Metric card with automatic privacy blur for sensitive metrics.
 *
 * Automatically detects if the metric is sensitive and applies blur.
 *
 * @example
 * ```tsx
 * <PrivacyMetricCard
 *   label="Revenue"
 *   value={12500}
 *   metricKey="revenue"
 *   privacyMode={true}
 * />
 * ```
 */
export function PrivacyMetricCard({
  label,
  value,
  metricKey,
  privacyMode,
  blurIntensity = "medium",
  className,
  trend,
  trendPercent,
}: PrivacyMetricCardProps) {
  const shouldBlur = privacyMode && isSensitiveMetric(metricKey);

  const formattedValue =
    typeof value === "number" ? value.toLocaleString() : value;

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4",
        "shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_rgba(0,0,0,0.05)]", // ghost-edge shadow
        className
      )}
    >
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <PrivacyBlur enabled={shouldBlur} blurIntensity={blurIntensity}>
          <span className="text-2xl font-semibold tracking-tight">
            {formattedValue}
          </span>
        </PrivacyBlur>
        {trend && trendPercent !== undefined && (
          <span
            className={cn(
              "text-sm font-medium",
              trend === "up" && "text-emerald-600",
              trend === "down" && "text-red-600",
              trend === "neutral" && "text-muted-foreground"
            )}
          >
            {trend === "up" ? "+" : trend === "down" ? "-" : ""}
            {Math.abs(trendPercent).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Hook for managing privacy blur state
 */
export function usePrivacyBlur(initialEnabled = false) {
  const [enabled, setEnabled] = useState(initialEnabled);

  const toggle = useCallback(() => {
    setEnabled((prev) => !prev);
  }, []);

  const enable = useCallback(() => {
    setEnabled(true);
  }, []);

  const disable = useCallback(() => {
    setEnabled(false);
  }, []);

  return {
    enabled,
    toggle,
    enable,
    disable,
    setEnabled,
  };
}

export default PrivacyBlur;
