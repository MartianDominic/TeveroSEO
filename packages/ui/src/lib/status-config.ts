"use client";

import {
  CheckCircle2,
  TrendingDown,
  Link2Off,
  AlertCircle,
  Clock,
  FileEdit,
  Send,
  Eye,
  Archive,
  Loader2,
  type LucideIcon,
} from "lucide-react";

/**
 * Status configuration for semantic status indicators throughout the application.
 * Uses v6 design tokens for consistent styling.
 */
export interface StatusConfig {
  label: string;
  color: string; // Tailwind class for dot/indicator
  bgColor: string; // Background for pills
  textColor: string; // Text color
  icon?: LucideIcon;
  pulse?: boolean; // Animated indicator
}

/**
 * Prospect pipeline statuses
 */
export const PROSPECT_STATUS: Record<string, StatusConfig> = {
  new: {
    label: "New",
    color: "bg-info",
    bgColor: "bg-info-soft",
    textColor: "text-info",
  },
  analyzing: {
    label: "Analyzing",
    color: "bg-warning",
    bgColor: "bg-warning-soft",
    textColor: "text-warning",
    icon: Loader2,
    pulse: true,
  },
  analyzed: {
    label: "Analyzed",
    color: "bg-success",
    bgColor: "bg-success-soft",
    textColor: "text-success",
    icon: CheckCircle2,
  },
  converted: {
    label: "Converted",
    color: "bg-accent",
    bgColor: "bg-accent-soft",
    textColor: "text-accent",
  },
  archived: {
    label: "Archived",
    color: "bg-text-4",
    bgColor: "bg-surface-2",
    textColor: "text-text-3",
    icon: Archive,
  },
};

/**
 * Client health statuses
 */
export const CLIENT_STATUS: Record<string, StatusConfig> = {
  good: {
    label: "Healthy",
    color: "bg-success",
    bgColor: "bg-success-soft",
    textColor: "text-success",
    icon: CheckCircle2,
  },
  drop: {
    label: "Traffic Drop",
    color: "bg-error",
    bgColor: "bg-error-soft",
    textColor: "text-error",
    icon: TrendingDown,
  },
  no_gsc: {
    label: "Not Connected",
    color: "bg-warning",
    bgColor: "bg-warning-soft",
    textColor: "text-warning",
    icon: Link2Off,
  },
  stale: {
    label: "Sync Stale",
    color: "bg-warning",
    bgColor: "bg-warning-soft",
    textColor: "text-warning",
    icon: AlertCircle,
  },
};

/**
 * Article/content statuses
 */
export const ARTICLE_STATUS: Record<string, StatusConfig> = {
  draft: {
    label: "Draft",
    color: "bg-text-3",
    bgColor: "bg-surface-2",
    textColor: "text-text-2",
    icon: FileEdit,
  },
  planned: {
    label: "Planned",
    color: "bg-info",
    bgColor: "bg-info-soft",
    textColor: "text-info",
    icon: Clock,
  },
  writing: {
    label: "Writing",
    color: "bg-warning",
    bgColor: "bg-warning-soft",
    textColor: "text-warning",
    icon: Loader2,
    pulse: true,
  },
  review: {
    label: "In Review",
    color: "bg-accent",
    bgColor: "bg-accent-soft",
    textColor: "text-accent",
    icon: Eye,
  },
  published: {
    label: "Published",
    color: "bg-success",
    bgColor: "bg-success-soft",
    textColor: "text-success",
    icon: Send,
  },
  archived: {
    label: "Archived",
    color: "bg-text-4",
    bgColor: "bg-surface-2",
    textColor: "text-text-3",
    icon: Archive,
  },
};

/**
 * Pipeline stage statuses for content workflow
 */
export const PIPELINE_STAGE: Record<string, StatusConfig> = {
  idea: {
    label: "Idea",
    color: "bg-info",
    bgColor: "bg-info-soft",
    textColor: "text-info",
  },
  outline: {
    label: "Outline",
    color: "bg-warning",
    bgColor: "bg-warning-soft",
    textColor: "text-warning",
  },
  draft: {
    label: "Draft",
    color: "bg-accent",
    bgColor: "bg-accent-soft",
    textColor: "text-accent",
  },
  review: {
    label: "Review",
    color: "bg-accent-2",
    bgColor: "bg-accent-soft",
    textColor: "text-accent",
  },
  published: {
    label: "Published",
    color: "bg-success",
    bgColor: "bg-success-soft",
    textColor: "text-success",
  },
};

// Type helpers
export type ProspectStatus = keyof typeof PROSPECT_STATUS;
export type ClientStatus = keyof typeof CLIENT_STATUS;
export type ArticleStatus = keyof typeof ARTICLE_STATUS;
export type PipelineStage = keyof typeof PIPELINE_STAGE;

/**
 * Get status configuration from a status config map.
 * Returns a default config if the status is not found.
 */
export function getStatusConfig(
  configMap: Record<string, StatusConfig>,
  status: string
): StatusConfig {
  return (
    configMap[status] ?? {
      label: status,
      color: "bg-text-4",
      bgColor: "bg-surface-2",
      textColor: "text-text-3",
    }
  );
}
