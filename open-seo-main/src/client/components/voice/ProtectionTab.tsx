/**
 * Protection Settings Tab
 * Phase 37-05: Voice Settings UI
 *
 * Container for the ProtectionRulesEditor component.
 * This tab is most relevant in "preservation" mode.
 */
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { ProtectionRulesEditor } from "./ProtectionRulesEditor";
import type { VoiceProfileSelect } from "@/db/voice-schema";

interface Props {
  profile: VoiceProfileSelect;
  clientId: string;
}

export function ProtectionTab({ profile }: Props) {
  // Show info alert if not in preservation mode
  const showModeWarning = profile.mode !== "preservation";

  return (
    <div className="space-y-4">
      {showModeWarning && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Protection rules are most effective in{" "}
            <strong>Preservation mode</strong>. Your current mode is{" "}
            <strong>
              {profile.mode === "application"
                ? "Application"
                : "Best Practices"}
            </strong>
            . Rules will still be stored but may not be actively enforced.
          </AlertDescription>
        </Alert>
      )}

      <ProtectionRulesEditor profileId={profile.id} />
    </div>
  );
}
