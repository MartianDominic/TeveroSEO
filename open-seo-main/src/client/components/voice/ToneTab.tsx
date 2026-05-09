/**
 * Tone Settings Tab
 * Phase 37-05: Voice Settings UI
 *
 * Controls for voice mode and tone dimensions:
 * - Mode selection (preservation/application/best_practices)
 * - Primary and secondary tone inputs
 * - Formality slider (1-10)
 * - Archetype dropdown
 * - Personality traits multi-select
 * - "Learn Voice" button with progress tracking
 */
import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles, Save } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
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
import { Badge } from "@/client/components/ui/badge";
import { Progress } from "@/client/components/ui/progress";
import { updateVoiceProfileFn } from "@/serverFunctions/voice";
import {
  ARCHETYPES,
  type Archetype,
  type VoiceProfileSelect,
} from "@/db/voice-schema";

interface Props {
  profile: VoiceProfileSelect;
  clientId: string;
}

const PERSONALITY_TRAIT_OPTIONS = [
  "caring",
  "knowledgeable",
  "trustworthy",
  "innovative",
  "reliable",
  "efficient",
  "precise",
  "confident",
  "approachable",
  "energetic",
  "helpful",
  "creative",
  "forward-thinking",
  "honest",
  "hardworking",
  "prudent",
  "dependable",
  "warm",
];

