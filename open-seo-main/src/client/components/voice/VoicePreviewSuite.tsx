/**
 * Voice Preview Suite
 * Phase 37-05: Voice Settings UI
 *
 * Generate sample content to preview voice settings:
 * - Headline sample
 * - Paragraph sample
 * - Call-to-action sample
 * - Compliance scores per dimension
 * - Violation highlights with suggestions
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Sparkles, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { Button } from "@/client/components/ui/button";
import { Label } from "@/client/components/ui/label";
import { Badge } from "@/client/components/ui/badge";
import { Progress } from "@/client/components/ui/progress";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { generateVoicePreviewFn } from "@/serverFunctions/voice";
import type { VoiceProfileSelect } from "@/db/voice-schema";

interface Props {
  profile: VoiceProfileSelect;
  clientId: string;
}

interface PreviewSamples {
  headline: string;
  paragraph: string;
  cta: string;
}

interface ComplianceViolation {
  dimension: "tone" | "vocabulary" | "structure" | "personality" | "rules";
  severity: "high" | "medium" | "low";
  line_number?: number;
  text: string;
  suggestion: string;
}

interface ComplianceScore {
  overall: number;
  tone_match: number;
  vocabulary_match: number;
  structure_match: number;
  personality_match: number;
  rule_compliance: number;
  violations: ComplianceViolation[];
  passed: boolean;
}

const DIMENSION_LABELS: Record<string, string> = {
  tone_match: "Tone",
  vocabulary_match: "Vocabulary",
  structure_match: "Structure",
  personality_match: "Personality",
  rule_compliance: "Rules",
};

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-amber-600";
  return "text-red-600";
}

function getScoreBadgeVariant(
  score: number
): "default" | "secondary" | "destructive" {
  if (score >= 80) return "default";
  if (score >= 60) return "secondary";
  return "destructive";
}

export function VoicePreviewSuite({ profile }: Props) {
  const [samples, setSamples] = useState<PreviewSamples | null>(null);
  const [compliance, setCompliance] = useState<ComplianceScore | null>(null);

  const generateMutation = useMutation({
    mutationFn: generateVoicePreviewFn,
    onSuccess: (data) => {
      setSamples(data.samples);
      setCompliance(data.compliance);
    },
  });

  const handleGenerate = () => {
    generateMutation.mutate({
      data: { profileId: profile.id },
    });
  };

  return (
    <div className="space-y-6">
      {/* Generate button */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Voice Preview</CardTitle>
          <CardDescription>
            Generate sample content to see how your voice settings work
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : samples ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Regenerate Samples
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Samples
                </>
              )}
            </Button>
          </div>

          {generateMutation.isError && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>
                Failed to generate samples:{" "}
                {(generateMutation.error as Error).message}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Generated samples */}
      {samples && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generated Samples</CardTitle>
            <CardDescription>
              Content generated using your current voice settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Headline sample */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Headline</Label>
              <div className="p-4 bg-muted rounded-md">
                <p className="font-semibold text-lg">{samples.headline}</p>
              </div>
            </div>

            {/* Paragraph sample */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Paragraph</Label>
              <div className="p-4 bg-muted rounded-md">
                <p className="text-sm leading-relaxed">{samples.paragraph}</p>
              </div>
            </div>

            {/* CTA sample */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Call to Action</Label>
              <div className="p-4 bg-muted rounded-md">
                <p className="font-medium">{samples.cta}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Compliance scores */}
      {compliance && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Compliance Analysis</CardTitle>
            <CardDescription>
              How well the generated content matches your voice profile
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Overall score */}
            <div className="flex items-center gap-4">
              <div
                className={`text-4xl font-bold ${getScoreColor(compliance.overall)}`}
              >
                {compliance.overall}
              </div>
              <div className="flex-1">
                <p className="font-medium">Overall Compliance</p>
                <Progress value={compliance.overall} className="h-2 mt-1" />
              </div>
              <Badge variant={getScoreBadgeVariant(compliance.overall)}>
                {compliance.overall >= 80
                  ? "Excellent"
                  : compliance.overall >= 60
                    ? "Good"
                    : "Needs Work"}
              </Badge>
            </div>

            {/* Dimension scores */}
            <div className="grid grid-cols-5 gap-4">
              {Object.entries(DIMENSION_LABELS).map(([key, label]) => {
                const score =
                  compliance[key as keyof Omit<ComplianceScore, "overall" | "violations">];
                return (
                  <div key={key} className="text-center">
                    <div
                      className={`text-2xl font-bold ${getScoreColor(score as number)}`}
                    >
                      {score}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {label}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Violations */}
            {compliance.violations && compliance.violations.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-amber-600" />
                  <h4 className="font-medium">
                    {compliance.violations.length} Issue(s) Found
                  </h4>
                </div>
                <div className="space-y-2">
                  {compliance.violations.map((v, i) => (
                    <div
                      key={i}
                      className="p-3 border rounded-md bg-muted/50 text-sm"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant={
                            v.severity === "high"
                              ? "destructive"
                              : v.severity === "medium"
                                ? "secondary"
                                : "outline"
                          }
                          className="text-xs"
                        >
                          {v.severity}
                        </Badge>
                        <span className="font-medium capitalize">
                          {v.dimension.replace("_", " ")}
                        </span>
                        {v.line_number && (
                          <span className="text-muted-foreground">
                            Line {v.line_number}
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground">{v.text}</p>
                      {v.suggestion && (
                        <p className="text-xs mt-1">
                          <span className="font-medium">Suggestion:</span>{" "}
                          {v.suggestion}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">
                  No violations detected - content matches voice profile well
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!samples && !generateMutation.isPending && (
        <div className="text-center py-12 text-muted-foreground">
          <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Click "Generate Samples" to preview your voice settings</p>
        </div>
      )}
    </div>
  );
}
