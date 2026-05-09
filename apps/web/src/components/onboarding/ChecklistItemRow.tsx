"use client";

import { useState } from "react";

import { Check, Send, Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ChecklistItemRowProps {
  itemId: string;
  checklistId: string;
  label: string;
  category: string;
  completed: boolean;
  autoCompleteEvent?: string | null; // If present and category=credentials, this is a credential item
  onComplete: (itemId: string) => Promise<void>;
  onSendMagicLink: (itemId: string) => Promise<string>; // Returns URL
  onConnectDirectly: (itemId: string) => void; // Triggers OAuth flow
}

/**
 * ChecklistItemRow - Single checklist item with dual-mode actions.
 * Phase 49-51: Onboarding & Agency Dashboard
 *
 * Implements:
 * - D-01: Dual mode for credentials (Send to Client + Connect Myself)
 * - D-03: Manual checkbox for ALL items
 */
export function ChecklistItemRow({
  itemId,
  checklistId,
  label,
  category,
  completed,
  autoCompleteEvent,
  onComplete,
  onSendMagicLink,
  onConnectDirectly,
}: ChecklistItemRowProps) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const isCredentialItem = !!autoCompleteEvent && category === "credentials";

  const handleManualComplete = async () => {
    setLoading(true);
    try {
      await onComplete(itemId);
    } finally {
      setLoading(false);
    }
  };

  const handleSendLink = async () => {
    setLoading(true);
    try {
      const url = await onSendMagicLink(itemId);
      // Copy to clipboard
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3",
        completed
          ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950"
          : "border-border bg-card"
      )}
    >
      {/* Checkbox indicator */}
      <div
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
          completed
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-muted-foreground"
        )}
      >
        {completed && <Check className="h-3 w-3" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-medium",
            completed ? "text-emerald-700 dark:text-emerald-300" : "text-foreground"
          )}
        >
          {label}
        </p>
        {isCredentialItem && !completed && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Requires OAuth connection
          </p>
        )}

        {/* Actions - only show when not completed */}
        {!completed && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {/* D-03: Manual checkbox for ALL items */}
            <Button
              size="sm"
              variant="ghost"
              onClick={handleManualComplete}
              disabled={loading}
              className="h-7 text-xs"
            >
              <Check className="mr-1 h-3 w-3" />
              Mark Complete
            </Button>

            {/* D-01: Credential items get dual mode */}
            {isCredentialItem && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSendLink}
                  disabled={loading}
                  className="h-7 text-xs"
                >
                  <Send className="mr-1 h-3 w-3" />
                  {copied ? "Link Copied!" : "Send to Client"}
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => onConnectDirectly(itemId)}
                  disabled={loading}
                  className="h-7 text-xs"
                >
                  <Link2 className="mr-1 h-3 w-3" />
                  Connect Myself
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