export function ToneTab({ profile, clientId }: Props) {
  const queryClient = useQueryClient();

  // Local form state
  const [mode, setMode] = useState(profile.mode);
  const [tonePrimary, setTonePrimary] = useState(profile.tonePrimary ?? "");
  const [toneSecondary, setToneSecondary] = useState(profile.toneSecondary ?? "");
  const [formalityLevel, setFormalityLevel] = useState(
    profile.formalityLevel ?? 5
  );
  const [archetype, setArchetype] = useState<Archetype | "">(
    (profile.archetype as Archetype) ?? ""
  );
  const [personalityTraits, setPersonalityTraits] = useState<string[]>(
    profile.personalityTraits ?? []
  );

  // Learning progress state
  const [isLearning, setIsLearning] = useState(false);
  const [learningProgress, setLearningProgress] = useState(0);
  const [learningError, setLearningError] = useState<string | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

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
        mode: mode as "preservation" | "application" | "best_practices",
        tonePrimary: tonePrimary || undefined,
        toneSecondary: toneSecondary || undefined,
        formalityLevel,
        archetype: archetype || undefined,
        personalityTraits:
          personalityTraits.length > 0 ? personalityTraits : undefined,
      },
    });
  };

  const toggleTrait = (trait: string) => {
    setPersonalityTraits((prev) =>
      prev.includes(trait) ? prev.filter((t) => t !== trait) : [...prev, trait]
    );
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const pollJobStatus = async (jobId: string) => {
    try {
      const res = await fetch(`/api/seo/voice/${clientId}/job/${jobId}`);
      const json = (await res.json()) as {
        success: boolean;
        error?: string;
        data?: { state: string; progress: number; failedReason?: string };
      };

      if (!json.success) {
        throw new Error(json.error || "Failed to get job status");
      }

      const { state, progress, failedReason } = json.data!;
      setLearningProgress(progress);

      if (state === "completed") {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setIsLearning(false);
        setLearningProgress(100);
        queryClient.invalidateQueries({ queryKey: ["voice-profile", clientId] });
      } else if (state === "failed") {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setIsLearning(false);
        setLearningError(failedReason || "Voice analysis failed");
      }
    } catch (err) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      setIsLearning(false);
      setLearningError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  const handleLearnVoice = async () => {
    if (!websiteUrl.trim()) {
      setLearningError("Please enter a website URL");
      return;
    }

    setIsLearning(true);
    setLearningProgress(0);
    setLearningError(null);

    try {
      // Trigger voice analysis
      const res = await fetch(`/api/seo/voice/${clientId}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: [websiteUrl.trim()] }),
      });

      const json = (await res.json()) as {
        success: boolean;
        error?: string;
        data?: { jobId: string };
      };

      if (!json.success) {
        throw new Error(json.error || "Failed to start voice analysis");
      }

      const { jobId } = json.data!;

      // Poll for job status every 2 seconds
      pollingRef.current = setInterval(() => {
        void pollJobStatus(jobId);
      }, 2000);

      // Initial poll
      void pollJobStatus(jobId);
    } catch (err) {
      setIsLearning(false);
      setLearningError(err instanceof Error ? err.message : "Failed to start analysis");
    }
  };

  return (
    <div className="space-y-6">
      {/* Voice Mode Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Voice Mode</CardTitle>
          <CardDescription>
            How should the voice profile be applied?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={mode}
            onValueChange={(v) =>
              setMode(v as "preservation" | "application" | "best_practices")
            }
            className="space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="preservation" id="mode-preservation" />
              <Label htmlFor="mode-preservation" className="cursor-pointer">
                <span className="font-medium">Preservation</span>
                <span className="text-sm text-muted-foreground ml-2">
                  - Protect brand text from changes
                </span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="application" id="mode-application" />
              <Label htmlFor="mode-application" className="cursor-pointer">
                <span className="font-medium">Application</span>
                <span className="text-sm text-muted-foreground ml-2">
                  - Write in client's learned voice
                </span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="best_practices" id="mode-best-practices" />
              <Label htmlFor="mode-best-practices" className="cursor-pointer">
                <span className="font-medium">Best Practices</span>
                <span className="text-sm text-muted-foreground ml-2">
                  - Use industry defaults
                </span>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Tone Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tone Settings</CardTitle>
          <CardDescription>
            Define the primary and secondary tone for content
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tone-primary">Primary Tone</Label>
              <Input
                id="tone-primary"
                placeholder="e.g., professional, friendly"
                value={tonePrimary}
                onChange={(e) => setTonePrimary(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tone-secondary">Secondary Tone</Label>
              <Input
                id="tone-secondary"
                placeholder="e.g., confident, warm"
                value={toneSecondary}
                onChange={(e) => setToneSecondary(e.target.value)}
              />
            </div>
          </div>

          {/* Formality Slider */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Formality Level</Label>
              <span className="text-sm text-muted-foreground">
                {formalityLevel}/10
              </span>
            </div>
            <Slider
              value={[formalityLevel]}
              onValueChange={([v]) => setFormalityLevel(v)}
              min={1}
              max={10}
              step={1}
            />
            <div className="flex justify-between text-xs-safe text-muted-foreground">
              <span>Casual</span>
              <span>Formal</span>
            </div>
          </div>

          {/* Archetype Select */}
          <div className="space-y-2">
            <Label>Archetype</Label>
            <Select
              value={archetype}
              onValueChange={(v) => setArchetype(v as Archetype)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select archetype" />
              </SelectTrigger>
              <SelectContent>
                {ARCHETYPES.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a.charAt(0).toUpperCase() + a.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Personality Traits */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personality Traits</CardTitle>
          <CardDescription>
            Select traits that describe the brand personality
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {PERSONALITY_TRAIT_OPTIONS.map((trait) => (
              <Badge
                key={trait}
                variant={personalityTraits.includes(trait) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleTrait(trait)}
              >
                {trait}
              </Badge>
            ))}
          </div>
          {personalityTraits.length > 0 && (
            <p className="text-sm text-muted-foreground mt-3">
              Selected: {personalityTraits.join(", ")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Learn Voice Button */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Voice Learning</CardTitle>
          <CardDescription>
            Analyze existing content to extract voice patterns
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isLearning && (
            <div className="space-y-2">
              <Label htmlFor="website-url">Website URL</Label>
              <Input
                id="website-url"
                placeholder="https://example.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                disabled={mode === "best_practices"}
              />
            </div>
          )}
          {isLearning ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Analyzing content...</span>
              </div>
              <Progress value={learningProgress} />
              <p className="text-xs-safe text-muted-foreground">
                {learningProgress < 30
                  ? "Scraping website pages..."
                  : learningProgress < 60
                    ? "Extracting tone patterns..."
                    : learningProgress < 90
                      ? "Analyzing vocabulary..."
                      : "Finalizing profile..."}
              </p>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => void handleLearnVoice()}
              disabled={mode === "best_practices" || !websiteUrl.trim()}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Learn Voice from Website
            </Button>
          )}
          {learningError && (
            <p className="text-xs-safe text-destructive">{learningError}</p>
          )}
          {mode === "best_practices" && (
            <p className="text-xs-safe text-muted-foreground">
              Voice learning is not available in Best Practices mode
            </p>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending}
        >
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
