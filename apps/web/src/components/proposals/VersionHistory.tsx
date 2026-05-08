/**
 * VersionHistory Component - Sidebar panel for version history
 * Phase 57-06: Auto-Save + Version History
 */
"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  History,
  RotateCcw,
  Eye,
  ChevronRight,
  FileEdit,
  Move,
  Plus,
  Sparkles,
  RotateCw,
  File,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@tevero/ui";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Change type icons
const CHANGE_TYPE_ICONS = {
  content_edit: FileEdit,
  section_reorder: Move,
  section_add: Plus,
  section_delete: File,
  ai_generated: Sparkles,
  restore: RotateCw,
  initial: File,
} as const;

// Change type colors
const CHANGE_TYPE_COLORS = {
  content_edit: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  section_reorder:
    "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  section_add:
    "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  section_delete: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  ai_generated:
    "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  restore: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
  initial: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
} as const;

type ChangeType = keyof typeof CHANGE_TYPE_ICONS;

export interface VersionItem {
  id: string;
  versionNumber: number;
  changeType: ChangeType;
  changeDescription: string | null;
  changeDescriptionEn: string | null;
  changeDescriptionLt: string | null;
  changedSections: string[] | null;
  createdBy: string | null;
  createdAt: string | Date;
}

export interface VersionHistoryProps {
  /** Proposal ID */
  proposalId: string;
  /** List of versions */
  versions: VersionItem[];
  /** Whether versions are loading */
  isLoading?: boolean;
  /** Current version number (highlighted) */
  currentVersionNumber?: number;
  /** Called when preview clicked */
  onPreview?: (version: VersionItem) => void;
  /** Called when restore confirmed */
  onRestore?: (version: VersionItem) => Promise<void>;
  /** Whether restore is in progress */
  isRestoring?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Format relative time for version timestamp
 */
function formatRelativeTime(date: Date | string, locale: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (diffSec < 60) {
    return rtf.format(-diffSec, "second");
  } else if (diffMin < 60) {
    return rtf.format(-diffMin, "minute");
  } else if (diffHour < 24) {
    return rtf.format(-diffHour, "hour");
  } else if (diffDay < 7) {
    return rtf.format(-diffDay, "day");
  } else {
    return d.toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
      year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }
}

/**
 * Get localized change description
 */
function getChangeDescription(
  version: VersionItem,
  locale: string,
  t: (key: string) => string
): string {
  // Try localized description first
  if (locale === "lt" && version.changeDescriptionLt) {
    return version.changeDescriptionLt;
  }
  if (version.changeDescriptionEn) {
    return version.changeDescriptionEn;
  }
  if (version.changeDescription) {
    return version.changeDescription;
  }

  // Fallback to change type label
  return t(`changeTypes.${version.changeType}`);
}

/**
 * Version history sidebar panel
 */
export function VersionHistory({
  proposalId,
  versions,
  isLoading = false,
  currentVersionNumber,
  onPreview,
  onRestore,
  isRestoring = false,
  className,
}: VersionHistoryProps) {
  const t = useTranslations("proposals.versionHistory");
  const locale = typeof window !== "undefined" ? navigator.language : "en";

  const [restoreTarget, setRestoreTarget] = useState<VersionItem | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleRestoreConfirm = useCallback(async () => {
    if (restoreTarget && onRestore) {
      await onRestore(restoreTarget);
      setRestoreTarget(null);
    }
  }, [restoreTarget, onRestore]);

  // Render version item
  const renderVersionItem = (version: VersionItem) => {
    const Icon = CHANGE_TYPE_ICONS[version.changeType] || FileEdit;
    const colorClass = CHANGE_TYPE_COLORS[version.changeType] || "";
    const isCurrent = version.versionNumber === currentVersionNumber;
    const description = getChangeDescription(version, locale, t);
    const relativeTime = formatRelativeTime(version.createdAt, locale);

    return (
      <div
        key={version.id}
        className={cn(
          "group relative rounded-lg border p-3 transition-colors",
          isCurrent
            ? "border-primary bg-primary/5"
            : "border-transparent hover:border-border hover:bg-accent/50"
        )}
      >
        {/* Current indicator */}
        {isCurrent && (
          <Badge
            variant="secondary"
            className="absolute -top-2 right-2 text-xs-safe"
          >
            {t("current")}
          </Badge>
        )}

        <div className="flex items-start gap-3">
          {/* Change type icon */}
          <div className={cn("rounded-md p-1.5", colorClass)}>
            <Icon className="h-4 w-4" />
          </div>

          {/* Version info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">
                {t("version")} {version.versionNumber}
              </span>
              <span className="text-xs-safe text-text-3">{relativeTime}</span>
            </div>

            <p className="text-sm text-text-2 truncate mt-0.5">{description}</p>

            {/* Changed sections */}
            {version.changedSections && version.changedSections.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {version.changedSections.slice(0, 3).map((section) => (
                  <Badge
                    key={section}
                    variant="outline"
                    className="text-xs-safe px-1.5 py-0"
                  >
                    {section}
                  </Badge>
                ))}
                {version.changedSections.length > 3 && (
                  <Badge
                    variant="outline"
                    className="text-xs-safe px-1.5 py-0"
                  >
                    +{version.changedSections.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onPreview && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => onPreview(version)}
                title={t("preview")}
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
            )}

            {onRestore && !isCurrent && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setRestoreTarget(version)}
                disabled={isRestoring}
                title={t("restore")}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render loading skeleton
  const renderSkeleton = () => (
    <div className="space-y-3 p-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="h-8 w-8 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className={cn("gap-2", className)}>
            <History className="h-4 w-4" />
            {t("title")}
            {versions.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {versions.length}
              </Badge>
            )}
            <ChevronRight className="h-4 w-4 ml-auto" />
          </Button>
        </SheetTrigger>

        <SheetContent className="w-[400px] sm:w-[450px] p-0">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              {t("title")}
            </SheetTitle>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-60px)]">
            {isLoading ? (
              renderSkeleton()
            ) : versions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center p-4">
                <History className="h-10 w-10 text-text-3 mb-2" />
                <p className="text-sm text-text-2">{t("empty")}</p>
                <p className="text-xs-safe text-text-3 mt-1">{t("emptyHint")}</p>
              </div>
            ) : (
              <div className="space-y-2 p-4">
                {versions.map(renderVersionItem)}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Restore confirmation dialog */}
      <AlertDialog
        open={!!restoreTarget}
        onOpenChange={(open: boolean) => !open && setRestoreTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("restoreConfirm.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("restoreConfirm.description", {
                version: restoreTarget?.versionNumber ?? 0,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRestoring}>
              {t("restoreConfirm.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestoreConfirm}
              disabled={isRestoring}
            >
              {isRestoring ? t("restoreConfirm.restoring") : t("restoreConfirm.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
