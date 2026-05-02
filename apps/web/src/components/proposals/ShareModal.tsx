"use client";

/**
 * ShareModal Component - Magic link generation and sharing UI.
 * Phase 57-08: Clone + Undo/Redo + Magic Link
 *
 * Features:
 * - Display generated magic link
 * - Copy button with success toast
 * - Link expiry display (30 days)
 * - Regenerate button (invalidates previous)
 * - Share buttons: Email, WhatsApp, Copy
 */

import { useState, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Share2,
  Copy,
  Check,
  RefreshCw,
  Mail,
  MessageCircle,
  Loader2,
  ExternalLink,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@tevero/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@tevero/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShareModalProps {
  /** Proposal ID */
  proposalId: string;
  /** Proposal name (for share text) */
  proposalName?: string;
  /** Existing link data if already generated */
  existingLink?: {
    url: string;
    expiresAt: Date;
  } | null;
  /** Additional class names */
  className?: string;
  /** Button variant */
  variant?: "default" | "outline" | "ghost";
  /** Button size */
  size?: "sm" | "default" | "lg";
  /** Show button label */
  showLabel?: boolean;
  /** Callback when link is generated/regenerated */
  onLinkGenerated?: (url: string, expiresAt: Date) => void;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

interface LinkResponse {
  success: boolean;
  data?: {
    url: string;
    token: string;
    expiresAt: string;
  };
  error?: string;
}

async function generateMagicLink(proposalId: string): Promise<LinkResponse> {
  const response = await fetch(`/api/proposals/${proposalId}/link`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
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

async function regenerateMagicLink(proposalId: string): Promise<LinkResponse> {
  const response = await fetch(`/api/proposals/${proposalId}/link`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ regenerate: true }),
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
// Helper functions
// ---------------------------------------------------------------------------

function formatExpiryDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getDaysUntilExpiry(expiresAt: Date): number {
  const now = new Date();
  const diff = expiresAt.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Modal for generating and sharing magic links.
 *
 * @example
 * ```tsx
 * <ShareModal
 *   proposalId="prop_123"
 *   proposalName="SEO Proposal for Acme"
 * />
 * ```
 */
export function ShareModal({
  proposalId,
  proposalName = "Proposal",
  existingLink,
  className,
  variant = "outline",
  size = "sm",
  showLabel = true,
  onLinkGenerated,
}: ShareModalProps) {
  const t = useTranslations("proposals.share");

  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<string | null>(existingLink?.url ?? null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(
    existingLink?.expiresAt ?? null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get locale for date formatting
  const locale =
    typeof window !== "undefined" ? navigator.language : "en";

  // Generate link on first open if not exists
  useEffect(() => {
    if (open && !link && !isLoading) {
      handleGenerateLink();
    }
  }, [open, link, isLoading]);

  // Generate new magic link
  const handleGenerateLink = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await generateMagicLink(proposalId);

      if (!result.success) {
        setError(result.error || t("generateFailed"));
        return;
      }

      if (result.data) {
        setLink(result.data.url);
        const expiry = new Date(result.data.expiresAt);
        setExpiresAt(expiry);
        onLinkGenerated?.(result.data.url, expiry);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("generateFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [proposalId, t, onLinkGenerated]);

  // Regenerate link (invalidates previous)
  const handleRegenerateLink = useCallback(async () => {
    setIsRegenerating(true);
    setError(null);

    try {
      const result = await regenerateMagicLink(proposalId);

      if (!result.success) {
        setError(result.error || t("regenerateFailed"));
        return;
      }

      if (result.data) {
        setLink(result.data.url);
        const expiry = new Date(result.data.expiresAt);
        setExpiresAt(expiry);
        onLinkGenerated?.(result.data.url, expiry);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("regenerateFailed"));
    } finally {
      setIsRegenerating(false);
    }
  }, [proposalId, t, onLinkGenerated]);

  // Copy link to clipboard
  const handleCopyLink = useCallback(async () => {
    if (!link) return;

    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError(t("copyFailed"));
    }
  }, [link, t]);

  // Share via email
  const handleShareEmail = useCallback(() => {
    if (!link) return;

    const subject = encodeURIComponent(t("emailSubject", { name: proposalName }));
    const body = encodeURIComponent(
      t("emailBody", { name: proposalName, link })
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  }, [link, proposalName, t]);

  // Share via WhatsApp
  const handleShareWhatsApp = useCallback(() => {
    if (!link) return;

    const text = encodeURIComponent(
      t("whatsappText", { name: proposalName, link })
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }, [link, proposalName, t]);

  // Open link in new tab
  const handleOpenLink = useCallback(() => {
    if (!link) return;
    window.open(link, "_blank");
  }, [link]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={cn("gap-1.5", className)}
        >
          <Share2 className="h-4 w-4" />
          {showLabel && <span>{t("button")}</span>}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Loading state */}
          {isLoading && !link && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-text-3" />
              <span className="ml-2 text-text-3">{t("generating")}</span>
            </div>
          )}

          {/* Link display */}
          {link && (
            <>
              {/* Link input with copy button */}
              <div className="grid gap-2">
                <Label htmlFor="share-link">{t("linkLabel")}</Label>
                <div className="flex gap-2">
                  <Input
                    id="share-link"
                    value={link}
                    readOnly
                    className="flex-1 font-mono text-sm"
                  />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={handleCopyLink}
                          className={cn(
                            "shrink-0",
                            copied && "text-success border-success"
                          )}
                        >
                          {copied ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {copied ? t("copied") : t("copyLink")}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              {/* Expiry info */}
              {expiresAt && (
                <div className="flex items-center gap-2 text-sm text-text-3">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {t("expiresIn", { days: getDaysUntilExpiry(expiresAt) })}
                  </span>
                  <span className="text-text-4">
                    ({formatExpiryDate(expiresAt, locale)})
                  </span>
                </div>
              )}

              {/* Share buttons */}
              <div className="grid gap-2">
                <Label>{t("shareVia")}</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleShareEmail}
                    className="gap-1.5"
                  >
                    <Mail className="h-4 w-4" />
                    {t("email")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleShareWhatsApp}
                    className="gap-1.5"
                  >
                    <MessageCircle className="h-4 w-4" />
                    {t("whatsapp")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenLink}
                    className="gap-1.5"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t("openLink")}
                  </Button>
                </div>
              </div>

              {/* Regenerate button */}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <p className="text-sm text-text-3">{t("regenerateNote")}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRegenerateLink}
                  disabled={isRegenerating}
                  className="gap-1.5"
                >
                  {isRegenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {t("regenerate")}
                </Button>
              </div>
            </>
          )}

          {/* Error message */}
          {error && (
            <p className="text-sm text-error" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ShareModal;
