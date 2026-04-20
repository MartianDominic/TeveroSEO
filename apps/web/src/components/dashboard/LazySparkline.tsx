"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Skeleton } from "@tevero/ui";
import { SparklineChart, getTrend } from "./SparklineChart";
import type { SparklineDataPoint } from "./SparklineChart";

export type SparklineMetric = "traffic" | "keywords" | "ctr";

interface LazySparklineProps {
  clientId: string;
  metric: SparklineMetric;
  width?: number;
  height?: number;
  showTooltip?: boolean;
  className?: string;
}

interface SparklineResponse {
  data: number[];
  labels?: string[];
}

/**
 * LazySparkline - Loads sparkline data only when visible in viewport.
 * Uses IntersectionObserver to detect visibility and fetches data on-demand.
 */
export function LazySparkline({
  clientId,
  metric,
  width = 80,
  height = 24,
  showTooltip = false,
  className,
}: LazySparklineProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [data, setData] = useState<SparklineDataPoint[] | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  // Intersection Observer for visibility detection
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px" } // Start loading 100px before visible
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  // Fetch data when visible
  const fetchData = useCallback(async () => {
    if (!isVisible || data !== null || loading) return;

    setLoading(true);
    setError(false);

    const controller = new AbortController();

    try {
      const res = await fetch(`/api/sparkline/${clientId}/${metric}`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const result: SparklineResponse = await res.json();

      // Transform to SparklineDataPoint format
      const points: SparklineDataPoint[] = result.data.map((value, i) => ({
        value,
        label: result.labels?.[i],
      }));

      setData(points);
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(true);
      }
    } finally {
      setLoading(false);
    }

    return () => controller.abort();
  }, [isVisible, data, loading, clientId, metric]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Show skeleton while loading or not yet visible
  if (!isVisible || loading || data === null) {
    return (
      <div ref={ref} style={{ width, height }} className={className}>
        <Skeleton className="w-full h-full" />
      </div>
    );
  }

  // Error state - show empty
  if (error || data.length === 0) {
    return (
      <div
        ref={ref}
        style={{ width, height }}
        className="flex items-center justify-center text-muted-foreground text-xs"
      >
        -
      </div>
    );
  }

  const trend = getTrend(data);

  return (
    <div ref={ref} className={className}>
      <SparklineChart
        data={data}
        width={width}
        height={height}
        trend={trend}
        showTooltip={showTooltip}
      />
    </div>
  );
}
