"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChecklistProgress } from "@/components/onboarding/ChecklistProgress";
import { ChecklistItemRow } from "@/components/onboarding/ChecklistItemRow";
import {
  getClientChecklist,
  completeChecklistItem,
  generateMagicLink,
  type Checklist,
  type ChecklistItem,
} from "@/lib/api/onboarding";

/**
 * Onboarding page - Client checklist view.
 * Phase 49-51: Onboarding & Agency Dashboard
 *
 * Implements:
 * - D-04: Progress visualization with per-category counts
 * - D-01: Dual mode for credential items
 * - D-03: Manual checkbox for all items
 */
export default function OnboardingPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;

  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadChecklist() {
      try {
        const data = await getClientChecklist(clientId);
        if (!data) {
          setError("No onboarding checklist found for this client.");
        } else {
          setChecklist(data);
        }
      } catch (err) {
        setError("Failed to load checklist.");
      } finally {
        setLoading(false);
      }
    }
    loadChecklist();
  }, [clientId]);

  const handleComplete = async (itemId: string) => {
    if (!checklist) return;
    await completeChecklistItem(checklist.id, itemId);
    // Refresh checklist
    const updated = await getClientChecklist(clientId);
    if (updated) setChecklist(updated);
  };

  const handleSendMagicLink = async (itemId: string): Promise<string> => {
    if (!checklist) throw new Error("No checklist");
    return generateMagicLink(checklist.id, itemId);
  };

  const handleConnectDirectly = (itemId: string) => {
    if (!checklist) return;
    // Navigate to OAuth flow
    window.location.href = `/api/oauth/start?checklistId=${checklist.id}&itemId=${itemId}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !checklist) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{error || "No checklist found."}</p>
      </div>
    );
  }

  // Group items by category for D-04
  const categoryCounts = computeCategoryCounts(checklist.items);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Onboarding</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {checklist.serviceTier.charAt(0).toUpperCase() +
            checklist.serviceTier.slice(1)}{" "}
          tier &mdash; {checklist.completedCount}/{checklist.totalCount} complete
        </p>
      </div>

      {/* D-04: Overall progress + per-category counts */}
      <ChecklistProgress
        completedCount={checklist.completedCount}
        totalCount={checklist.totalCount}
        categories={categoryCounts}
      />

      {/* Items grouped by category */}
      {(["credentials", "kickoff", "setup", "content"] as const).map((category) => {
        const categoryItems = checklist.items.filter((i) => i.category === category);
        if (categoryItems.length === 0) return null;

        return (
          <div key={category} className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground capitalize">
              {category}
            </h3>
            <div className="space-y-2">
              {categoryItems.map((item) => (
                <ChecklistItemRow
                  key={item.id}
                  itemId={item.id}
                  checklistId={checklist.id}
                  label={item.label}
                  category={item.category}
                  completed={!!item.completedAt}
                  autoCompleteEvent={item.autoCompleteEvent}
                  onComplete={handleComplete}
                  onSendMagicLink={handleSendMagicLink}
                  onConnectDirectly={handleConnectDirectly}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function computeCategoryCounts(items: ChecklistItem[]) {
  const categories = ["credentials", "kickoff", "setup", "content"] as const;
  return categories
    .map((category) => {
      const categoryItems = items.filter((i) => i.category === category);
      return {
        category,
        completed: categoryItems.filter((i) => i.completedAt).length,
        total: categoryItems.length,
      };
    })
    .filter((c) => c.total > 0);
}
