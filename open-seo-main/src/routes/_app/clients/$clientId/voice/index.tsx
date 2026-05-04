/**
 * Voice Settings Page
 * Phase 37-05: Voice Settings UI
 *
 * Main voice settings page that shows:
 * - VoiceWizard for clients without a profile
 * - Tabbed interface with sidebar summary for clients with a profile
 *
 * Route: /clients/{clientId}/voice
 */
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle } from "lucide-react";
import { getVoiceProfileFn } from "@/serverFunctions/voice";
import { VoiceSettingsTabs } from "@/client/components/voice/VoiceSettingsTabs";
import { VoiceProfileSummary } from "@/client/components/voice/VoiceProfileSummary";
import { VoiceWizard } from "@/client/components/voice/VoiceWizard";
import { Alert, AlertDescription } from "@/client/components/ui/alert";

export const Route = createFileRoute("/_app/clients/$clientId/voice/")({
  component: VoiceSettingsPage,
});

function VoiceSettingsPage() {
  const { clientId } = useParams({
        from: "/_app/clients/$clientId/voice/",
  });

  const {
    data: profile,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["voice-profile", clientId],
    queryFn: () => getVoiceProfileFn({ data: { clientId } }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 max-w-4xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load voice profile: {(error as Error).message}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // No profile yet - show wizard
  if (!profile) {
    return (
      <div className="container mx-auto py-8 max-w-4xl">
        <VoiceWizard clientId={clientId} />
      </div>
    );
  }

  // Existing profile - show tabs with sidebar summary
  return (
    <div className="container mx-auto py-8">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar summary - always visible */}
        <div className="lg:col-span-1">
          <VoiceProfileSummary profile={profile} />
        </div>

        {/* Main tabbed interface */}
        <div className="lg:col-span-3">
          <VoiceSettingsTabs profile={profile} clientId={clientId} />
        </div>
      </div>
    </div>
  );
}
