/**
 * FindingsPanel component for displaying SEO check findings.
 * Phase 32: 107 SEO Checks Implementation
 */
import { useState } from "react";
import { cn } from "@/client/lib/utils";
import type { CheckSeverity } from "@/server/lib/audit/checks/types";

interface Finding {
  id: string;
  checkId: string;
  tier: number;
  category: string;
  passed: boolean;
  severity: CheckSeverity;
  message: string;
  autoEditable: boolean;
}

interface FindingsPanelProps {
  findings: Finding[];
  className?: string;
}

const SEVERITY_COLORS: Record<CheckSeverity, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  low: "bg-blue-100 text-blue-800 border-blue-200",
  info: "bg-gray-100 text-gray-800 border-gray-200",
};

const CATEGORY_LABELS: Record<string, string> = {
  "html-signals": "HTML Signals",
  "heading-structure": "Heading Structure",
  "title-meta": "Title & Meta",
  "url-structure": "URL Structure",
  "content-structure": "Content Structure",
  "image-basics": "Image Basics",
  "internal-links": "Internal Links",
  "external-links": "External Links",
  "schema-basics": "Schema Basics",
  "technical-basics": "Technical Basics",
  "eeat-signals": "E-E-A-T Signals",
  "content-quality": "Content Quality",
  "anchor-analysis": "Anchor Analysis",
  "schema-completeness": "Schema Completeness",
  freshness: "Freshness",
  mobile: "Mobile",
  cwv: "Core Web Vitals",
  "entity-nlp": "Entity/NLP",
  backlinks: "Backlinks",
  engagement: "Engagement",
  architecture: "Architecture",
  differentiation: "Differentiation",
};

type FilterSeverity = CheckSeverity | "all";
type FilterStatus = "all" | "passed" | "failed";
type FilterTier = 0 | 1 | 2 | 3 | 4;

export function FindingsPanel({ findings, className }: FindingsPanelProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [severityFilter, setSeverityFilter] = useState<FilterSeverity>("all");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [tierFilter, setTierFilter] = useState<FilterTier>(0);

  // Apply filters
  const filtered = findings.filter((f) => {
    if (severityFilter !== "all" && f.severity !== severityFilter) return false;
    if (statusFilter === "passed" && !f.passed) return false;
    if (statusFilter === "failed" && f.passed) return false;
    if (tierFilter !== 0 && f.tier !== tierFilter) return false;
    return true;
  });

  // Group by category
  const grouped = filtered.reduce(
    (acc, finding) => {
      const cat = finding.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(finding);
      return acc;
    },
    {} as Record<string, Finding[]>
  );

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Summary counts
  const totalPassed = findings.filter((f) => f.passed).length;
  const totalFailed = findings.filter((f) => !f.passed).length;

  return (
    <div className={cn("rounded-lg border bg-white", className)}>
      {/* Header with filters */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">SEO Check Findings</h3>
          <div className="flex gap-2 text-sm">
            <span className="text-green-600">{totalPassed} passed</span>
            <span className="text-gray-400">|</span>
            <span className="text-red-600">{totalFailed} failed</span>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as FilterSeverity)}
            className="rounded border px-2 py-1 text-sm"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="info">Info</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
            className="rounded border px-2 py-1 text-sm"
          >
            <option value="all">All Status</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
          </select>

          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(Number(e.target.value) as FilterTier)}
            className="rounded border px-2 py-1 text-sm"
          >
            <option value={0}>All Tiers</option>
            <option value={1}>Tier 1 (DOM)</option>
            <option value={2}>Tier 2 (Calc)</option>
            <option value={3}>Tier 3 (API)</option>
            <option value={4}>Tier 4 (Crawl)</option>
          </select>
        </div>
      </div>

      {/* Category sections */}
      <div className="divide-y">
        {Object.entries(grouped).map(([category, categoryFindings]) => {
          const isExpanded = expandedCategories.has(category);
          const passedCount = categoryFindings.filter((f) => f.passed).length;
          const failedCount = categoryFindings.length - passedCount;

          return (
            <div key={category}>
              <button
                onClick={() => toggleCategory(category)}
                className="flex w-full items-center justify-between p-4 text-left hover:bg-gray-50"
              >
                <div className="flex items-center gap-2">
                  <svg
                    className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-90")}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="font-medium">{CATEGORY_LABELS[category] ?? category}</span>
                </div>
                <div className="flex gap-2 text-sm">
                  <span className="text-green-600">{passedCount}</span>
                  <span className="text-gray-400">/</span>
                  <span className="text-red-600">{failedCount}</span>
                </div>
              </button>

              {isExpanded && (
                <div className="bg-gray-50 px-4 pb-4">
                  <div className="space-y-2">
                    {categoryFindings.map((finding) => (
                      <div
                        key={finding.id}
                        className={cn(
                          "rounded border p-3",
                          finding.passed ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {finding.passed ? (
                              <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            )}
                            <span className="font-mono text-xs text-gray-500">{finding.checkId}</span>
                          </div>
                          <div className="flex gap-1">
                            <span className={cn("rounded border px-2 py-0.5 text-xs", SEVERITY_COLORS[finding.severity])}>
                              {finding.severity}
                            </span>
                            {finding.autoEditable && (
                              <span className="rounded border border-purple-200 bg-purple-100 px-2 py-0.5 text-xs text-purple-800">
                                Auto-fix
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="mt-1 text-sm text-gray-700">{finding.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {Object.keys(grouped).length === 0 && (
        <div className="p-8 text-center text-gray-500">No findings match the selected filters.</div>
      )}
    </div>
  );
}
