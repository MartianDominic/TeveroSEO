/**
 * Connection Choice Component
 * Phase 66-04: Connection Wizard UI
 *
 * Screen 3: Three connection paths (DIY, Developer, OAuth).
 * Per DESIGN.md Section 5.2 Screen 3.
 */
"use client";

import * as React from "react";
import { Rocket, Mail, Key, ArrowRight } from "lucide-react";
import { Card, CardContent, Button, cn } from "@tevero/ui";
import type { ConnectionPath } from "@/hooks/use-connection-wizard";

// ============================================================================
// Types
// ============================================================================

export interface ConnectionChoiceProps {
  onSelect: (path: ConnectionPath) => void;
  platformName?: string;
  showOAuth?: boolean;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function ConnectionChoice({
  onSelect,
  platformName,
  showOAuth = true,
  className,
}: ConnectionChoiceProps) {
  return (
    <div className={cn("flex flex-col items-center px-4", className)}>
      {/* Heading */}
      <h2 className="text-2xl font-semibold text-[var(--text-1)] mb-8 text-center">
        How would you like to connect?
      </h2>

      {/* Options */}
      <div className="w-full max-w-md space-y-4">
        {/* DIY Option */}
        <Card
          className={cn(
            "cursor-pointer transition-all duration-200",
            "hover:shadow-card-hover hover:border-[var(--accent)]"
          )}
          onClick={() => onSelect("diy")}
          data-testid="diy-option"
        >
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-[var(--accent-soft)] flex items-center justify-center shrink-0">
                <Rocket className="w-5 h-5 text-[var(--accent)]" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-[var(--text-1)] mb-1">
                  I&apos;ll do it myself
                </h3>
                <p className="text-[var(--text-3)] text-sm mb-3">
                  Takes about 2 minutes. We&apos;ll guide you step by step with
                  pictures.
                </p>
                <Button size="sm" aria-label="Start setup">
                  Start Setup
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Developer Handoff Option */}
        <Card
          className={cn(
            "cursor-pointer transition-all duration-200",
            "hover:shadow-card-hover hover:border-[var(--accent)]"
          )}
          onClick={() => onSelect("developer")}
          data-testid="developer-option"
        >
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-[var(--surface-2)] flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5 text-[var(--text-2)]" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-[var(--text-1)] mb-1">
                  Send to my tech person
                </h3>
                <p className="text-[var(--text-3)] text-sm mb-3">
                  We&apos;ll email them simple instructions. Usually done in 30
                  seconds.
                </p>
                <Button size="sm" variant="secondary" aria-label="Send instructions">
                  Send Instructions
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* OAuth Option (conditional) */}
        {showOAuth && (
          <Card
            className={cn(
              "cursor-pointer transition-all duration-200",
              "hover:shadow-card-hover hover:border-[var(--accent)]"
            )}
            onClick={() => onSelect("oauth")}
            data-testid="oauth-option"
          >
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[var(--surface-2)] flex items-center justify-center shrink-0">
                  <Key className="w-5 h-5 text-[var(--text-2)]" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-[var(--text-1)] mb-1">
                    I have developer access (OAuth)
                  </h3>
                  <p className="text-[var(--text-3)] text-sm mb-3">
                    Connect directly via {platformName || "your platform"}&apos;s app
                    system for extra features like publishing.
                  </p>
                  <Button size="sm" variant="secondary" aria-label="Connect with OAuth">
                    Connect with OAuth
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Help text */}
      <p className="text-[var(--text-4)] text-xs mt-6 text-center">
        Not sure? Start with &quot;I&apos;ll do it myself&quot; - it&apos;s the easiest option.
      </p>
    </div>
  );
}
