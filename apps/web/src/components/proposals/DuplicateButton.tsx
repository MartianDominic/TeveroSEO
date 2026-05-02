"use client";

/**
 * DuplicateButton Component - Clone proposal with options modal.
 * Phase 57-08: Clone + Undo/Redo + Magic Link
 *
 * Features:
 * - Modal with "Keep prospect" checkbox
 * - Name input (default: "Copy of ...")
 * - API call to duplicate endpoint
 * - Navigation to new proposal after success
 */

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Label,
  Checkbox,
} from "@tevero/ui";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DuplicateButtonProps {
  /** Proposal ID to duplicate */
  proposalId: string;
  /** Current proposal name (for default name) */
  proposalName?: string;
  /** Prospect ID if linked */
  prospectId?: string | null;
  /** Additional class names */
  className?: string;
  /** Button variant */
  variant?: "default" | "outline" | "ghost";
  /** Button size */
  size?: "sm" | "default" | "lg";
  /** Show button label */
  showLabel?: boolean;
  /** Callback after successful duplication */
  onDuplicated?: (newProposalId: string) => void;
}

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------

interface DuplicateResponse {
  success: boolean;
  data?: {
    id: string;
    name?: string;
  };
  error?: string;
}

async function duplicateProposal(
  proposalId: string,
  name: string,
  keepProspect: boolean
): Promise<DuplicateResponse> {
  const response = await fetch(`/api/proposals/${proposalId}/duplicate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      keepProspect,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return {
      success: false,
      error: errorData.error || `HTTP ${response.status}`,
    };
  }

  const data = await response.json();
  return { success: true, data };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Button to duplicate a proposal with options modal.
 *
 * @example
 * ```tsx
 * <DuplicateButton
 *   proposalId="prop_123"
 *   proposalName="SEO Proposal for Acme"
 *   prospectId="prosp_456"
 * />
 * ```
 */
export function DuplicateButton({
  proposalId,
  proposalName = "Proposal",
  prospectId,
  className,
  variant = "outline",
  size = "sm",
  showLabel = true,
  onDuplicated,
}: DuplicateButtonProps) {
  const t = useTranslations("proposals.duplicate");
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(`Copy of ${proposalName}`);
  const [keepProspect, setKeepProspect] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        setName(`Copy of ${proposalName}`);
        setKeepProspect(true);
        setError(null);
      }
      setOpen(isOpen);
    },
    [proposalName]
  );

  // Handle duplicate action
  const handleDuplicate = useCallback(async () => {
    if (!name.trim()) {
      setError(t("nameRequired"));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await duplicateProposal(proposalId, name.trim(), keepProspect);

      if (!result.success) {
        setError(result.error || t("duplicateFailed"));
        return;
      }

      const newProposalId = result.data?.id;
      if (newProposalId) {
        setOpen(false);
        onDuplicated?.(newProposalId);

        // Navigate to the new proposal
        router.push(`/proposals/${newProposalId}/edit`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("duplicateFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [proposalId, name, keepProspect, t, router, onDuplicated]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={cn("gap-1.5", className)}
        >
          <Copy className="h-4 w-4" />
          {showLabel && <span>{t("button")}</span>}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Name input */}
          <div className="grid gap-2">
            <Label htmlFor="duplicate-name">{t("nameLabel")}</Label>
            <Input
              id="duplicate-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              disabled={isLoading}
            />
          </div>

          {/* Keep prospect checkbox (only show if prospect exists) */}
          {prospectId && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="keep-prospect"
                checked={keepProspect}
                onCheckedChange={(checked) => setKeepProspect(checked === true)}
                disabled={isLoading}
              />
              <Label
                htmlFor="keep-prospect"
                className="text-sm font-normal cursor-pointer"
              >
                {t("keepProspect")}
              </Label>
            </div>
          )}

          {/* Error message */}
          {error && (
            <p className="text-sm text-error" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isLoading}
          >
            {t("cancel")}
          </Button>
          <Button onClick={handleDuplicate} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("duplicating")}
              </>
            ) : (
              t("confirm")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DuplicateButton;
