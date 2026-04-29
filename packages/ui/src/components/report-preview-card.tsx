"use client";

import * as React from "react";
import {
  FileText,
  LineChart,
  FileEdit,
  Settings,
  Download,
  Send,
  Eye,
  Loader2,
  Calendar,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../lib/utils";
import { RelativeTimestamp } from "./relative-timestamp";
import { Button } from "./button";
import { Badge } from "./badge";

// ---------------------------------------------------------------------------
// ReportPreviewCardProps
// ---------------------------------------------------------------------------

export type ReportType = "seo" | "performance" | "content" | "custom";
export type ReportStatus = "draft" | "generating" | "ready" | "sent" | "scheduled";

export interface ReportPreviewCardProps {
  /** Report ID */
  id: string;
  /** Report title */
  title: string;
  /** Report type */
  type: ReportType;
  /** Current status */
  status: ReportStatus;
  /** Creation timestamp */
  createdAt: Date | string;
  /** Scheduled send time (for scheduled reports) */
  scheduledFor?: Date | string;
  /** Recipient email */
  recipient?: string;
  /** Section names */
  sections?: string[];
  /** View report callback */
  onView?: () => void;
  /** Download report callback */
  onDownload?: () => void;
  /** Send report callback */
  onSend?: () => void;
  /** Edit report callback */
  onEdit?: () => void;
  /** Additional class names */
  className?: string;
}

// ---------------------------------------------------------------------------
// Type icons
// ---------------------------------------------------------------------------

const TYPE_ICONS: Record<ReportType, LucideIcon> = {
  seo: FileText,
  performance: LineChart,
  content: FileEdit,
  custom: Settings,
};

// ---------------------------------------------------------------------------
// Status configuration
// ---------------------------------------------------------------------------

interface StatusStyle {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  icon?: LucideIcon;
  spin?: boolean;
}

const STATUS_CONFIG: Record<ReportStatus, StatusStyle> = {
  draft: { label: "Draft", variant: "outline" },
  generating: { label: "Generating", variant: "secondary", icon: Loader2, spin: true },
  ready: { label: "Ready", variant: "default" },
  sent: { label: "Sent", variant: "secondary" },
  scheduled: { label: "Scheduled", variant: "secondary", icon: Calendar },
};

// ---------------------------------------------------------------------------
// ReportPreviewCard
// ---------------------------------------------------------------------------

/**
 * ReportPreviewCard displays a preview of a generated report.
 *
 * Features:
 * - Type icon with title
 * - Status pill with semantic colors
 * - Sections count (collapsed)
 * - Creation timestamp
 * - Action buttons (View/Download/Send/Edit)
 *
 * @example
 * <ReportPreviewCard
 *   id="report-1"
 *   title="Monthly SEO Report"
 *   type="seo"
 *   status="ready"
 *   createdAt={new Date()}
 *   sections={['Overview', 'Rankings', 'Recommendations']}
 *   onView={() => {}}
 *   onDownload={() => {}}
 * />
 */
export function ReportPreviewCard({
  id,
  title,
  type,
  status,
  createdAt,
  scheduledFor,
  recipient,
  sections,
  onView,
  onDownload,
  onSend,
  onEdit,
  className,
}: ReportPreviewCardProps) {
  const TypeIcon = TYPE_ICONS[type];
  const statusConfig = STATUS_CONFIG[status];
  const StatusIcon = statusConfig.icon;

  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] bg-surface",
        "shadow-[var(--shadow-card)]",
        "hover:shadow-[var(--shadow-lift)]",
        "transition-shadow duration-[280ms]",
        "overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-start gap-3">
        {/* Type icon */}
        <div className="h-9 w-9 rounded-lg bg-accent-soft flex items-center justify-center shrink-0">
          <TypeIcon className="h-4.5 w-4.5 text-accent" />
        </div>

        {/* Title + status */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[14px] font-medium text-text-1 truncate">
              {title}
            </h3>
            <Badge variant={statusConfig.variant} className="shrink-0">
              {StatusIcon && (
                <StatusIcon
                  className={cn(
                    "h-3 w-3 mr-1",
                    statusConfig.spin && "animate-spin"
                  )}
                />
              )}
              {statusConfig.label}
            </Badge>
          </div>

          {/* Recipient */}
          {recipient && (
            <p className="text-[12px] text-text-3 mt-0.5 truncate">
              To: {recipient}
            </p>
          )}
        </div>
      </div>

      {/* Sections count */}
      {sections && sections.length > 0 && (
        <div className="px-4 py-2 border-t border-hairline-2">
          <p className="text-[12px] text-text-3">
            {sections.length} section{sections.length !== 1 ? "s" : ""}
            <span className="text-text-4 ml-1">
              ({sections.slice(0, 3).join(", ")}
              {sections.length > 3 ? ", ..." : ""})
            </span>
          </p>
        </div>
      )}

      {/* Scheduled info */}
      {status === "scheduled" && scheduledFor && (
        <div className="px-4 py-2 border-t border-hairline-2 bg-accent-soft/30">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-accent" />
            <span className="text-[12px] text-accent">
              Scheduled for{" "}
              {typeof scheduledFor === "string"
                ? new Date(scheduledFor).toLocaleString()
                : scheduledFor.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-3 border-t border-hairline flex items-center justify-between gap-3">
        <RelativeTimestamp timestamp={createdAt} prefix="Created" mono />

        {/* Actions */}
        <div className="flex items-center gap-1">
          {status === "generating" ? (
            <div className="flex items-center gap-2 text-[12px] text-text-3">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Processing...</span>
            </div>
          ) : (
            <>
              {onView && (
                <Button variant="ghost" size="sm" onClick={onView}>
                  <Eye className="h-4 w-4" />
                </Button>
              )}
              {onDownload && status === "ready" && (
                <Button variant="ghost" size="sm" onClick={onDownload}>
                  <Download className="h-4 w-4" />
                </Button>
              )}
              {onSend && status === "ready" && (
                <Button variant="ghost" size="sm" onClick={onSend}>
                  <Send className="h-4 w-4" />
                </Button>
              )}
              {onEdit && (status === "draft" || status === "ready") && (
                <Button variant="ghost" size="sm" onClick={onEdit}>
                  <FileEdit className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

ReportPreviewCard.displayName = "ReportPreviewCard";
