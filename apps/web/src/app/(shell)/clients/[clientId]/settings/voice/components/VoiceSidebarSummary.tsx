"use client";

import { Badge, Button, Card, Skeleton } from "@tevero/ui";
import { Loader2, RefreshCw } from "lucide-react";
import type { VoiceProfile } from "@/lib/voiceApi";

interface VoiceSidebarSummaryProps {
  profile: VoiceProfile | null;
  loading: boolean;
  analyzing: boolean;
  onAnalyze: () => void;
}

const MODE_LABELS = {
  preservation: "Preserve Existing",
  application: "Apply Learned",
  best_practices: "Industry Standards",
} as const;

export function VoiceSidebarSummary({
  profile,
  loading,
  analyzing,
  onAnalyze,
}: VoiceSidebarSummaryProps) {
  if (loading) {
    return (
      <Card className="p-4 space-y-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-9 w-full" />
      </Card>
    );
  }

  const confidence = profile?.confidenceScore ?? null;
  const lastAnalyzed = profile?.analyzedAt
    ? new Date(profile.analyzedAt).toLocaleDateString()
    : null;
  const mode = profile?.mode ?? "best_practices";
  const rulesCount = profile?.protectedSections?.length ?? 0;
  const blendWeight = profile?.voiceBlendWeight ?? 0.5;

  return (
    <Card className="p-4 space-y-4">
      <div>
        <p className="text-xs text-muted-foreground">Voice Mode</p>
        <Badge variant="outline" className="mt-1">
          {MODE_LABELS[mode]}
        </Badge>
      </div>

      <div>
        <p className="text-xs text-muted-foreground">Confidence</p>
        <p className="text-sm font-medium mt-1">
          {confidence !== null ? `${confidence}%` : "Not analyzed"}
        </p>
      </div>

      <div>
        <p className="text-xs text-muted-foreground">Last Analyzed</p>
        <p className="text-sm mt-1">{lastAnalyzed ?? "Never"}</p>
      </div>

      {profile?.voiceBlendEnabled && (
        <div>
          <p className="text-xs text-muted-foreground">Template Blend</p>
          <p className="text-sm mt-1">{(blendWeight * 100).toFixed(0)}%</p>
        </div>
      )}

      <div>
        <p className="text-xs text-muted-foreground">Protection Rules</p>
        <p className="text-sm mt-1">{rulesCount} rules</p>
      </div>

      <Button
        className="w-full"
        variant="outline"
        onClick={onAnalyze}
        disabled={analyzing}
      >
        {analyzing ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Analyzing...
          </>
        ) : (
          <>
            <RefreshCw className="h-4 w-4 mr-2" />
            Learn Voice
          </>
        )}
      </Button>
    </Card>
  );
}
