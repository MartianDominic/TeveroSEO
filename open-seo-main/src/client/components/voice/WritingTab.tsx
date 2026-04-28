/**
 * Writing Style Settings Tab
 * Phase 37-05: Voice Settings UI
 *
 * Controls for writing style dimensions:
 * - Sentence length slider with live preview
 * - Paragraph length slider
 * - Contraction usage radio buttons
 * - Heading style dropdown
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { Button } from "@/client/components/ui/button";
import { Label } from "@/client/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/client/components/ui/radio-group";
import { Slider } from "@/client/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { updateVoiceProfileFn } from "@/serverFunctions/voice";
import {
  CONTRACTION_USAGE,
  HEADING_STYLES,
  type ContractionUsage,
  type HeadingStyle,
  type VoiceProfileSelect,
} from "@/db/voice-schema";

interface Props {
  profile: VoiceProfileSelect;
  clientId: string;
}

const SAMPLE_HEADING = "How our services help your business grow";

export function WritingTab({ profile, clientId }: Props) {
  const queryClient = useQueryClient();

  // Local form state
  const [sentenceLengthAvg, setSentenceLengthAvg] = useState(
    profile.sentenceLengthAvg ?? 15
  );
  const [paragraphLengthAvg, setParagraphLengthAvg] = useState(
    profile.paragraphLengthAvg ?? 4
  );
  const [contractionUsage, setContractionUsage] = useState<ContractionUsage>(
    (profile.contractionUsage as ContractionUsage) ?? "sometimes"
  );
  const [headingStyle, setHeadingStyle] = useState<HeadingStyle>(
    (profile.headingStyle as HeadingStyle) ?? "sentence_case"
  );

  const updateMutation = useMutation({
    mutationFn: updateVoiceProfileFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voice-profile", clientId] });
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      data: {
        profileId: profile.id,
        sentenceLengthAvg,
        paragraphLengthAvg,
        contractionUsage,
        headingStyle,
      },
    });
  };

  /**
   * Transform heading based on selected style.
   */
  const formatHeading = (text: string): string => {
    switch (headingStyle) {
      case "title_case":
        return text
          .split(" ")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(" ");
      case "sentence_case":
        return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
      case "all_caps":
        return text.toUpperCase();
      default:
        return text;
    }
  };

  /**
   * Get example sentence based on length preference.
   */
  const getSentenceExample = (): string => {
    if (sentenceLengthAvg < 12) {
      return "We help you succeed. Our team is here for you. Contact us today.";
    }
    if (sentenceLengthAvg < 18) {
      return "We provide comprehensive solutions that help your business grow and thrive in today's competitive market.";
    }
    return "Our dedicated team of professionals works tirelessly to deliver exceptional results that exceed your expectations and help establish your brand as a leader in your industry.";
  };

  /**
   * Get example text with or without contractions.
   */
  const getContractionExample = (): string => {
    switch (contractionUsage) {
      case "never":
        return "We will help you achieve your goals. You are in good hands. It is our commitment to you.";
      case "sometimes":
        return "We'll help you achieve your goals. You are in good hands. It's our commitment to you.";
      case "frequently":
        return "We'll help you achieve your goals. You're in good hands. It's our commitment to you.";
      default:
        return "";
    }
  };

  return (
    <div className="space-y-6">
      {/* Sentence Length */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sentence Length</CardTitle>
          <CardDescription>
            Average number of words per sentence
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between">
            <Label>Target Length</Label>
            <span className="text-sm text-muted-foreground">
              ~{sentenceLengthAvg} words
            </span>
          </div>
          <Slider
            value={[sentenceLengthAvg]}
            onValueChange={([v]) => setSentenceLengthAvg(v)}
            min={8}
            max={25}
            step={1}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Short & punchy</span>
            <span>Long & detailed</span>
          </div>
          {/* Live preview */}
          <div className="p-3 bg-muted rounded-md mt-4">
            <p className="text-sm font-medium mb-1">Example:</p>
            <p className="text-sm text-muted-foreground italic">
              {getSentenceExample()}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Paragraph Length */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Paragraph Length</CardTitle>
          <CardDescription>
            Average number of sentences per paragraph
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between">
            <Label>Target Length</Label>
            <span className="text-sm text-muted-foreground">
              ~{paragraphLengthAvg} sentences
            </span>
          </div>
          <Slider
            value={[paragraphLengthAvg]}
            onValueChange={([v]) => setParagraphLengthAvg(v)}
            min={2}
            max={8}
            step={1}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Short paragraphs</span>
            <span>Long paragraphs</span>
          </div>
        </CardContent>
      </Card>

      {/* Contraction Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contraction Usage</CardTitle>
          <CardDescription>
            How often should contractions be used?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={contractionUsage}
            onValueChange={(v) => setContractionUsage(v as ContractionUsage)}
            className="space-y-2"
          >
            {CONTRACTION_USAGE.map((usage) => (
              <div key={usage} className="flex items-center space-x-2">
                <RadioGroupItem value={usage} id={`contraction-${usage}`} />
                <Label htmlFor={`contraction-${usage}`} className="cursor-pointer">
                  <span className="font-medium capitalize">{usage}</span>
                  <span className="text-sm text-muted-foreground ml-2">
                    {usage === "never"
                      ? "- Always use full forms"
                      : usage === "sometimes"
                        ? "- Use occasionally for naturalness"
                        : "- Use often for conversational tone"}
                  </span>
                </Label>
              </div>
            ))}
          </RadioGroup>
          {/* Live preview */}
          <div className="p-3 bg-muted rounded-md mt-4">
            <p className="text-sm font-medium mb-1">Example:</p>
            <p className="text-sm text-muted-foreground italic">
              {getContractionExample()}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Heading Style */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Heading Style</CardTitle>
          <CardDescription>
            Capitalization style for headings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            value={headingStyle}
            onValueChange={(v) => setHeadingStyle(v as HeadingStyle)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select heading style" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sentence_case">
                Sentence case - First word capitalized
              </SelectItem>
              <SelectItem value="title_case">
                Title Case - Each Word Capitalized
              </SelectItem>
              <SelectItem value="all_caps">
                ALL CAPS - Every Letter Uppercase
              </SelectItem>
            </SelectContent>
          </Select>
          {/* Live preview */}
          <div className="p-3 bg-muted rounded-md mt-4">
            <p className="text-sm font-medium mb-1">Example:</p>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold">{formatHeading(SAMPLE_HEADING)}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
