/**
 * Voice Profile Summary
 * Phase 37-05: Voice Settings UI
 *
 * Always-visible sidebar card showing:
 * - Current mode badge
 * - Confidence score with progress bar
 * - Quick stats (tone, archetype, formality, contractions)
 * - Last analysis timestamp
 */
import { formatDistanceToNow } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { Badge } from "@/client/components/ui/badge";
import { Progress } from "@/client/components/ui/progress";
import type { VoiceProfileSelect } from "@/db/voice-schema";

interface Props {
  profile: VoiceProfileSelect;
}

/**
 * Get badge variant based on voice mode.
 */
function getModeVariant(
  mode: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (mode) {
    case "preservation":
      return "destructive";
    case "application":
      return "default";
    case "best_practices":
    default:
      return "secondary";
  }
}

/**
 * Format mode for display.
 */
function formatMode(mode: string): string {
  return mode
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function VoiceProfileSummary({ profile }: Props) {
  const confidenceScore = profile.confidenceScore ?? 0;

  return (
    <Card className="sticky top-4">
      <CardHeader>
        <CardTitle className="text-lg">Voice Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode badge */}
        <div>
          <span className="text-sm text-muted-foreground">Mode</span>
          <div className="mt-1">
            <Badge variant={getModeVariant(profile.mode)}>
              {formatMode(profile.mode)}
            </Badge>
          </div>
        </div>

        {/* Confidence */}
        <div>
          <span className="text-sm text-muted-foreground">Confidence</span>
          <div className="flex items-center gap-2 mt-1">
            <Progress value={confidenceScore} className="h-2 flex-1" />
            <span className="text-sm font-medium w-10 text-right">
              {confidenceScore}%
            </span>
          </div>
          {confidenceScore > 0 && confidenceScore < 70 && (
            <p className="text-xs text-amber-600 mt-1">
              Below 70% - review recommended
            </p>
          )}
          {confidenceScore === 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Not analyzed yet
            </p>
          )}
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground block">Tone</span>
            <p className="font-medium capitalize">
              {profile.tonePrimary || "Not set"}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground block">Archetype</span>
            <p className="font-medium capitalize">
              {profile.archetype || "Not set"}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground block">Formality</span>
            <p className="font-medium">
              {profile.formalityLevel ? `${profile.formalityLevel}/10` : "Not set"}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground block">Contractions</span>
            <p className="font-medium capitalize">
              {profile.contractionUsage || "Not set"}
            </p>
          </div>
        </div>

        {/* Vocabulary stats */}
        {profile.vocabularyPatterns && (
          <div className="text-sm">
            <span className="text-muted-foreground block mb-1">Vocabulary</span>
            <div className="flex gap-2 text-xs">
              <Badge variant="outline" className="font-normal">
                {profile.vocabularyPatterns.preferred?.length || 0} preferred
              </Badge>
              <Badge variant="outline" className="font-normal">
                {profile.vocabularyPatterns.avoided?.length || 0} avoided
              </Badge>
            </div>
          </div>
        )}

        {/* Last analysis */}
        <div className="pt-2 border-t text-xs text-muted-foreground">
          {profile.analyzedAt ? (
            <span>
              Last analyzed{" "}
              {formatDistanceToNow(new Date(profile.analyzedAt), {
                addSuffix: true,
              })}
            </span>
          ) : (
            <span>Never analyzed - run voice learning to extract patterns</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
