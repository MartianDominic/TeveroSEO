"use client";

import { useState } from "react";

import { Loader2, Sparkles, RefreshCw, CheckCircle, AlertTriangle, XCircle } from "lucide-react";

import type { VoiceProfile } from "@/lib/voiceApi";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Skeleton,
} from "@tevero/ui";

interface VoicePreviewPanelProps {
  profile: VoiceProfile | null;
  clientId: string;
}

type PreviewType = "headline" | "paragraph" | "cta";

interface PreviewSamples {
  headline: string;
  paragraph: string;
  cta: string;
}

interface ComplianceScore {
  tone_match: number;
  vocabulary_match: number;
  structure_match: number;
  personality_match: number;
  rule_compliance: number;
  overall: number;
  violations: Array<{
    dimension: string;
    severity: "high" | "medium" | "low";
    text: string;
    suggestion: string;
  }>;
  passed: boolean;
}

interface PreviewResult {
  samples: PreviewSamples;
  compliance: ComplianceScore;
}

function ComplianceScoreBadge({ score, showLabel = false }: { score: number; showLabel?: boolean }) {
  const isPassing = score >= 70;
  const isWarning = score >= 50 && score < 70;

  const Icon = isPassing ? CheckCircle : isWarning ? AlertTriangle : XCircle;
  const color = isPassing
    ? "bg-green-500/10 text-green-600 border-green-200"
    : isWarning
      ? "bg-amber-500/10 text-amber-600 border-amber-200"
      : "bg-red-500/10 text-red-600 border-red-200";

  const label = isPassing
    ? "Matches voice profile"
    : isWarning
      ? "Partial match - review suggestions"
      : "Does not match - adjust settings";

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className={`${color} font-medium`}>
        <Icon className="w-3.5 h-3.5 mr-1.5" />
        {score}%
      </Badge>
      {showLabel && <span className="text-sm text-muted-foreground">{label}</span>}
    </div>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{score}%</span>
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

export function VoicePreviewPanel({ profile, clientId }: VoicePreviewPanelProps) {
  const [previewType, setPreviewType] = useState<PreviewType>("paragraph");
  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!profile || !topic.trim()) {
      setError("Please enter a topic");
      return;
    }

    setGenerating(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/voice/${clientId}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previewType,
          topic: topic.trim(),
          keywords: [],
        }),
        signal: AbortSignal.timeout(60_000), // 60s timeout for LLM operations
      });

      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        data?: PreviewResult;
        samples?: PreviewSamples;
        compliance?: ComplianceScore;
      };

      if (!res.ok || json.error) {
        throw new Error(json.error || "Failed to generate preview");
      }

      // Handle both response formats
      if (json.data) {
        setResult(json.data);
      } else if (json.samples && json.compliance) {
        setResult({ samples: json.samples, compliance: json.compliance });
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate preview");
    } finally {
      setGenerating(false);
    }
  };

  if (!profile) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          No voice profile found. Configure your voice settings first.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Preview Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generate Preview</CardTitle>
          <CardDescription>
            Test how content will sound with your voice settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Preview Type Selection */}
          <div className="space-y-2">
            <Label>Preview Type</Label>
            <Select
              value={previewType}
              onValueChange={(v: string) => setPreviewType(v as PreviewType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select preview type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="headline">Headline</SelectItem>
                <SelectItem value="paragraph">Paragraph</SelectItem>
                <SelectItem value="cta">Call to Action</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Topic Input */}
          <div className="space-y-2">
            <Label htmlFor="preview-topic">Topic</Label>
            <Input
              id="preview-topic"
              placeholder="e.g., Benefits of our SEO platform"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={generating}
            />
          </div>

          {/* Generate Button */}
          <Button
            onClick={() => void handleGenerate()}
            disabled={generating || !topic.trim()}
            className="w-full"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Preview
              </>
            )}
          </Button>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </CardContent>
      </Card>

      {/* Loading State */}
      {generating && (
        <Card>
          <CardContent className="py-8 space-y-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && !generating && (
        <>
          {/* Generated Content */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Generated Content</CardTitle>
                <ComplianceScoreBadge score={result.compliance.overall} showLabel />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-foreground leading-relaxed">
                  {result.samples[previewType]}
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleGenerate()}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </CardContent>
          </Card>

          {/* Compliance Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Voice Compliance</CardTitle>
              <CardDescription>
                How well the content matches your voice profile
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                <ScoreBar label="Tone" score={result.compliance.tone_match} />
                <ScoreBar label="Vocabulary" score={result.compliance.vocabulary_match} />
                <ScoreBar label="Structure" score={result.compliance.structure_match} />
                <ScoreBar label="Personality" score={result.compliance.personality_match} />
                <ScoreBar label="Rules" score={result.compliance.rule_compliance} />
              </div>

              <div className="pt-2 border-t">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Overall Score</span>
                  <ComplianceScoreBadge score={result.compliance.overall} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Violations */}
          {result.compliance.violations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Suggestions</CardTitle>
                <CardDescription>
                  Areas where the content could better match your voice
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {result.compliance.violations.map((v, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <Badge
                        variant="outline"
                        className={
                          v.severity === "high"
                            ? "bg-red-500/10 text-red-600 border-red-200"
                            : v.severity === "medium"
                              ? "bg-amber-500/10 text-amber-600 border-amber-200"
                              : "bg-blue-500/10 text-blue-600 border-blue-200"
                        }
                      >
                        {v.dimension}
                      </Badge>
                      <div>
                        <p className="text-muted-foreground">&ldquo;{v.text}&rdquo;</p>
                        <p className="text-foreground mt-0.5">{v.suggestion}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
