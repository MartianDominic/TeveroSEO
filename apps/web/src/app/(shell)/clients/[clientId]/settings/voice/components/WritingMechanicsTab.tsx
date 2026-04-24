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
  Textarea,
} from "@tevero/ui";
import type { VoiceProfile } from "@/lib/voiceApi";

interface WritingMechanicsTabProps {
  profile: VoiceProfile | null;
  onSave: (data: Partial<VoiceProfile>) => Promise<void>;
  saving: boolean;
}

export function WritingMechanicsTab({ profile, onSave, saving }: WritingMechanicsTabProps) {
  const [contractionUsage, setContractionUsage] = useState(profile?.contractionUsage ?? "sometimes");
  const [sentenceLength, setSentenceLength] = useState(profile?.sentenceLengthTarget ?? "varied");
  const [paragraphLength, setParagraphLength] = useState(profile?.paragraphLengthTarget ?? "short");
  const [listPreference, setListPreference] = useState(profile?.listPreference ?? "mixed");
  const [headingStyle, setHeadingStyle] = useState(profile?.headingStyle ?? "sentence_case");
  const [ctaTemplate, setCtaTemplate] = useState(profile?.ctaTemplate ?? "");
  const [keywordDensity, setKeywordDensity] = useState([profile?.keywordDensityTolerance ?? 3]);
  const [seoVoicePriority, setSeoVoicePriority] = useState([profile?.seoVsVoicePriority ?? 6]);

  const handleSave = useCallback(async () => {
    await onSave({
      contractionUsage,
      sentenceLengthTarget: sentenceLength,
      paragraphLengthTarget: paragraphLength,
      listPreference,
      headingStyle,
      ctaTemplate,
      keywordDensityTolerance: keywordDensity[0],
      seoVsVoicePriority: seoVoicePriority[0],
    });
  }, [contractionUsage, sentenceLength, paragraphLength, listPreference, headingStyle, ctaTemplate, keywordDensity, seoVoicePriority, onSave]);

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <Label>Contraction Usage</Label>
        <Select value={contractionUsage} onValueChange={setContractionUsage}>
          <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="always">Always</SelectItem>
            <SelectItem value="sometimes">Sometimes</SelectItem>
            <SelectItem value="never">Never</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <Card className="p-4">
        <Label>Sentence Length</Label>
        <Select value={sentenceLength} onValueChange={setSentenceLength}>
          <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="short">Short</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="long">Long</SelectItem>
            <SelectItem value="varied">Varied</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <Card className="p-4">
        <Label>Paragraph Length</Label>
        <Select value={paragraphLength} onValueChange={setParagraphLength}>
          <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="short">Short (2-3 sentences)</SelectItem>
            <SelectItem value="medium">Medium (4-6 sentences)</SelectItem>
            <SelectItem value="long">Long (7+ sentences)</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <Card className="p-4">
        <Label>List Preference</Label>
        <Select value={listPreference} onValueChange={setListPreference}>
          <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="bullets">Prefer Bullets</SelectItem>
            <SelectItem value="numbered">Prefer Numbered</SelectItem>
            <SelectItem value="mixed">Mixed</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <Card className="p-4">
        <Label>Heading Style</Label>
        <Select value={headingStyle} onValueChange={setHeadingStyle}>
          <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="title_case">Title Case</SelectItem>
            <SelectItem value="sentence_case">Sentence Case</SelectItem>
            <SelectItem value="all_caps">ALL CAPS</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <Card className="p-4 space-y-3">
        <Label>SEO vs Voice Priority</Label>
        <p className="text-xs text-muted-foreground">
          Balance between maintaining voice and optimizing for SEO
        </p>
        <Slider value={seoVoicePriority} onValueChange={setSeoVoicePriority} min={1} max={10} step={1} />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Voice Priority</span>
          <span>SEO Priority</span>
        </div>
        <p className="text-xs text-muted-foreground">Current: {seoVoicePriority[0]}/10</p>
      </Card>

      <Card className="p-4 space-y-3">
        <Label>Keyword Density Tolerance</Label>
        <p className="text-xs text-muted-foreground">
          Maximum keyword density percentage before flagging as over-optimized
        </p>
        <Slider value={keywordDensity} onValueChange={setKeywordDensity} min={1} max={10} step={0.5} />
        <p className="text-xs text-muted-foreground">Current: {keywordDensity[0]}%</p>
      </Card>

      <Card className="p-4">
        <Label>CTA Template</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Default call-to-action format for this client
        </p>
        <Textarea
          className="mt-2"
          value={ctaTemplate}
          onChange={(e) => setCtaTemplate(e.target.value)}
          placeholder="e.g., Contact us today for a free consultation!"
          rows={3}
        />
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Writing Style"}
        </Button>
      </div>
    </div>
  );
}
