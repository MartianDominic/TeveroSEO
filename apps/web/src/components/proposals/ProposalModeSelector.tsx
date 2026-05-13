"use client";

/**
 * ProposalModeSelector Component
 * Phase 101-06: Tiered AI Proposal Generation
 *
 * Shows 4 mode cards per D-03 Tiered AI Involvement:
 * - Full AI: AI generates everything
 * - AI-Assisted: User provides key details, AI fills gaps
 * - Template: Pick template, fill manually (no AI)
 * - Blank: Start from scratch (no AI)
 *
 * Mode selection reveals mode-specific configuration.
 * Per UI spec: Horizontal tabs with icons and AI level badges.
 */

import * as React from "react";
import { Sparkles, Edit3, FileText, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

/**
 * Generation modes per D-03
 */
export const ProposalGenerationMode = {
  FULL_AI: "full_ai",
  AI_ASSISTED: "ai_assisted",
  TEMPLATE_MANUAL: "template_manual",
  BLANK: "blank",
} as const;

export type ProposalGenerationModeType =
  (typeof ProposalGenerationMode)[keyof typeof ProposalGenerationMode];

/**
 * Mode configuration with metadata
 */
interface ModeConfig {
  id: ProposalGenerationModeType;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  aiLevel: "full" | "partial" | "none";
  shortcut: string;
}

const MODE_CONFIGS: ModeConfig[] = [
  {
    id: ProposalGenerationMode.FULL_AI,
    name: "Full AI",
    description: "AI generates complete proposal from domain and package",
    icon: Sparkles,
    aiLevel: "full",
    shortcut: "1",
  },
  {
    id: ProposalGenerationMode.AI_ASSISTED,
    name: "AI-Assisted",
    description: "Provide key details, AI fills in the gaps",
    icon: Edit3,
    aiLevel: "partial",
    shortcut: "2",
  },
  {
    id: ProposalGenerationMode.TEMPLATE_MANUAL,
    name: "Template",
    description: "Pick template and package, fill manually",
    icon: FileText,
    aiLevel: "none",
    shortcut: "3",
  },
  {
    id: ProposalGenerationMode.BLANK,
    name: "Blank",
    description: "Start from scratch for custom deals",
    icon: Plus,
    aiLevel: "none",
    shortcut: "4",
  },
];

/**
 * Input data for Full AI mode
 */
interface FullAIInput {
  additionalContext?: string;
}

/**
 * Input data for AI-Assisted mode
 */
interface AIAssistedInput {
  headline?: string;
  painPoints: string[];
  opportunities: string[];
  customInclusions: string[];
}

/**
 * Props for ProposalModeSelector
 */
interface ProposalModeSelectorProps {
  /** ID of the prospect to generate proposal for */
  prospectId: string;
  /** ID of the selected package */
  packageId: string | null;
  /** ID of the selected template (optional for some modes) */
  templateId?: string | null;
  /** Called when proposal is generated */
  onGenerate: (result: {
    proposalId: string;
    mode: ProposalGenerationModeType;
    aiGenerated: boolean;
  }) => void;
  /** Called on generation error */
  onError?: (error: Error) => void;
  /** Initial mode selection */
  defaultMode?: ProposalGenerationModeType;
  /** Whether generation is in progress */
  isLoading?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * AI level badge component
 */
function AILevelBadge({ level }: { level: "full" | "partial" | "none" }) {
  const variants: Record<typeof level, { variant: "default" | "warning" | "muted"; label: string }> = {
    full: { variant: "default", label: "AI" },
    partial: { variant: "warning", label: "AI+" },
    none: { variant: "muted", label: "Manual" },
  };

  const { variant, label } = variants[level];

  return (
    <Badge variant={variant} className="text-[10px] px-1.5 py-0.5">
      {label}
    </Badge>
  );
}

/**
 * ProposalModeSelector Component
 *
 * Displays 4 generation mode tabs with mode-specific configuration.
 * Handles API calls to /api/proposals/tiered-generate.
 */
export function ProposalModeSelector({
  prospectId,
  packageId,
  templateId,
  onGenerate,
  onError,
  defaultMode = ProposalGenerationMode.FULL_AI,
  isLoading = false,
  className,
}: ProposalModeSelectorProps) {
  const [selectedMode, setSelectedMode] = React.useState<ProposalGenerationModeType>(defaultMode);
  const [generating, setGenerating] = React.useState(false);

  // Full AI mode state
  const [additionalContext, setAdditionalContext] = React.useState("");

  // AI-Assisted mode state
  const [headline, setHeadline] = React.useState("");
  const [painPoints, setPainPoints] = React.useState("");
  const [opportunities, setOpportunities] = React.useState("");

  // Keyboard shortcuts for mode selection
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not in input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const modeByKey: Record<string, ProposalGenerationModeType> = {
        "1": ProposalGenerationMode.FULL_AI,
        "2": ProposalGenerationMode.AI_ASSISTED,
        "3": ProposalGenerationMode.TEMPLATE_MANUAL,
        "4": ProposalGenerationMode.BLANK,
      };

      if (modeByKey[e.key]) {
        e.preventDefault();
        setSelectedMode(modeByKey[e.key]);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  /**
   * Build request payload based on selected mode
   */
  const buildPayload = () => {
    switch (selectedMode) {
      case ProposalGenerationMode.FULL_AI:
        return {
          mode: selectedMode,
          prospectId,
          packageId,
          templateId: templateId || undefined,
          additionalContext: additionalContext || undefined,
        };

      case ProposalGenerationMode.AI_ASSISTED:
        return {
          mode: selectedMode,
          prospectId,
          packageId,
          templateId: templateId || undefined,
          partialContent: {
            headline: headline || undefined,
            painPoints: painPoints
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
            opportunities: opportunities
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
          },
        };

      case ProposalGenerationMode.TEMPLATE_MANUAL:
        return {
          mode: selectedMode,
          prospectId,
          templateId: templateId!,
          packageId,
        };

      case ProposalGenerationMode.BLANK:
        return {
          mode: selectedMode,
          prospectId,
        };
    }
  };

  /**
   * Check if current mode configuration is valid
   */
  const isValid = () => {
    if (!prospectId) return false;

    switch (selectedMode) {
      case ProposalGenerationMode.FULL_AI:
      case ProposalGenerationMode.AI_ASSISTED:
        return !!packageId;

      case ProposalGenerationMode.TEMPLATE_MANUAL:
        return !!templateId && !!packageId;

      case ProposalGenerationMode.BLANK:
        return true;
    }
  };

  /**
   * Handle generate button click
   */
  const handleGenerate = async () => {
    if (!isValid()) return;

    setGenerating(true);

    try {
      const payload = buildPayload();
      const response = await fetch("/api/proposals/tiered-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Generation failed");
      }

      onGenerate({
        proposalId: data.data.proposalId,
        mode: data.data.mode,
        aiGenerated: data.data.aiGenerated,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
    } finally {
      setGenerating(false);
    }
  };

  const loading = isLoading || generating;

  return (
    <Card className={cn("w-full", className)} noHover>
      <CardHeader>
        <CardTitle>Generate Proposal</CardTitle>
        <CardDescription>
          Choose how much AI assistance you want for this proposal
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs
          value={selectedMode}
          onValueChange={(v) => setSelectedMode(v as ProposalGenerationModeType)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-4 mb-6">
            {MODE_CONFIGS.map((mode) => {
              const Icon = mode.icon;
              return (
                <TabsTrigger
                  key={mode.id}
                  value={mode.id}
                  className="flex flex-col gap-1 h-auto py-3 px-2"
                  disabled={loading}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="text-sm font-medium">{mode.name}</span>
                  </div>
                  <AILevelBadge level={mode.aiLevel} />
                  <span className="hidden lg:inline text-[10px] text-text-3 mt-1">
                    Press {mode.shortcut}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Full AI Mode Content */}
          <TabsContent value={ProposalGenerationMode.FULL_AI} className="space-y-4">
            <div className="rounded-lg bg-surface-2 p-4">
              <p className="text-sm text-text-2">
                AI will generate the complete proposal including headline, opportunities,
                ROI projections, and investment details based on the prospect domain and
                selected package.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="additionalContext">Additional Context (optional)</Label>
              <Textarea
                id="additionalContext"
                placeholder="Any specific details about the client, their goals, or the sales conversation..."
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                rows={3}
                disabled={loading}
              />
            </div>
          </TabsContent>

          {/* AI-Assisted Mode Content */}
          <TabsContent value={ProposalGenerationMode.AI_ASSISTED} className="space-y-4">
            <div className="rounded-lg bg-surface-2 p-4">
              <p className="text-sm text-text-2">
                Provide key details from your sales conversation. AI will expand on your
                input to create a personalized proposal.
              </p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="headline">Custom Headline</Label>
                <Input
                  id="headline"
                  placeholder="e.g., Unlock Growth Potential for [Company]"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="painPoints">Pain Points (one per line)</Label>
                <Textarea
                  id="painPoints"
                  placeholder="Low organic traffic&#10;Poor keyword rankings&#10;Competitors outranking them"
                  value={painPoints}
                  onChange={(e) => setPainPoints(e.target.value)}
                  rows={3}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="opportunities">Opportunities (one per line)</Label>
                <Textarea
                  id="opportunities"
                  placeholder="Untapped long-tail keywords&#10;Content gaps vs competitors&#10;Technical SEO quick wins"
                  value={opportunities}
                  onChange={(e) => setOpportunities(e.target.value)}
                  rows={3}
                  disabled={loading}
                />
              </div>
            </div>
          </TabsContent>

          {/* Template Manual Mode Content */}
          <TabsContent value={ProposalGenerationMode.TEMPLATE_MANUAL} className="space-y-4">
            <div className="rounded-lg bg-surface-2 p-4">
              <p className="text-sm text-text-2">
                Start with a template structure and package pricing. You will fill in
                client-specific details manually after creation.
              </p>
            </div>
            {!templateId && (
              <div className="rounded-lg border border-warning/30 bg-warning-soft p-4">
                <p className="text-sm text-warning">
                  Please select a template above to use this mode.
                </p>
              </div>
            )}
          </TabsContent>

          {/* Blank Mode Content */}
          <TabsContent value={ProposalGenerationMode.BLANK} className="space-y-4">
            <div className="rounded-lg bg-surface-2 p-4">
              <p className="text-sm text-text-2">
                Start with a completely blank proposal structure. Best for fully custom
                deals that do not fit standard packages.
              </p>
            </div>
            <div className="rounded-lg border border-hairline p-4">
              <p className="text-sm text-text-3">
                No additional configuration needed. The proposal will be created with
                empty sections for you to fill in.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Generate Button */}
        <div className="mt-6 flex justify-end">
          <Button
            variant="primary"
            onClick={handleGenerate}
            disabled={!isValid() || loading}
            className="min-w-[160px]"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Proposal
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default ProposalModeSelector;
