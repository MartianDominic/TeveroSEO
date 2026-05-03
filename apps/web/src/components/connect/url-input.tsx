/**
 * URL Input Component
 * Phase 66-04: Connection Wizard UI
 *
 * Screen 1: Let users enter their website URL.
 * Per DESIGN.md Section 5.2 Screen 1.
 */
"use client";

import * as React from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button, Input, cn } from "@tevero/ui";

// ============================================================================
// Types
// ============================================================================

export interface UrlInputProps {
  onSubmit: (url: string) => void;
  isLoading?: boolean;
  initialUrl?: string;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function UrlInput({
  onSubmit,
  isLoading = false,
  initialUrl = "",
  className,
}: UrlInputProps) {
  const [url, setUrl] = React.useState(initialUrl);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Focus input on mount
  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = url.trim();
    if (trimmedUrl) {
      onSubmit(trimmedUrl);
    }
  };

  const isValid = url.trim().length > 0;

  return (
    <div className={cn("flex flex-col items-center px-4", className)}>
      {/* Heading */}
      <h1 className="text-2xl font-semibold text-[var(--text-1)] mb-8 text-center">
        Let's connect your website
      </h1>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-md">
        {/* URL Input with https:// prefix */}
        <div className="flex items-center gap-0 mb-2">
          <span className="flex items-center justify-center px-3 h-10 bg-[var(--surface-2)] border border-r-0 border-[var(--hairline)] rounded-l-[var(--radius-input)] text-[var(--text-3)] text-sm font-medium">
            https://
          </span>
          <Input
            ref={inputRef}
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="mywebsite.com"
            className="flex-1 rounded-l-none h-10"
            disabled={isLoading}
            aria-label="Website URL"
            data-testid="url-input"
          />
        </div>

        {/* Example text */}
        <p className="text-[var(--text-3)] text-sm mb-6">
          Example: mywebsite.com
        </p>

        {/* Submit button */}
        <Button
          type="submit"
          disabled={!isValid || isLoading}
          className="w-full"
          data-testid="continue-btn"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </form>

      {/* Reassurance text */}
      <p className="text-[var(--text-4)] text-xs mt-8 text-center max-w-sm">
        This is completely safe. We just need to check what platform your
        website uses so we can give you the right instructions.
      </p>
    </div>
  );
}
