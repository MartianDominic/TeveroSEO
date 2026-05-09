"use client";

import { useState } from "react";

import { Copy, Mail, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface MagicLinkButtonProps {
  checklistId: string;
  itemId: string;
  clientEmail?: string;
  onGenerateLink: () => Promise<string>;
  className?: string;
}

/**
 * MagicLinkButton - Standalone component for generating and sharing magic links.
 * Phase 49-51: Onboarding & Agency Dashboard
 *
 * Features:
 * - Generate magic link on click
 * - Copy to clipboard
 * - Email option (mailto: with pre-filled body)
 */
export function MagicLinkButton({
  checklistId,
  itemId,
  clientEmail,
  onGenerateLink,
  className,
}: MagicLinkButtonProps) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const url = await onGenerateLink();
      setGeneratedUrl(url);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (generatedUrl) {
      await navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (generatedUrl) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <code className="truncate max-w-[200px] rounded bg-muted px-2 py-1 text-xs">
          {generatedUrl}
        </code>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleCopy}
          className="h-7 w-7"
        >
          {copied ? (
            <Check className="h-4 w-4 text-emerald-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
        {clientEmail && (
          <Button size="icon" variant="ghost" asChild className="h-7 w-7">
            <a
              href={`mailto:${clientEmail}?subject=Complete%20Your%20Onboarding&body=${encodeURIComponent(generatedUrl)}`}
            >
              <Mail className="h-4 w-4" />
            </a>
          </Button>
        )}
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleGenerate}
      disabled={loading}
      className={className}
    >
      {loading ? "Generating..." : "Send to Client"}
    </Button>
  );
}
