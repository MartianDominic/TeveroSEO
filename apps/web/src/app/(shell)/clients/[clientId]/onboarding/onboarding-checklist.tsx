"use client";

/**
 * OnboardingChecklist Component
 * Phase 51-02: Onboarding Checklist
 *
 * Client component for displaying and completing onboarding checklist items.
 * Handles completion state and redirects to complete page on 100% completion.
 * MEDIUM-02 FIX: Added error feedback with retry option.
 */

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Check, Circle, Loader2, AlertCircle, RefreshCw } from "lucide-react";

import type { ChecklistItem } from "@/lib/api/clients";

import { Card, CardContent, ProgressBar, Button } from "@tevero/ui";

import { completeChecklistItem } from "./actions";

interface OnboardingChecklistProps {
  checklistId: string;
  clientId: string;
  items: ChecklistItem[];
  completedCount: number;
  totalCount: number;
  serviceTier: string;
}

export function OnboardingChecklist({
  checklistId,
  clientId,
  items: initialItems,
  completedCount: initialCompleted,
  totalCount,
  serviceTier,
}: OnboardingChecklistProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [completedCount, setCompletedCount] = useState(initialCompleted);
  const [completingItemId, setCompletingItemId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // MEDIUM-02 FIX: Track error state for failed completions
  const [errorItemId, setErrorItemId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const progress = Math.round((completedCount / totalCount) * 100);

  // Group items by category
  const groupedItems = items.reduce(
    (acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    },
    {} as Record<string, ChecklistItem[]>
  );

  const categoryOrder = ["setup", "credentials", "kickoff", "content"];
  const categoryLabels: Record<string, string> = {
    setup: "Setup",
    credentials: "Connect Services",
    kickoff: "Kickoff",
    content: "Content",
  };

  const handleComplete = async (itemId: string) => {
    setCompletingItemId(itemId);
    // Clear any previous error
    setErrorItemId(null);
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const result = await completeChecklistItem(checklistId, itemId);

        if (result.success) {
          // Update local state
          setItems((prev) =>
            prev.map((item) =>
              item.id === itemId
                ? { ...item, completedAt: new Date().toISOString() }
                : item
            )
          );
          setCompletedCount((prev) => prev + 1);

          // If conversion happened, redirect to complete page
          if (result.conversionSummary) {
            router.push(`/clients/${clientId}/onboarding/complete` as never);
          } else {
            router.refresh();
          }
        } else {
          // MEDIUM-02 FIX: Show error feedback
          setErrorItemId(itemId);
          setErrorMessage(result.error ?? "Failed to complete item");
        }
      } catch (err) {
        // MEDIUM-02 FIX: Handle unexpected errors
        setErrorItemId(itemId);
        setErrorMessage(
          err instanceof Error ? err.message : "An unexpected error occurred"
        );
      } finally {
        setCompletingItemId(null);
      }
    });
  };

  const handleRetry = (itemId: string) => {
    setErrorItemId(null);
    setErrorMessage(null);
    handleComplete(itemId);
  };

  return (
    <div className="space-y-6">
      {/* Progress header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-sm font-medium text-foreground">
                Progress
              </span>
              <span className="text-sm text-muted-foreground ml-2">
                {completedCount} of {totalCount} complete
              </span>
            </div>
            <span className="text-sm font-semibold text-foreground">
              {progress}%
            </span>
          </div>
          <ProgressBar value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2">
            {serviceTier.charAt(0).toUpperCase() + serviceTier.slice(1)} tier
          </p>
        </CardContent>
      </Card>

      {/* Checklist items by category */}
      {categoryOrder
        .filter((cat) => groupedItems[cat]?.length > 0)
        .map((category) => {
          const categoryItems = groupedItems[category];
          const categoryCompletedCount = categoryItems.filter(
            (i) => i.completedAt
          ).length;

          return (
            <Card key={category}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-foreground">
                    {categoryLabels[category] || category}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {categoryCompletedCount}/{categoryItems.length}
                  </span>
                </div>
                <ul className="space-y-3">
                  {categoryItems.map((item) => {
                    const isCompleted = !!item.completedAt;
                    const isCompleting = completingItemId === item.id;
                    const hasError = errorItemId === item.id;

                    return (
                      <li
                        key={item.id}
                        className="flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            {isCompleted ? (
                              <div className="h-5 w-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                              </div>
                            ) : hasError ? (
                              <div className="h-5 w-5 rounded-full bg-destructive/10 flex items-center justify-center">
                                <AlertCircle className="h-3 w-3 text-destructive" />
                              </div>
                            ) : (
                              <Circle className="h-5 w-5 text-muted-foreground/30" />
                            )}
                            <span
                              className={
                                isCompleted
                                  ? "text-sm text-muted-foreground line-through"
                                  : hasError
                                    ? "text-sm text-destructive"
                                    : "text-sm text-foreground"
                              }
                            >
                              {item.label}
                            </span>
                          </div>
                          {!isCompleted && !hasError && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleComplete(item.id)}
                              disabled={isPending}
                            >
                              {isCompleting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Complete"
                              )}
                            </Button>
                          )}
                          {hasError && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRetry(item.id)}
                              disabled={isPending}
                              className="text-destructive border-destructive/50 hover:bg-destructive/10"
                            >
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Retry
                            </Button>
                          )}
                        </div>
                        {/* MEDIUM-02 FIX: Show error message */}
                        {hasError && errorMessage && (
                          <div
                            className="ml-8 text-xs text-destructive flex items-center gap-1"
                            role="alert"
                          >
                            <AlertCircle className="h-3 w-3" />
                            {errorMessage}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          );
        })}
    </div>
  );
}
