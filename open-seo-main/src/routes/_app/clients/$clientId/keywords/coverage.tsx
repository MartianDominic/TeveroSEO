/**
 * Coverage Page Route
 * Phase 93: Keyword Coverage Intelligence
 *
 * Shows coverage dashboard and research mode selector.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CoverageDashboard } from "@/client/features/keywords/components/CoverageDashboard";
import { ResearchModeSelector } from "@/client/features/keywords/components/ResearchModeSelector";

// @ts-expect-error Route path is correct but may not be in generated types yet
export const Route = createFileRoute("/_app/clients/$clientId/keywords/coverage")({
  component: CoveragePage,
});

function CoveragePage() {
  const { clientId } = Route.useParams();
  const [showResearch, setShowResearch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleResearchSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Research is handled in ResearchModeSelector
      // After completion, refresh coverage
      setRefreshKey(k => k + 1);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Keyword Coverage</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Coverage Dashboard */}
        <CoverageDashboard
          key={refreshKey}
          prospectId={clientId}
          onResearchClick={() => setShowResearch(true)}
        />

        {/* Research Mode Selector */}
        {showResearch && (
          <ResearchModeSelector
            prospectId={clientId}
            onSubmit={handleResearchSubmit}
            isSubmitting={isSubmitting}
          />
        )}
      </div>
    </div>
  );
}
