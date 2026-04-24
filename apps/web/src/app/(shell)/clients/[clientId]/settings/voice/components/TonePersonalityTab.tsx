"use client";

import { useState, useCallback } from "react";
import {
  Button,
  Card,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
  Badge,
} from "@tevero/ui";
import { X } from "lucide-react";
import type { VoiceProfile } from "@/lib/voiceApi";

interface TonePersonalityTabProps {
  profile: VoiceProfile | null;
  onSave: (data: Partial<VoiceProfile>) => Promise<void>;
  saving: boolean;
}

const PRIMARY_TONES = [
  "professional",
  "casual",
  "friendly",
  "authoritative",
  "playful",
  "inspirational",
  "empathetic",
  "urgent",
  "conversational",
  "academic",
  "innovative",
] as const;

const EMOTIONAL_RANGES = ["reserved", "moderate", "expressive"] as const;

const ARCHETYPES = [
  "The Expert",
  "The Friend",
  "The Challenger",
  "The Guide",
  "The Innovator",
  "The Trusted Advisor",
] as const;

export function TonePersonalityTab({ profile, onSave, saving }: TonePersonalityTabProps) {
  const [primaryTone, setPrimaryTone] = useState(profile?.primaryTone ?? "professional");
  const [secondaryTones, setSecondaryTones] = useState<string[]>(
    profile?.secondaryTones ?? []
  );
  const [formalityLevel, setFormalityLevel] = useState([profile?.formalityLevel ?? 6]);
  const [emotionalRange, setEmotionalRange] = useState(
    profile?.emotionalRange ?? "moderate"
  );
  const [personalityTraits, setPersonalityTraits] = useState<string[]>(
    profile?.personalityTraits ?? []
  );
  const [archetype, setArchetype] = useState(profile?.archetype ?? "");
  const [newTrait, setNewTrait] = useState("");

  const handleAddTrait = useCallback(() => {
    if (newTrait && !personalityTraits.includes(newTrait)) {
      setPersonalityTraits([...personalityTraits, newTrait]);
      setNewTrait("");
    }
  }, [newTrait, personalityTraits]);

  const handleRemoveTrait = useCallback((trait: string) => {
    setPersonalityTraits(personalityTraits.filter((t) => t !== trait));
  }, [personalityTraits]);

  const handleToggleSecondary = useCallback((tone: string) => {
    if (secondaryTones.includes(tone)) {
      setSecondaryTones(secondaryTones.filter((t) => t !== tone));
    } else if (secondaryTones.length < 3) {
      setSecondaryTones([...secondaryTones, tone]);
    }
  }, [secondaryTones]);

  const handleSave = useCallback(async () => {
    await onSave({
      primaryTone,
      secondaryTones,
      formalityLevel: formalityLevel[0],
      emotionalRange,
      personalityTraits,
      archetype,
    });
  }, [primaryTone, secondaryTones, formalityLevel, emotionalRange, personalityTraits, archetype, onSave]);

  return (
    <div className="space-y-6">
      {/* Primary Tone */}
      <Card className="p-4">
        <Label className="text-sm font-medium">Primary Tone</Label>
        <Select value={primaryTone} onValueChange={setPrimaryTone}>
          <SelectTrigger className="mt-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRIMARY_TONES.map((tone) => (
              <SelectItem key={tone} value={tone}>
                {tone.charAt(0).toUpperCase() + tone.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {/* Secondary Tones */}
      <Card className="p-4">
        <Label className="text-sm font-medium">Secondary Tones (up to 3)</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {PRIMARY_TONES.filter((t) => t !== primaryTone).map((tone) => (
            <Badge
              key={tone}
              variant={secondaryTones.includes(tone) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => handleToggleSecondary(tone)}
            >
              {tone}
            </Badge>
          ))}
        </div>
      </Card>

      {/* Formality Level */}
      <Card className="p-4 space-y-3">
        <Label className="text-sm font-medium">Formality Level</Label>
        <div className="px-1">
          <Slider
            value={formalityLevel}
            onValueChange={setFormalityLevel}
            min={1}
            max={10}
            step={1}
          />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-muted-foreground">Very Casual</span>
            <span className="text-xs text-muted-foreground">Highly Formal</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Current: {formalityLevel[0]}/10</p>
      </Card>

      {/* Emotional Range */}
      <Card className="p-4">
        <Label className="text-sm font-medium">Emotional Range</Label>
        <Select value={emotionalRange} onValueChange={setEmotionalRange}>
          <SelectTrigger className="mt-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EMOTIONAL_RANGES.map((range) => (
              <SelectItem key={range} value={range}>
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {/* Personality Traits */}
      <Card className="p-4 space-y-3">
        <Label className="text-sm font-medium">Personality Traits</Label>
        <div className="flex gap-2">
          <Input
            value={newTrait}
            onChange={(e) => setNewTrait(e.target.value)}
            placeholder="Add a trait..."
            onKeyDown={(e) => e.key === "Enter" && handleAddTrait()}
          />
          <Button variant="outline" onClick={handleAddTrait}>
            Add
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {personalityTraits.map((trait) => (
            <Badge key={trait} variant="secondary" className="gap-1">
              {trait}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleRemoveTrait(trait)}
              />
            </Badge>
          ))}
        </div>
      </Card>

      {/* Archetype */}
      <Card className="p-4">
        <Label className="text-sm font-medium">Brand Archetype</Label>
        <Select value={archetype} onValueChange={setArchetype}>
          <SelectTrigger className="mt-2">
            <SelectValue placeholder="Select an archetype" />
          </SelectTrigger>
          <SelectContent>
            {ARCHETYPES.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Tone & Personality"}
        </Button>
      </div>
    </div>
  );
}
