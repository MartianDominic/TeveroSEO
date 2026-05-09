/**
 * Connection Step Indicator Component
 * Phase 66-04: Connection Wizard UI
 *
 * Shows progress through the connection wizard.
 */
"use client";

import * as React from "react";

import { Check } from "lucide-react";

import type { WizardStep } from "@/hooks/use-connection-wizard";

import { cn } from "@tevero/ui";

// ============================================================================
// Types
// ============================================================================

export interface ConnectionStepIndicatorProps {
  currentStep: WizardStep;
  className?: string;
}

// ============================================================================
// Step Configuration
// ============================================================================

interface StepConfig {
  id: string;
  label: string;
  ariaLabel: string;
}

const STEPS: StepConfig[] = [
  { id: "url", label: "1", ariaLabel: "URL" },
  { id: "detect", label: "2", ariaLabel: "Detect" },
  { id: "choose", label: "3", ariaLabel: "Choose" },
  { id: "install", label: "4", ariaLabel: "Install" },
];

// Map wizard steps to step index
const STEP_INDEX: Record<WizardStep, number> = {
  url: 0,
  detecting: 1,
  choice: 2,
  diy: 3,
  developer: 3,
  oauth: 3,
  verifying: 3,
  success: 4, // Past the last step
  error: -1,
};

// ============================================================================
// Component
// ============================================================================

export function ConnectionStepIndicator({
  currentStep,
  className,
}: ConnectionStepIndicatorProps) {
  const currentIndex = STEP_INDEX[currentStep] ?? 0;

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2",
        className
      )}
      role="navigation"
      aria-label="Connection wizard progress"
    >
      {STEPS.map((step, index) => {
        const isComplete = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <React.Fragment key={step.id}>
            {/* Step dot */}
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center",
                "text-sm font-medium transition-all duration-200",
                isComplete && "bg-[var(--success)] text-white",
                isCurrent && "bg-[var(--accent)] text-white",
                !isComplete && !isCurrent && "bg-[var(--surface-2)] text-[var(--text-3)] border border-[var(--hairline)]"
              )}
              aria-label={step.ariaLabel}
              data-current={isCurrent ? "true" : undefined}
              data-complete={isComplete ? "true" : undefined}
            >
              {isComplete ? (
                <Check className="w-4 h-4" data-testid="step-checkmark" />
              ) : (
                step.label
              )}
            </div>

            {/* Connector line */}
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  "w-8 h-0.5 rounded-full transition-colors duration-200",
                  index < currentIndex
                    ? "bg-[var(--success)]"
                    : "bg-[var(--surface-3)]"
                )}
                data-connector="true"
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
