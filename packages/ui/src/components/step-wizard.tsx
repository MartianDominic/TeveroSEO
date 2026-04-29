"use client";

import * as React from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./button";

/**
 * Individual wizard step configuration
 */
export interface WizardStep {
  id: string;
  title: string;
  description?: string;
  isOptional?: boolean;
  isComplete?: boolean;
}

/**
 * Props for StepWizard component
 */
export interface StepWizardProps {
  steps: WizardStep[];
  currentStep: number;
  onStepChange: (step: number) => void;
  onComplete: () => void;
  onCancel?: () => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * Context for wizard compound components
 */
interface WizardContextValue {
  steps: WizardStep[];
  currentStep: number;
  onStepChange: (step: number) => void;
  onComplete: () => void;
  onCancel?: () => void;
}

const WizardContext = React.createContext<WizardContextValue | null>(null);

function useWizardContext() {
  const context = React.useContext(WizardContext);
  if (!context) {
    throw new Error("Wizard components must be used within StepWizard");
  }
  return context;
}

/**
 * StepWizard.Header - Progress indicator showing steps
 */
function WizardHeader({ className }: { className?: string }) {
  const { steps, currentStep } = useWizardContext();

  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      {steps.map((step, index) => {
        const isCompleted = step.isComplete || index < currentStep;
        const isCurrent = index === currentStep;
        const isPending = !isCompleted && !isCurrent;

        return (
          <React.Fragment key={step.id}>
            {/* Step dot */}
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex items-center justify-center",
                  "w-8 h-8 rounded-full",
                  "text-sm font-medium",
                  "transition-all duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
                  isCompleted && "bg-success text-white",
                  isCurrent && "bg-accent text-white",
                  isPending && "bg-surface-2 text-text-4 border border-[var(--hairline)]"
                )}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              {/* Step title - visible on larger screens */}
              <span
                className={cn(
                  "hidden sm:block text-[length:var(--type-tiny)]",
                  "tracking-[0.06em] [font-variant-caps:all-small-caps]",
                  isCurrent && "text-text-1 font-medium",
                  !isCurrent && "text-text-3"
                )}
              >
                {step.title}
              </span>
            </div>

            {/* Connector line between steps */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "w-8 h-0.5 rounded-full",
                  "transition-colors duration-[280ms]",
                  index < currentStep ? "bg-success" : "bg-surface-3"
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

WizardHeader.displayName = "StepWizard.Header";

/**
 * StepWizard.Content - Container for step content
 */
function WizardContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-h-[200px] py-[var(--space-6)]",
        className
      )}
    >
      {children}
    </div>
  );
}

WizardContent.displayName = "StepWizard.Content";

/**
 * StepWizard.Footer - Navigation buttons
 */
function WizardFooter({ className }: { className?: string }) {
  const { steps, currentStep, onStepChange, onComplete, onCancel } =
    useWizardContext();

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const currentStepData = steps[currentStep];

  const handleBack = () => {
    if (!isFirstStep) {
      onStepChange(currentStep - 1);
    }
  };

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      onStepChange(currentStep + 1);
    }
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between",
        "pt-[var(--space-5)] border-t border-[var(--hairline)]",
        className
      )}
    >
      <div>
        {isFirstStep && onCancel ? (
          <Button
            variant="ghost"
            onClick={onCancel}
            className="text-text-3 hover:text-text-1"
          >
            Cancel
          </Button>
        ) : (
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={isFirstStep}
            className="text-text-2 hover:text-text-1"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {currentStepData?.isOptional && !isLastStep && (
          <Button
            variant="ghost"
            onClick={() => onStepChange(currentStep + 1)}
            className="text-text-3 hover:text-text-1"
          >
            Skip
          </Button>
        )}
        <Button onClick={handleNext}>
          {isLastStep ? (
            "Complete"
          ) : (
            <>
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

WizardFooter.displayName = "StepWizard.Footer";

/**
 * A multi-step wizard component with progress indicator and navigation.
 * Uses v6 design tokens and compound component pattern.
 */
function StepWizardRoot({
  steps,
  currentStep,
  onStepChange,
  onComplete,
  onCancel,
  children,
  className,
}: StepWizardProps) {
  const contextValue: WizardContextValue = {
    steps,
    currentStep,
    onStepChange,
    onComplete,
    onCancel,
  };

  return (
    <WizardContext.Provider value={contextValue}>
      <div
        className={cn(
          "bg-surface rounded-[var(--radius-card)] shadow-card",
          "p-[var(--space-6)]",
          className
        )}
      >
        {children}
      </div>
    </WizardContext.Provider>
  );
}

StepWizardRoot.displayName = "StepWizard";

// Export compound component
export const StepWizard = Object.assign(StepWizardRoot, {
  Header: WizardHeader,
  Content: WizardContent,
  Footer: WizardFooter,
});

export type { WizardStep as StepWizardStep };
