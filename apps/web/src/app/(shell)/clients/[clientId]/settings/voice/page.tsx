"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  PageHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Skeleton,
} from "@tevero/ui";
import { AlertCircle } from "lucide-react";

import { useClientStore } from "@/stores/clientStore";
import {
  getVoiceProfile,
  saveVoiceProfile,
  analyzeVoice,
  getVoiceTemplates,
} from "@/actions/voice";
import type { VoiceProfile, VoiceTemplate } from "@/lib/voiceApi";

import { VoiceSidebarSummary } from "./components/VoiceSidebarSummary";
import { VoiceModeWizard } from "./components/VoiceModeWizard";
import { TonePersonalityTab } from "./components/TonePersonalityTab";
import { VocabularyTab } from "./components/VocabularyTab";
import { WritingMechanicsTab } from "./components/WritingMechanicsTab";
import { ProtectionRulesTab } from "./components/ProtectionRulesTab";

export default function VoiceSettingsPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const clients = useClientStore((s) => s.clients);
  const clientName = clients.find((c) => c.id === clientId)?.name ?? null;

  const [activeTab, setActiveTab] = useState("mode");
  const [profile, setProfile] = useState<VoiceProfile | null>(null);
  const [templates, setTemplates] = useState<VoiceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  const showToast = useCallback(
    (message: string, severity: "success" | "error" = "success") => {
      setToast({ open: true, message, severity });
      setTimeout(() => setToast((t) => ({ ...t, open: false })), 3000);
    },
    []
  );

  // Load profile and templates
  useEffect(() => {
    if (!clientId) return;

    setLoading(true);
    setLoadError(false);

    Promise.all([getVoiceProfile(clientId), getVoiceTemplates()])
      .then(([profileData, templatesData]) => {
        setProfile(profileData);
        setTemplates(templatesData);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [clientId]);

  // Save handler
  const handleSave = useCallback(
    async (data: Partial<VoiceProfile>) => {
      if (!clientId) return;
      setSaving(true);
      try {
        const updated = await saveVoiceProfile(clientId, data);
        setProfile(updated);
        showToast("Voice profile saved");
      } catch {
        showToast("Failed to save voice profile", "error");
      } finally {
        setSaving(false);
      }
    },
    [clientId, showToast]
  );

  // Analyze handler
  const handleAnalyze = useCallback(async () => {
    if (!clientId) return;
    setAnalyzing(true);
    try {
      // TODO: Get URLs from user input or auto-detect
      const urls = ["https://example.com"]; // Placeholder
      await analyzeVoice(clientId, urls);
      showToast("Voice analysis started");
    } catch {
      showToast("Failed to start voice analysis", "error");
    } finally {
      setAnalyzing(false);
    }
  }, [clientId, showToast]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-6">
          <div className="flex-1 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="w-64">
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        <PageHeader
          title="Voice Profile"
          subtitle={clientName ?? undefined}
          backHref={clientId ? `/clients/${clientId}/settings` : "/clients"}
        />
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="text-base font-semibold">Failed to load voice profile</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <PageHeader
        title="Voice Profile"
        subtitle={clientName ?? undefined}
        backHref={clientId ? `/clients/${clientId}/settings` : "/clients"}
      />

      <div className="flex gap-6 mt-6">
        {/* Main content with tabs */}
        <div className="flex-1 min-w-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="mode">Mode</TabsTrigger>
              <TabsTrigger value="tone">Tone & Personality</TabsTrigger>
              <TabsTrigger value="vocabulary">Vocabulary</TabsTrigger>
              <TabsTrigger value="writing">Writing Style</TabsTrigger>
              <TabsTrigger value="protection">Protection Rules</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>

            <TabsContent value="mode">
              <VoiceModeWizard
                profile={profile}
                templates={templates}
                onSave={handleSave}
                saving={saving}
              />
            </TabsContent>

            <TabsContent value="tone">
              <TonePersonalityTab
                profile={profile}
                onSave={handleSave}
                saving={saving}
              />
            </TabsContent>

            <TabsContent value="vocabulary">
              <VocabularyTab
                profile={profile}
                onSave={handleSave}
                saving={saving}
              />
            </TabsContent>

            <TabsContent value="writing">
              <WritingMechanicsTab
                profile={profile}
                onSave={handleSave}
                saving={saving}
              />
            </TabsContent>

            <TabsContent value="protection">
              <ProtectionRulesTab clientId={clientId ?? ""} />
            </TabsContent>

            <TabsContent value="preview">
              {/* Preview tab content - implemented in 37-04 */}
              <div className="text-center py-20 text-muted-foreground">
                Voice preview coming soon
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="w-64 shrink-0 hidden lg:block">
          <VoiceSidebarSummary
            profile={profile}
            loading={loading}
            analyzing={analyzing}
            onAnalyze={handleAnalyze}
          />
        </div>
      </div>

      {/* Toast */}
      {toast.open && (
        <div className="fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg bg-card border border-border">
          <span className="text-foreground">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
