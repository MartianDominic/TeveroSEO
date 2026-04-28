/**
 * Voice Setup Wizard
 * Phase 37-05: Voice Settings UI
 *
 * Guided mode selection wizard with decision tree:
 * 1. Intro - welcome and start
 * 2. Has Content - does client have existing website content?
 * 3. Preserve Sections - do they want to preserve specific sections?
 * 4. Select Mode - confirm recommended mode or choose manually
 * 5. Select Template - choose industry template or start fresh
 * 6. Creating - create profile and show result
 *
 * Decision tree logic:
 * - No content → best_practices mode
 * - Has content + preserve → preservation mode
 * - Has content + no preserve → application mode
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowRight, ArrowLeft, Check } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { Button } from "@/client/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/client/components/ui/radio-group";
import { Label } from "@/client/components/ui/label";
import { createVoiceProfileFn } from "@/serverFunctions/voice";
import {
  INDUSTRY_TEMPLATES,
  type IndustryTemplate,
} from "@/server/features/voice/templates/industryTemplates";

interface Props {
  clientId: string;
}

type Step =
  | "intro"
  | "has_content"
  | "preserve_sections"
  | "select_mode"
  | "select_template"
  | "creating";

type VoiceMode = "preservation" | "application" | "best_practices";

const MODE_DESCRIPTIONS: Record<VoiceMode, { title: string; description: string }> = {
  preservation: {
    title: "Preservation Mode",
    description:
      "Protect specific text and sections from SEO changes. Best for established brands with strict guidelines.",
  },
  application: {
    title: "Application Mode",
    description:
      "Write new content in your client's learned voice. AI learns from existing content and applies that style.",
  },
  best_practices: {
    title: "Best Practices Mode",
    description:
      "Use industry-standard voice settings. Great for new clients or when starting fresh.",
  },
};

export function VoiceWizard({ clientId }: Props) {
  const [step, setStep] = useState<Step>("intro");
  const [hasContent, setHasContent] = useState<boolean | null>(null);
  const [preserveSections, setPreserveSections] = useState<boolean | null>(null);
  const [selectedMode, setSelectedMode] = useState<VoiceMode>("best_practices");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: createVoiceProfileFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voice-profile", clientId] });
    },
  });

  /**
   * Get recommended mode based on decision tree answers.
   */
  const getRecommendedMode = (): VoiceMode => {
    if (!hasContent) return "best_practices";
    if (preserveSections) return "preservation";
    return "application";
  };

  /**
   * Handle final profile creation.
   */
  const handleCreate = () => {
    setStep("creating");
    createMutation.mutate({
      data: {
        clientId,
        mode: selectedMode,
        templateId: selectedTemplate ?? undefined,
      },
    });
  };

  /**
   * Navigate to previous step.
   */
  const goBack = () => {
    switch (step) {
      case "has_content":
        setStep("intro");
        break;
      case "preserve_sections":
        setStep("has_content");
        break;
      case "select_mode":
        if (hasContent) {
          setStep("preserve_sections");
        } else {
          setStep("has_content");
        }
        break;
      case "select_template":
        setStep("select_mode");
        break;
    }
  };

  /**
   * Render current step content.
   */
  const renderStep = () => {
    switch (step) {
      case "intro":
        return (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Let's set up your client's brand voice. This will help generate
              content that matches their unique style and tone.
            </p>
            <div className="flex justify-end">
              <Button onClick={() => setStep("has_content")}>
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      case "has_content":
        return (
          <div className="space-y-4">
            <h3 className="font-medium">
              Does this client have existing website content?
            </h3>
            <p className="text-sm text-muted-foreground">
              If they have established content, we can learn their voice from it.
            </p>
            <RadioGroup
              value={hasContent === null ? undefined : hasContent ? "yes" : "no"}
              onValueChange={(v) => {
                setHasContent(v === "yes");
                if (v === "yes") {
                  setStep("preserve_sections");
                } else {
                  setSelectedMode("best_practices");
                  setStep("select_mode");
                }
              }}
            >
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="yes" id="has-yes" />
                <Label htmlFor="has-yes" className="flex-1 cursor-pointer">
                  <span className="font-medium">Yes, they have established content</span>
                  <p className="text-sm text-muted-foreground">
                    Homepage, about page, blog posts, etc.
                  </p>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="no" id="has-no" />
                <Label htmlFor="has-no" className="flex-1 cursor-pointer">
                  <span className="font-medium">No, starting fresh</span>
                  <p className="text-sm text-muted-foreground">
                    New website or need to define the voice from scratch
                  </p>
                </Label>
              </div>
            </RadioGroup>
            <div className="flex justify-start pt-2">
              <Button variant="ghost" onClick={goBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </div>
          </div>
        );

      case "preserve_sections":
        return (
          <div className="space-y-4">
            <h3 className="font-medium">
              Do you want to protect specific sections from changes?
            </h3>
            <p className="text-sm text-muted-foreground">
              Some brands have mission statements, taglines, or other text that
              should never be modified by SEO optimizations.
            </p>
            <RadioGroup
              value={
                preserveSections === null
                  ? undefined
                  : preserveSections
                    ? "yes"
                    : "no"
              }
              onValueChange={(v) => {
                setPreserveSections(v === "yes");
                setSelectedMode(v === "yes" ? "preservation" : "application");
                setStep("select_mode");
              }}
            >
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="yes" id="preserve-yes" />
                <Label htmlFor="preserve-yes" className="flex-1 cursor-pointer">
                  <span className="font-medium">Yes, protect specific content</span>
                  <p className="text-sm text-muted-foreground">
                    Define pages, sections, or patterns to preserve
                  </p>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="no" id="preserve-no" />
                <Label htmlFor="preserve-no" className="flex-1 cursor-pointer">
                  <span className="font-medium">No, optimize everything</span>
                  <p className="text-sm text-muted-foreground">
                    Learn the voice and apply it to new content
                  </p>
                </Label>
              </div>
            </RadioGroup>
            <div className="flex justify-start pt-2">
              <Button variant="ghost" onClick={goBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </div>
          </div>
        );

      case "select_mode":
        const recommendedMode = getRecommendedMode();
        return (
          <div className="space-y-4">
            <h3 className="font-medium">Confirm voice mode</h3>
            <p className="text-sm text-muted-foreground">
              Based on your answers, we recommend{" "}
              <span className="font-medium">
                {MODE_DESCRIPTIONS[recommendedMode].title}
              </span>
              . You can change this at any time.
            </p>
            <RadioGroup
              value={selectedMode}
              onValueChange={(v) => setSelectedMode(v as VoiceMode)}
              className="space-y-2"
            >
              {(
                ["preservation", "application", "best_practices"] as VoiceMode[]
              ).map((mode) => (
                <div
                  key={mode}
                  className={`flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer ${
                    mode === recommendedMode ? "border-primary" : ""
                  }`}
                >
                  <RadioGroupItem value={mode} id={`mode-${mode}`} />
                  <Label htmlFor={`mode-${mode}`} className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {MODE_DESCRIPTIONS[mode].title}
                      </span>
                      {mode === recommendedMode && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {MODE_DESCRIPTIONS[mode].description}
                    </p>
                  </Label>
                </div>
              ))}
            </RadioGroup>
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={goBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button onClick={() => setStep("select_template")}>
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      case "select_template":
        return (
          <div className="space-y-4">
            <h3 className="font-medium">Select an industry template (optional)</h3>
            <p className="text-sm text-muted-foreground">
              Templates provide sensible defaults for tone, vocabulary, and style.
              You can customize everything later.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-2">
              {/* Skip template option */}
              <Card
                className={`cursor-pointer transition-all ${
                  selectedTemplate === null
                    ? "ring-2 ring-primary"
                    : "hover:border-primary/50"
                }`}
                onClick={() => setSelectedTemplate(null)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Start from Scratch</CardTitle>
                  <CardDescription>
                    Configure all settings manually
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground italic">
                    "Full control over every voice dimension"
                  </p>
                </CardContent>
              </Card>

              {/* Industry templates */}
              {INDUSTRY_TEMPLATES.map((template: IndustryTemplate) => (
                <Card
                  key={template.id}
                  className={`cursor-pointer transition-all ${
                    selectedTemplate === template.id
                      ? "ring-2 ring-primary"
                      : "hover:border-primary/50"
                  }`}
                  onClick={() => setSelectedTemplate(template.id)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <CardDescription>{template.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground italic line-clamp-2">
                      "{template.exampleContent.slice(0, 100)}..."
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={goBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleCreate}>
                {selectedTemplate ? "Create from Template" : "Create Profile"}
                <Check className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      case "creating":
        return (
          <div className="text-center py-8 space-y-4">
            {createMutation.isPending ? (
              <>
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                <p className="text-muted-foreground">Creating voice profile...</p>
              </>
            ) : createMutation.isError ? (
              <>
                <p className="text-destructive font-medium">
                  Failed to create profile
                </p>
                <p className="text-sm text-muted-foreground">
                  {(createMutation.error as Error).message}
                </p>
                <Button onClick={() => setStep("select_template")}>
                  Try Again
                </Button>
              </>
            ) : (
              <>
                <Check className="w-12 h-12 mx-auto text-green-500" />
                <p className="font-medium">Voice profile created!</p>
                <p className="text-sm text-muted-foreground">
                  You can now configure voice settings in detail.
                </p>
              </>
            )}
          </div>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Voice Setup Wizard</CardTitle>
        <CardDescription>
          Configure how content should sound for this client
        </CardDescription>
      </CardHeader>
      <CardContent>{renderStep()}</CardContent>
    </Card>
  );
}
