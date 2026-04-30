"use client";

/**
 * Report builder state management hook and data aggregation utilities.
 *
 * Provides useReportBuilder hook for managing report configuration state
 * and aggregateReportData for fetching section-specific analytics data.
 */

import { useState, useCallback, useMemo } from "react";
import type { ReportSection, ReportBuilderConfig, ReportSectionType } from "@tevero/types";
import type { ReportData } from "./types";
import { getDefaultSections, isSectionRequired } from "./sections";

/** Maximum date range in days (threat model T-53-03) */
const MAX_DATE_RANGE_DAYS = 365;

/**
 * Get default date range (last 30 days).
 */
function getDefaultDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
}

/**
 * Validate date range is within limits.
 *
 * @param range - Date range to validate
 * @returns true if valid
 */
function isValidDateRange(range: { start: string; end: string }): boolean {
  const start = new Date(range.start);
  const end = new Date(range.end);

  // Check dates are valid
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return false;
  }

  // Check start is before end
  if (start > end) {
    return false;
  }

  // Check range is within limits (T-53-03: DoS mitigation)
  const diffMs = end.getTime() - start.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays > MAX_DATE_RANGE_DAYS) {
    return false;
  }

  return true;
}

export interface UseReportBuilderReturn {
  /** Current report configuration */
  config: ReportBuilderConfig;
  /** Set report name */
  setName: (name: string) => void;
  /** Replace all sections */
  setSections: (sections: ReportSection[]) => void;
  /** Toggle a section on/off (ignores required sections) */
  toggleSection: (type: ReportSectionType) => void;
  /** Reorder sections via drag-and-drop */
  reorderSections: (fromIndex: number, toIndex: number) => void;
  /** Set date range for data aggregation */
  setDateRange: (range: { start: string; end: string }) => void;
  /** Set locale for formatting */
  setLocale: (locale: string) => void;
  /** Whether current config is valid for generation */
  isValid: boolean;
  /** Enabled section types (for UI) */
  enabledSections: Set<ReportSectionType>;
}

/**
 * Hook for managing report builder state.
 *
 * Handles section selection, ordering, and configuration validation.
 *
 * @param initialConfig - Optional partial initial config
 * @returns Builder state and actions
 */
export function useReportBuilder(
  initialConfig?: Partial<ReportBuilderConfig>
): UseReportBuilderReturn {
  const [name, setName] = useState(initialConfig?.name ?? "");
  const [sections, setSectionsState] = useState<ReportSection[]>(
    initialConfig?.sections ?? getDefaultSections()
  );
  const [dateRange, setDateRangeState] = useState(
    initialConfig?.dateRange ?? getDefaultDateRange()
  );
  const [locale, setLocale] = useState(initialConfig?.locale ?? "en");

  // Track which sections are enabled
  const enabledSections = useMemo(() => {
    return new Set(sections.map((s) => s.type));
  }, [sections]);

  // Toggle section on/off
  const toggleSection = useCallback((type: ReportSectionType) => {
    // Cannot toggle required sections
    if (isSectionRequired(type)) {
      return;
    }

    setSectionsState((prev) => {
      const isEnabled = prev.some((s) => s.type === type);
      if (isEnabled) {
        // Remove section
        return prev
          .filter((s) => s.type !== type)
          .map((s, i) => ({ ...s, order: i }));
      } else {
        // Add section at end
        return [...prev, { type, order: prev.length }];
      }
    });
  }, []);

  // Reorder sections (for drag-and-drop)
  const reorderSections = useCallback((fromIndex: number, toIndex: number) => {
    setSectionsState((prev) => {
      const result = [...prev];
      const [removed] = result.splice(fromIndex, 1);
      result.splice(toIndex, 0, removed);
      // Update order values
      return result.map((s, i) => ({ ...s, order: i }));
    });
  }, []);

  // Set sections directly
  const setSections = useCallback((newSections: ReportSection[]) => {
    setSectionsState(newSections.map((s, i) => ({ ...s, order: i })));
  }, []);

  // Set date range with validation
  const setDateRange = useCallback((range: { start: string; end: string }) => {
    // Only update if valid (T-53-01: input validation)
    if (isValidDateRange(range)) {
      setDateRangeState(range);
    }
  }, []);

  // Compute validation state
  const isValid = useMemo(() => {
    // Name must not be empty
    if (!name.trim()) {
      return false;
    }

    // Must have at least one content section (not just header/footer)
    const contentSections = sections.filter(
      (s) => !isSectionRequired(s.type)
    );
    if (contentSections.length === 0) {
      return false;
    }

    // Date range must be valid
    if (!isValidDateRange(dateRange)) {
      return false;
    }

    return true;
  }, [name, sections, dateRange]);

  // Build config object
  const config: ReportBuilderConfig = useMemo(
    () => ({
      name,
      sections,
      dateRange,
      locale,
    }),
    [name, sections, dateRange, locale]
  );

  return {
    config,
    setName,
    setSections,
    toggleSection,
    reorderSections,
    setDateRange,
    setLocale,
    isValid,
    enabledSections,
  };
}

/**
 * Aggregates report data for selected sections.
 *
 * Fetches only the data needed for enabled sections to minimize
 * API calls and data transfer.
 *
 * @param clientId - Client UUID
 * @param dateRange - Date range for data
 * @param sections - Selected sections
 * @returns Aggregated report data
 */
export async function aggregateReportData(
  clientId: string,
  dateRange: { start: string; end: string },
  sections: ReportSection[]
): Promise<Partial<ReportData>> {
  // Determine which data sources are needed
  const sectionTypes = new Set(sections.map((s) => s.type));
  const needsGSC =
    sectionTypes.has("summary_stats") ||
    sectionTypes.has("gsc_chart") ||
    sectionTypes.has("queries_table");
  const needsGA4 =
    sectionTypes.has("summary_stats") || sectionTypes.has("ga4_chart");
  const needsQueries = sectionTypes.has("queries_table");

  // Build query params
  const params = new URLSearchParams({
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  // Fetch data in parallel based on what's needed
  const [gscData, ga4Data, queriesData] = await Promise.all([
    needsGSC
      ? fetch(`/api/proxy/open-seo/analytics/${clientId}/gsc?${params}`).then(
          (r) => (r.ok ? r.json() : null)
        )
      : Promise.resolve(null),
    needsGA4
      ? fetch(`/api/proxy/open-seo/analytics/${clientId}/ga4?${params}`).then(
          (r) => (r.ok ? r.json() : null)
        )
      : Promise.resolve(null),
    needsQueries
      ? fetch(
          `/api/proxy/open-seo/analytics/${clientId}/queries?${params}&limit=10`
        ).then((r) => (r.ok ? r.json() : null))
      : Promise.resolve(null),
  ]);

  // Aggregate into report data format
  return {
    gscDaily: gscData?.daily ?? [],
    gscSummary: gscData?.summary ?? {
      clicks: 0,
      impressions: 0,
      ctr: 0,
      position: 0,
    },
    ga4Daily: ga4Data?.daily ?? [],
    ga4Summary: ga4Data?.summary ?? {
      sessions: 0,
      users: 0,
      conversions: 0,
      bounce_rate: 0,
    },
    topQueries: queriesData?.queries ?? [],
  };
}
