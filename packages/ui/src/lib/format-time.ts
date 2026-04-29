/**
 * Time formatting utilities for relative and absolute timestamps.
 * Used by RelativeTimestamp component and across the UI.
 */

/**
 * Formats a date as a relative time string (e.g., "5 minutes ago", "2 hours ago")
 */
export function formatRelativeTime(date: Date | string | number): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;

  // Handle invalid dates
  if (isNaN(d.getTime())) {
    return "Invalid date";
  }

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  // Future dates
  if (diffMs < 0) {
    const absMins = Math.abs(diffMins);
    const absHours = Math.abs(diffHours);
    const absDays = Math.abs(diffDays);

    if (absMins < 1) return "in a moment";
    if (absMins < 60) return `in ${absMins}m`;
    if (absHours < 24) return `in ${absHours}h`;
    if (absDays < 7) return `in ${absDays}d`;
    return d.toLocaleDateString();
  }

  // Past dates
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  if (diffMonths < 12) return `${diffMonths}mo ago`;

  return d.toLocaleDateString();
}

/**
 * Formats a date as a short date string (e.g., "Jan 1, 2024")
 */
export function formatShortDate(date: Date | string | number): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;

  if (isNaN(d.getTime())) {
    return "Invalid date";
  }

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Formats a date as a full date-time string for tooltips
 */
export function formatDateTime(date: Date | string | number): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;

  if (isNaN(d.getTime())) {
    return "Invalid date";
  }

  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Formats a time only (e.g., "3:45 PM")
 */
export function formatTime(date: Date | string | number): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;

  if (isNaN(d.getTime())) {
    return "Invalid time";
  }

  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
