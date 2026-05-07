/**
 * QualityGateResults Component
 * Phase 92-09: UI Components for On-Page Mastery
 *
 * Displays quality gate pass/fail with blocking failure alerts.
 * Uses design-system-v6 ghost-edge shadows and semantic colors.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Progress } from "@/client/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/client/components/ui/alert";
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import type { GateResult } from "@/server/features/onpage-mastery/types";

interface Props {
  results: Record<string, GateResult>;
  blockingFailures: string[];
  overallScore: number;
}

export function QualityGateResults({
  results,
  blockingFailures,
  overallScore,
}: Props) {
  const gates = Object.entries(results);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Quality Gates</span>
          <span
            className={`text-2xl font-bold ${
              overallScore >= 70
                ? "text-green-600"
                : overallScore >= 50
                  ? "text-yellow-600"
                  : "text-red-600"
            }`}
          >
            {Math.round(overallScore)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {blockingFailures.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Blocking Failures</AlertTitle>
            <AlertDescription>
              {blockingFailures.length} check(s) must pass before publication:{" "}
              {blockingFailures.join(", ")}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          {gates.map(([id, result]) => (
            <div key={id} className="flex items-center gap-3">
              {result.passed ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <div className="flex-1">
                <div className="flex justify-between text-[14px]">
                  <span className="font-medium">{id}</span>
                  <span
                    className={result.passed ? "text-green-600" : "text-red-600"}
                  >
                    {Math.round(result.score)}
                  </span>
                </div>
                <Progress value={result.score} className="h-1.5 mt-1" />
                <p className="text-[12px] text-muted-foreground mt-1">
                  {result.message}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
