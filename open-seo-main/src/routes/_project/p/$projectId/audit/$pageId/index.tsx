/**
 * Audit page detail view with SEO score and findings.
 * Phase 32: 107 SEO Checks Implementation
 */
import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { ScoreCard } from "./-components/ScoreCard";
import { FindingsPanel } from "./-components/FindingsPanel";

interface Finding {
  id: string;
  checkId: string;
  tier: number;
  category: string;
  passed: boolean;
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  details?: Record<string, unknown>;
  autoEditable: boolean;
  editRecipe?: Record<string, unknown>;
}

interface FindingsResponse {
  score: number | null;
  breakdown: { base: number; tier1: number; tier2: number; tier3: number } | null;
  gates: string[];
  findings: Finding[];
  message?: string;
}

export const Route = createFileRoute("/_project/p/$projectId/audit/$pageId/")({
  loader: async ({ params }) => {
    const response = await fetch(`/api/audit/pages/${params.pageId}/findings`);
    if (!response.ok) {
      throw new Error("Failed to fetch findings");
    }
    return response.json() as Promise<FindingsResponse>;
  },
  component: AuditPageDetail,
});

function AuditPageDetail() {
  const { projectId, pageId } = Route.useParams();
  const data = useLoaderData({ from: Route.id });

  const hasFindings = data.findings.length > 0;
  const score = data.score ?? 0;
  const breakdown = data.breakdown ?? { base: 60, tier1: 0, tier2: 0, tier3: 0 };
  const gates = data.gates ?? [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/p/$projectId/audit"
            params={{ projectId }}
            className="text-sm text-blue-600 hover:underline"
          >
            Back to Audit
          </Link>
          <h1 className="mt-1 text-2xl font-bold">Page Analysis</h1>
          <p className="text-sm text-gray-500">Page ID: {pageId}</p>
        </div>
      </div>

      {!hasFindings ? (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-yellow-800">
            No audit findings for this page yet. Run an audit to see results.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <ScoreCard
              score={score}
              breakdown={breakdown}
              gates={gates}
            />
          </div>
          <div className="lg:col-span-2">
            <FindingsPanel findings={data.findings} />
          </div>
        </div>
      )}
    </div>
  );
}
