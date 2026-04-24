"use client";

import { useState, useCallback } from "react";
import {
  Button,
  Card,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
  Switch,
  Separator,
} from "@tevero/ui";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { VoiceProfile, VoiceTemplate } from "@/lib/voiceApi";
import { VoiceModeCard } from "./VoiceModeCard";

interface VoiceModeWizardProps {
  profile: VoiceProfile | null;
  templates: VoiceTemplate[];
  onSave: (data: Partial<VoiceProfile>) => Promise<void>;
  saving: boolean;
}

export function VoiceModeWizard({
  profile,
  templates,
  onSave,
  saving,
}: VoiceModeWizardProps) {
  const [selectedMode, setSelectedMode] = useState<
    "preservation" | "application" | "best_practices"
  >(profile?.mode ?? "best_practices");

  const [templateId, setTemplateId] = useState<string | null>(
    profile?.voiceTemplateId ?? null
  );
  const [blendEnabled, setBlendEnabled] = useState(
    profile?.voiceBlendEnabled ?? false
  );
  const [blendWeight, setBlendWeight] = useState([
    profile?.voiceBlendWeight ?? 0.5,
  ]);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const handleModeSelect = useCallback(
    (mode: "preservation" | "application" | "best_practices") => {
      setSelectedMode(mode);
    },
    []
  );

  const handleSave = useCallback(async () => {
    await onSave({
      mode: selectedMode,
      voiceTemplateId: templateId,
      voiceBlendEnabled: blendEnabled,
      voiceBlendWeight: blendWeight[0],
    });
  }, [selectedMode, templateId, blendEnabled, blendWeight, onSave]);

  const selectedTemplate = templates.find((t) => t.id === templateId);

  return (
    <div className="space-y-6">
      {/* Mode question */}
      <div>
        <h3 className="text-sm font-medium mb-1">
          How should AI handle this client's content?
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Choose how the system should approach content generation and
          optimization for this client.
        </p>
      </div>

      {/* Mode cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <VoiceModeCard
          mode="preservation"
          selected={selectedMode === "preservation"}
          onSelect={() => handleModeSelect("preservation")}
        />
        <VoiceModeCard
          mode="application"
          selected={selectedMode === "application"}
          onSelect={() => handleModeSelect("application")}
        />
        <VoiceModeCard
          mode="best_practices"
          selected={selectedMode === "best_practices"}
          onSelect={() => handleModeSelect("best_practices")}
        />
      </div>

      {/* Template selection (for best_practices mode) */}
      {selectedMode === "best_practices" && (
        <Card className="p-4 space-y-4">
          <div>
            <Label className="text-sm font-medium">Industry Template</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select a template that matches your client's industry
            </p>
            <Select
              value={templateId ?? ""}
              onValueChange={(v) => setTemplateId(v || null)}
            >
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Choose an industry template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                    {t.isSystem && " (system)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate?.description && (
              <p className="text-xs text-muted-foreground mt-2">
                {selectedTemplate.description}
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Advanced options */}
      <div>
        <button
          type="button"
          onClick={() => setAdvancedOpen(!advancedOpen)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {advancedOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
          Advanced Options
        </button>

        {advancedOpen && (
          <Card className="p-4 mt-4 space-y-4">
            {/* Voice blending */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Enable Voice Blending</Label>
                <p className="text-xs text-muted-foreground">
                  Blend client voice with industry template
                </p>
              </div>
              <Switch
                checked={blendEnabled}
                onCheckedChange={setBlendEnabled}
              />
            </div>

            {blendEnabled && (
              <>
                <Separator />
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Blend Weight</Label>
                  <div className="px-1">
                    <Slider
                      value={blendWeight}
                      onValueChange={setBlendWeight}
                      min={0}
                      max={1}
                      step={0.05}
                    />
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-muted-foreground">
                        Client voice
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Template style
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Current: {blendWeight[0].toFixed(2)}
                  </p>
                </div>
              </>
            )}
          </Card>
        )}
      </div>

      {/* Save button */}
      <div className="flex justify-end pt-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Voice Mode"}
        </Button>
      </div>
    </div>
  );
}
