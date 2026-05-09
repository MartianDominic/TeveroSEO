/**
 * Platform Guide Component (Placeholder)
 * Phase 66-04: Connection Wizard UI
 *
 * Step-by-step installation guide for each platform.
 * Per DESIGN.md Section 5.2 Screen 4a.
 *
 * Full implementation in Task 3.
 */
"use client";

import * as React from "react";

import Link from "next/link";

import { ChevronLeft, ChevronRight, Copy, Check, ExternalLink } from "lucide-react";

import type { GuideStep } from "@/lib/api/connect";

import { Button, Card, CardContent, cn } from "@tevero/ui";

// ============================================================================
// Types
// ============================================================================

interface Guide {
  platform: string;
  name: string;
  steps: GuideStep[];
  estimatedTime: string;
  difficulty: "easy" | "medium" | "hard";
  paidPlanRequired: boolean;
  fallbackToGtm: boolean;
}

export interface PlatformGuideProps {
  guide?: Guide | null;
  snippet?: string;
  currentStep: number;
  onNext: () => void;
  onBack: () => void;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function PlatformGuide({
  guide,
  snippet,
  currentStep,
  onNext,
  onBack,
  className,
}: PlatformGuideProps) {
  const [copied, setCopied] = React.useState(false);

  if (!guide) {
    return (
      <div className="text-center p-8">
        <p className="text-[var(--text-3)]">Loading guide...</p>
      </div>
    );
  }

  const step = guide.steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === guide.steps.length - 1;

  const handleCopy = async () => {
    if (!step?.code && !snippet) return;

    const codeToCopy = step?.code || snippet || "";
    await navigator.clipboard.writeText(codeToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-semibold text-[var(--text-1)] mb-2">
          Add TeveroSEO to your {guide.name}
        </h2>
        <p className="text-[var(--text-3)]">
          Step {currentStep + 1} of {guide.steps.length}
        </p>
      </div>

      {/* Current Step Card */}
      <Card className="mb-6">
        <CardContent className="p-6">
          {/* Step Number & Title */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-semibold text-sm">
              {step.number}
            </div>
            <h3 className="font-semibold text-[var(--text-1)] text-lg">
              {step.title}
            </h3>
          </div>

          {/* Description */}
          <p className="text-[var(--text-2)] mb-4">
            {step.description}
          </p>

          {/* Screenshot (if available) */}
          {step.screenshot && (
            <div className="mb-4 rounded-[var(--radius)] overflow-hidden border border-[var(--hairline)]">
              <img
                src={step.screenshot}
                alt={`Screenshot for step ${step.number}`}
                className="w-full"
              />
            </div>
          )}

          {/* Code Snippet (if available) */}
          {step.code && (
            <div className="relative mb-4">
              <pre className="bg-[var(--surface-2)] p-4 rounded-[var(--radius)] text-sm overflow-x-auto font-mono text-[var(--text-1)]">
                <code>{step.code}</code>
              </pre>
              <Button
                size="sm"
                variant="secondary"
                className="absolute top-2 right-2"
                onClick={handleCopy}
                data-testid="copy-btn"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Help Links */}
          {step.helpLink && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-[var(--text-3)]">Stuck?</span>
              <a
                href={step.helpLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:underline inline-flex items-center gap-1"
              >
                Watch Video
                <ExternalLink className="w-3 h-3" />
              </a>
              <Link
                href={"/help/chat" as any}
                className="text-[var(--accent)] hover:underline"
              >
                Chat with us
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={onBack}
          disabled={isFirstStep}
          className="text-[var(--text-2)]"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back
        </Button>

        <Button onClick={onNext} data-testid="next-step-btn">
          {isLastStep ? (
            "Verify Installation"
          ) : (
            <>
              I did this
              <ChevronRight className="w-4 h-4 ml-1" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
