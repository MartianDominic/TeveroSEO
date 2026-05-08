/**
 * useAgencyTimezone Hook
 * Phase 96: CPR-007
 *
 * Provides timezone-aware date formatting for portal components.
 * Fetches and caches the agency's configured timezone.
 *
 * Uses native Intl.DateTimeFormat for timezone support (no external dependencies).
 *
 * Usage:
 * ```tsx
 * function DateDisplay({ date }: { date: Date }) {
 *   const { formatDateTime, timezone } = useAgencyTimezone();
 *
 *   return (
 *     <span title={`Timezone: ${timezone}`}>
 *       {formatDateTime(date)}
 *     </span>
 *   );
 * }
 * ```
 */
import { useState, useEffect, useCallback, useMemo } from "react";

// ============================================================================
// Types
// ============================================================================

export interface AgencyTimezoneResult {
  /** The agency's configured timezone (IANA identifier) */
  timezone: string;

  /** Whether timezone is still loading */
  isLoading: boolean;

  /** Error message if fetch failed */
  error: string | null;

  /** Format a date as date only (e.g., "May 8, 2026") */
  formatDate: (date: Date | string) => string;

  /** Format a date with time (e.g., "May 8, 2026, 3:30 PM") */
  formatDateTime: (date: Date | string) => string;

  /** Format a date as relative time (e.g., "2 hours ago") */
  formatRelative: (date: Date | string) => string;

  /** Format time only (e.g., "3:30 PM") */
  formatTime: (date: Date | string) => string;

  /** Format as short date (e.g., "May 8") */
  formatShort: (date: Date | string) => string;

  /** Refetch timezone settings */
  refetch: () => Promise<void>;
}

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_TIMEZONE = "UTC";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format a date in a specific timezone using Intl.DateTimeFormat.
 */
function formatInTimezone(
  date: Date | string,
  timezone: string,
  options: Intl.DateTimeFormatOptions
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: timezone,
  }).format(dateObj);
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for timezone-aware date formatting in portal components.
 *
 * @param workspaceId - The workspace ID to fetch timezone for
 * @returns Timezone utilities and formatted date functions
 */
export function useAgencyTimezone(workspaceId?: string): AgencyTimezoneResult {
  const [timezone, setTimezone] = useState<string>(DEFAULT_TIMEZONE);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch timezone from API
  const fetchTimezone = useCallback(async () => {
    if (!workspaceId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/portal/settings`, {
        headers: {
          "X-Workspace-ID": workspaceId,
        },
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Failed to fetch portal settings");
      }

      const result = (await response.json()) as {
        success: boolean;
        data?: { timezone?: string };
      };

      if (result.success && result.data?.timezone) {
        setTimezone(result.data.timezone);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      // Keep default timezone on error
      setTimezone(DEFAULT_TIMEZONE);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchTimezone();
  }, [fetchTimezone]);

  // Memoized formatting functions
  const formatDate = useCallback(
    (date: Date | string): string => {
      try {
        return formatInTimezone(date, timezone, {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      } catch {
        // Fallback to basic format if timezone fails
        const dateObj = typeof date === "string" ? new Date(date) : date;
        return dateObj.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      }
    },
    [timezone]
  );

  const formatDateTime = useCallback(
    (date: Date | string): string => {
      try {
        return formatInTimezone(date, timezone, {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
      } catch {
        const dateObj = typeof date === "string" ? new Date(date) : date;
        return dateObj.toLocaleString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
      }
    },
    [timezone]
  );

  const formatTime = useCallback(
    (date: Date | string): string => {
      try {
        return formatInTimezone(date, timezone, {
          hour: "numeric",
          minute: "2-digit",
        });
      } catch {
        const dateObj = typeof date === "string" ? new Date(date) : date;
        return dateObj.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        });
      }
    },
    [timezone]
  );

  const formatShort = useCallback(
    (date: Date | string): string => {
      try {
        return formatInTimezone(date, timezone, {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      } catch {
        const dateObj = typeof date === "string" ? new Date(date) : date;
        return dateObj.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      }
    },
    [timezone]
  );

  const formatRelative = useCallback(
    (date: Date | string): string => {
      const dateObj = typeof date === "string" ? new Date(date) : date;
      const now = new Date();
      const diffMs = now.getTime() - dateObj.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return "just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      // Fall back to formatted date for older dates
      return formatShort(dateObj);
    },
    [formatShort]
  );

  return useMemo(
    () => ({
      timezone,
      isLoading,
      error,
      formatDate,
      formatDateTime,
      formatTime,
      formatShort,
      formatRelative,
      refetch: fetchTimezone,
    }),
    [
      timezone,
      isLoading,
      error,
      formatDate,
      formatDateTime,
      formatTime,
      formatShort,
      formatRelative,
      fetchTimezone,
    ]
  );
}

/**
 * Simple date formatting function with timezone support.
 * Convenience wrapper for use outside React components.
 */
export function formatPortalDate(
  date: Date | string,
  timezone: string,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }
): string {
  try {
    return formatInTimezone(date, timezone, options);
  } catch {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return dateObj.toLocaleString("en-US", options);
  }
}
