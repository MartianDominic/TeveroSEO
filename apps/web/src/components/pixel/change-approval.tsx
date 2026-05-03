"use client";

/**
 * ChangeApproval Component
 * Phase 66-07: DOM Change Approval System
 *
 * Full-screen or modal view for reviewing a single DOM change.
 * Shows before/after diff preview with syntax highlighting.
 *
 * Provides approve/reject actions with rejection reason input.
 */

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle2,
  XCircle,
  ArrowLeft,
  FileText,
  Link2,
  Code,
  Type,
  FileCode,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Separator,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@tevero/ui";

// ============================================================================
// Types
// ============================================================================

export interface ChangeForApproval {
  id: string;
  changeType: "meta_title" | "meta_description" | "canonical" | "schema" | "internal_link" | "content";
  targetSelector?: string | null;
  targetUrl?: string | null;
  oldValue?: string | null;
  newValue: string;
  status: string;
  createdAt: Date | string;
}

export interface ChangeApprovalProps {
  /** Change to review */
  change: ChangeForApproval;
  /** Loading state for actions */
  isLoading?: boolean;
  /** Called when user approves the change */
  onApprove: (changeId: string) => void;
  /** Called when user rejects the change with optional reason */
  onReject: (changeId: string, reason?: string) => void;
  /** Called when user wants to go back */
  onBack: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const CHANGE_TYPE_CONFIG: Record<
  ChangeForApproval["changeType"],
  { label: string; icon: typeof FileText; description: string }
> = {
  meta_title: {
    label: "Meta Title",
    icon: Type,
    description: "The page title shown in browser tabs and search results",
  },
  meta_description: {
    label: "Meta Description",
    icon: FileText,
    description: "The description snippet shown in search results",
  },
  canonical: {
    label: "Canonical URL",
    icon: Link2,
    description: "The preferred URL for this page (SEO best practice)",
  },
  schema: {
    label: "Schema Markup",
    icon: Code,
    description: "Structured data for rich search results",
  },
  internal_link: {
    label: "Internal Link",
    icon: ExternalLink,
    description: "Link to another page on your website",
  },
  content: {
    label: "Content Block",
    icon: FileCode,
    description: "HTML content to inject on the page",
  },
};

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Diff view showing old vs new value.
 */
function DiffView({
  oldValue,
  newValue,
  changeType,
}: {
  oldValue?: string | null;
  newValue: string;
  changeType: ChangeForApproval["changeType"];
}) {
  const isJson = changeType === "schema";

  // Format JSON for schema type
  const formatValue = (value: string | null | undefined): string => {
    if (!value) return "(no previous value)";
    if (isJson) {
      try {
        return JSON.stringify(JSON.parse(value), null, 2);
      } catch {
        return value;
      }
    }
    return value;
  };

  const formattedOld = formatValue(oldValue);
  const formattedNew = formatValue(newValue);

  return (
    <Tabs defaultValue="side-by-side" className="w-full">
      <TabsList className="grid w-full grid-cols-2 mb-4">
        <TabsTrigger value="side-by-side">Side by Side</TabsTrigger>
        <TabsTrigger value="unified">Unified</TabsTrigger>
      </TabsList>

      <TabsContent value="side-by-side" className="space-y-0">
        <div className="grid grid-cols-2 gap-4">
          {/* Old Value */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200">
                Before
              </Badge>
            </div>
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4 min-h-[120px]">
              <pre className={`text-sm whitespace-pre-wrap break-words ${isJson ? "font-mono" : ""}`}>
                {formattedOld}
              </pre>
            </div>
          </div>

          {/* New Value */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">
                After
              </Badge>
            </div>
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4 min-h-[120px]">
              <pre className={`text-sm whitespace-pre-wrap break-words ${isJson ? "font-mono" : ""}`}>
                {formattedNew}
              </pre>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="unified" className="space-y-4">
        {/* Old Value */}
        {oldValue && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary" className="bg-red-100 text-red-800">
                Removed
              </Badge>
            </div>
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <pre className={`text-sm whitespace-pre-wrap break-words line-through text-red-700 ${isJson ? "font-mono" : ""}`}>
                {formattedOld}
              </pre>
            </div>
          </div>
        )}

        {/* New Value */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              Added
            </Badge>
          </div>
          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <pre className={`text-sm whitespace-pre-wrap break-words text-green-700 ${isJson ? "font-mono" : ""}`}>
              {formattedNew}
            </pre>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}

/**
 * Meta preview for title and description changes.
 */
function MetaPreview({
  changeType,
  newValue,
  targetUrl,
}: {
  changeType: ChangeForApproval["changeType"];
  newValue: string;
  targetUrl?: string | null;
}) {
  if (changeType !== "meta_title" && changeType !== "meta_description") {
    return null;
  }

  return (
    <div className="mt-6">
      <h4 className="text-sm font-medium text-foreground mb-3">
        Search Result Preview
      </h4>
      <div className="bg-white dark:bg-slate-900 border rounded-lg p-4 max-w-xl">
        <p className="text-blue-600 dark:text-blue-400 text-lg hover:underline cursor-pointer truncate">
          {changeType === "meta_title" ? newValue : "Page Title"}
        </p>
        <p className="text-green-700 dark:text-green-500 text-sm truncate">
          {targetUrl || "https://example.com/page"}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
          {changeType === "meta_description" ? newValue : "Meta description will appear here..."}
        </p>
      </div>
    </div>
  );
}

/**
 * Rejection dialog with reason input.
 */
function RejectDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isLoading?: boolean;
}) {
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    onConfirm(reason);
    setReason("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Reject Change
          </DialogTitle>
          <DialogDescription>
            This change will not be applied to your website.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              placeholder="Why are you rejecting this change?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Rejecting..." : "Reject Change"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ChangeApproval({
  change,
  isLoading = false,
  onApprove,
  onReject,
  onBack,
}: ChangeApprovalProps) {
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const config = CHANGE_TYPE_CONFIG[change.changeType];
  const Icon = config.icon;

  const createdAt = typeof change.createdAt === "string"
    ? new Date(change.createdAt)
    : change.createdAt;

  const handleReject = (reason: string) => {
    onReject(change.id, reason);
    setShowRejectDialog(false);
  };

  return (
    <>
      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="mb-4 -ml-2 gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to pending changes
          </Button>

          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
                  <Icon className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-foreground">
                    {config.label}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {config.description}
                  </p>
                </div>
              </div>
            </div>

            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
              Pending Review
            </Badge>
          </div>
        </div>

        {/* Change Details Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Change Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Target URL</p>
                <p className="text-sm font-medium">
                  {change.targetUrl || "All pages (global)"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Requested</p>
                <p className="text-sm font-medium">
                  {formatDistanceToNow(createdAt, { addSuffix: true })}
                </p>
              </div>
              {change.targetSelector && (
                <div className="sm:col-span-2">
                  <p className="text-sm text-muted-foreground">CSS Selector</p>
                  <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                    {change.targetSelector}
                  </code>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Diff Preview */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Preview Changes</CardTitle>
            <CardDescription>
              Compare the current value with the proposed change
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DiffView
              oldValue={change.oldValue}
              newValue={change.newValue}
              changeType={change.changeType}
            />

            <MetaPreview
              changeType={change.changeType}
              newValue={change.newValue}
              targetUrl={change.targetUrl}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4">
          <Button
            variant="outline"
            onClick={() => setShowRejectDialog(true)}
            disabled={isLoading}
            className="gap-2"
          >
            <XCircle className="h-4 w-4" />
            Reject
          </Button>

          <Button
            onClick={() => onApprove(change.id)}
            disabled={isLoading}
            className="gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isLoading ? "Approving..." : "Approve & Deploy"}
          </Button>
        </div>
      </div>

      <RejectDialog
        isOpen={showRejectDialog}
        onClose={() => setShowRejectDialog(false)}
        onConfirm={handleReject}
        isLoading={isLoading}
      />
    </>
  );
}
