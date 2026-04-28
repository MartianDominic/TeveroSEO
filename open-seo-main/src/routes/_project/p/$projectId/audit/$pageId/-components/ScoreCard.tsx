/**
 * ScoreCard component for displaying on-page SEO score.
 * Phase 32: 107 SEO Checks Implementation
 */
import { cn } from "@/client/lib/utils";
import type { ScoreBreakdown } from "@/server/lib/audit/checks/types";

interface ScoreCardProps {
  score: number;
  breakdown?: ScoreBreakdown;
  gates?: string[];
  className?: string;
}

function getScoreColor(score: number): string {
  if (score >= 90) return "text-green-600";
  if (score >= 80) return "text-blue-600";
  if (score >= 70) return "text-yellow-600";
  return "text-red-600";
}

function getScoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Good";
  if (score >= 70) return "Average";
  return "Poor";
}

function getScoreBgColor(score: number): string {
  if (score >= 90) return "bg-green-50 border-green-200";
  if (score >= 80) return "bg-blue-50 border-blue-200";
  if (score >= 70) return "bg-yellow-50 border-yellow-200";
  return "bg-red-50 border-red-200";
}

const GATE_LABELS: Record<string, string> = {
  noindex: "Page has noindex",
  "cwv-poor": "Poor Core Web Vitals",
  "ymyl-no-author": "YMYL content missing author",
  "duplicate-content": "High duplicate content",
};

export function ScoreCard({ score, breakdown, gates = [], className }: ScoreCardProps) {
  const colorClass = getScoreColor(score);
  const bgClass = getScoreBgColor(score);
  const label = getScoreLabel(score);

  return (
    <div className={cn("rounded-lg border p-6", bgClass, className)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">On-Page SEO Score</p>
          <div className="flex items-baseline gap-2">
            <span className={cn("text-5xl font-bold", colorClass)}>{score}</span>
            <span className="text-lg text-gray-500">/100</span>
          </div>
          <p className={cn("text-sm font-medium mt-1", colorClass)}>{label}</p>
        </div>

        {/* Progress circle visualization */}
        <div className="relative h-24 w-24">
          <svg className="h-24 w-24 -rotate-90 transform">
            <circle
              cx="48"
              cy="48"
              r="40"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              className="text-gray-200"
            />
            <circle
              cx="48"
              cy="48"
              r="40"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              strokeDasharray={`${(score / 100) * 251.2} 251.2`}
              className={colorClass}
            />
          </svg>
        </div>
      </div>

      {/* Score breakdown */}
      {breakdown && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-gray-700">Score Breakdown</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="rounded bg-white p-2">
              <p className="text-xs text-gray-500">Base</p>
              <p className="font-semibold">{breakdown.base}</p>
            </div>
            <div className="rounded bg-white p-2">
              <p className="text-xs text-gray-500">Tier 1</p>
              <p className="font-semibold">+{breakdown.tier1.toFixed(1)}</p>
            </div>
            <div className="rounded bg-white p-2">
              <p className="text-xs text-gray-500">Tier 2</p>
              <p className="font-semibold">+{breakdown.tier2.toFixed(1)}</p>
            </div>
            <div className="rounded bg-white p-2">
              <p className="text-xs text-gray-500">Tier 3</p>
              <p className="font-semibold">+{breakdown.tier3.toFixed(1)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Hard gates */}
      {gates.length > 0 && (
        <div className="mt-4 space-y-1">
          <p className="text-sm font-medium text-red-700">Active Gates</p>
          {gates.map((gate) => (
            <div key={gate} className="flex items-center gap-2 text-sm text-red-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <span>{GATE_LABELS[gate] ?? gate}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
