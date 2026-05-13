/**
 * DocumentCard Component
 * Phase 101: Document Management (D-04)
 *
 * Displays document metadata with engagement stats.
 * Design-system-v6: ghost-edge shadows, hover-to-reveal actions.
 */
"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  FileText,
  FileSpreadsheet,
  Presentation,
  File,
  ExternalLink,
  Eye,
  Clock,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@tevero/ui";
import { Button } from "@tevero/ui";

// ============================================================================
// Types
// ============================================================================

export type DocumentSyncMode = "two_way_sync" | "import_copy" | "link_only";

export interface DocumentData {
  id: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number | null;
  syncMode: DocumentSyncMode;
  viewCount: number;
  lastViewedAt: string | null;
  lastSyncedAt: string | null;
  externalUrl: string | null;
  createdAt: string;
}

interface DocumentCardProps {
  document: DocumentData;
  className?: string;
  onView?: (doc: DocumentData) => void;
  onEdit?: (doc: DocumentData) => void;
  onDelete?: (doc: DocumentData) => void;
  onSync?: (doc: DocumentData) => void;
}

// ============================================================================
// Helpers
// ============================================================================

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return File;

  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) {
    return FileSpreadsheet;
  }
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) {
    return Presentation;
  }
  if (
    mimeType.includes("document") ||
    mimeType.includes("pdf") ||
    mimeType.includes("text")
  ) {
    return FileText;
  }

  return File;
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return "--";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(size < 10 ? 1 : 0)} ${units[unitIndex]}`;
}

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString();
}

function getSyncModeLabel(mode: DocumentSyncMode): string {
  switch (mode) {
    case "two_way_sync":
      return "Synced";
    case "import_copy":
      return "Imported";
    case "link_only":
      return "Linked";
  }
}

function getSyncModeColor(mode: DocumentSyncMode): string {
  switch (mode) {
    case "two_way_sync":
      return "bg-emerald-100 text-emerald-700";
    case "import_copy":
      return "bg-blue-100 text-blue-700";
    case "link_only":
      return "bg-slate-100 text-slate-600";
  }
}

// ============================================================================
// Component
// ============================================================================

export function DocumentCard({
  document,
  className,
  onView,
  onEdit,
  onDelete,
  onSync,
}: DocumentCardProps) {
  const FileIcon = useMemo(
    () => getFileIcon(document.mimeType),
    [document.mimeType]
  );

  return (
    <div
      className={cn(
        // Design-system-v6: ghost-edge shadows, lift on hover
        "group relative rounded-lg bg-surface p-4 transition-all duration-200",
        "shadow-[0_1px_2px_rgba(20,20,26,0.04),0_4px_12px_rgba(20,20,26,0.03)]",
        "hover:shadow-[0_2px_4px_rgba(20,20,26,0.06),0_8px_20px_rgba(20,20,26,0.05)]",
        "hover:-translate-y-0.5",
        className
      )}
    >
      {/* Main Content */}
      <div className="flex items-start gap-3">
        {/* File Icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-2">
          <FileIcon className="h-5 w-5 text-text-3" />
        </div>

        {/* File Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="truncate text-[14px] font-medium text-text-1">
              {document.name}
            </h4>
            {/* Sync Mode Badge */}
            <span
              className={cn(
                "shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide",
                getSyncModeColor(document.syncMode)
              )}
            >
              {getSyncModeLabel(document.syncMode)}
            </span>
          </div>

          {/* Meta Row */}
          <div className="mt-1 flex items-center gap-3 text-[12px] text-text-3">
            <span>{formatFileSize(document.sizeBytes)}</span>
            <span className="text-hairline">|</span>
            <span>Added {formatRelativeTime(document.createdAt)}</span>
          </div>
        </div>

        {/* Actions (hover-to-reveal per design-system-v6) */}
        <div className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onView && (
                <DropdownMenuItem onClick={() => onView(document)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View
                </DropdownMenuItem>
              )}
              {document.externalUrl && (
                <DropdownMenuItem asChild>
                  <a
                    href={document.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open in Drive
                  </a>
                </DropdownMenuItem>
              )}
              {onSync && document.syncMode !== "link_only" && (
                <DropdownMenuItem onClick={() => onSync(document)}>
                  <Clock className="mr-2 h-4 w-4" />
                  Sync Now
                </DropdownMenuItem>
              )}
              {onEdit && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onEdit(document)}>
                    Edit Details
                  </DropdownMenuItem>
                </>
              )}
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(document)}
                    className="text-red-600 focus:text-red-600"
                  >
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Engagement Stats Row */}
      <div className="mt-3 flex items-center gap-4 border-t border-hairline-3 pt-3 text-[12px] text-text-3">
        <div className="flex items-center gap-1">
          <Eye className="h-3.5 w-3.5" />
          <span>
            {document.viewCount} view{document.viewCount !== 1 ? "s" : ""}
          </span>
        </div>
        {document.lastViewedAt && (
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span>Last viewed {formatRelativeTime(document.lastViewedAt)}</span>
          </div>
        )}
        {document.lastSyncedAt && document.syncMode !== "link_only" && (
          <div className="ml-auto flex items-center gap-1">
            <span>Synced {formatRelativeTime(document.lastSyncedAt)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
