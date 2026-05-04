/**
 * New Content Brief Wizard
 * Phase 36: Content Brief Generation
 *
 * 3-step wizard: Keyword Selection → SERP Preview → Voice Mode Config
 */
import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowLeft, ArrowRight, Check, Search, Mic, FileText } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/client/components/ui/radio-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/client/components/ui/tooltip";
import { Badge } from "@/client/components/ui/badge";
import {
  analyzeSerpFn,
  createBriefFn,
  type SerpAnalysisData,
} from "@/serverFunctions/briefs";

export const Route = createFileRoute("/_app/clients/$clientId/briefs/new")({
  component: NewBriefWizard,
});

type VoiceMode = "preservation" | "application" | "best_practices";

interface WizardState {
  step: 1 | 2 | 3;
  mappingId: string;
  keyword: string;
  serpAnalysis: SerpAnalysisData | null;
  voiceMode: VoiceMode;
}

const VOICE_MODE_INFO: Record<VoiceMode, { label: string; description: string }> = {
  preservation: {
    label: "Voice Preservation",
    description: "Maintains the existing voice and tone from your current content. Best for established brands with consistent messaging.",
  },
  application: {
    label: "Brand Application",
    description: "Applies your brand guidelines to create content that fits your brand identity. Ideal for agencies managing multiple client voices.",
  },
  best_practices: {
    label: "SEO Best Practices",
    description: "Optimizes content structure and language for search engines. Recommended for new content targeting competitive keywords.",
  },
};

function NewBriefWizard() {
  const { clientId } = useParams({
        from: "/_app/clients/$clientId/briefs/new",
  });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [state, setState] = useState<WizardState>({
    step: 1,
    mappingId: "",
    keyword: "",
    serpAnalysis: null,
    voiceMode: "best_practices",
  });

  const analyzeMutation = useMutation({
    mutationFn: () => analyzeSerpFn({ data: { mappingId: state.mappingId } }),
    onSuccess: (data) => {
      setState((prev) => ({ ...prev, serpAnalysis: data, step: 2 }));
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createBriefFn({
        data: {
          mappingId: state.mappingId,
          voiceMode: state.voiceMode,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["briefs", clientId] });
            navigate({ to: "/clients/$clientId/briefs", params: { clientId } });
    },
  });

  const handleKeywordSelect = (mappingId: string, keyword: string) => {
    setState((prev) => ({ ...prev, mappingId, keyword }));
  };

  const handleAnalyze = () => {
    if (state.mappingId) {
      analyzeMutation.mutate();
    }
  };

  const handleVoiceModeChange = (mode: VoiceMode) => {
    setState((prev) => ({ ...prev, voiceMode: mode }));
  };

  const handleCreate = () => {
    createMutation.mutate();
  };

  const handleBack = () => {
    setState((prev) => ({
      ...prev,
      step: (prev.step - 1) as 1 | 2 | 3,
    }));
  };

  const handleNext = () => {
    setState((prev) => ({
      ...prev,
      step: (prev.step + 1) as 1 | 2 | 3,
    }));
  };

  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4 mb-4">
            {[1, 2, 3].map((stepNum) => (
              <div key={stepNum} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    state.step >= stepNum
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {state.step > stepNum ? <Check className="w-4 h-4" /> : stepNum}
                </div>
                {stepNum < 3 && (
                  <div
                    className={`w-12 h-0.5 ${
                      state.step > stepNum ? "bg-primary" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <CardTitle>
            {state.step === 1 && "Select Keyword"}
            {state.step === 2 && "Review SERP Analysis"}
            {state.step === 3 && "Configure Voice Mode"}
          </CardTitle>
          <CardDescription>
            {state.step === 1 && "Choose a keyword from your mapping table to create a brief for."}
            {state.step === 2 && "Review competitor data and search patterns before proceeding."}
            {state.step === 3 && "Select how the content should be written."}
          </CardDescription>
        </CardHeader>

        <CardContent className="min-h-[300px]">
          {state.step === 1 && (
            <Step1KeywordSelect
              selectedMappingId={state.mappingId}
              selectedKeyword={state.keyword}
              onSelect={handleKeywordSelect}
            />
          )}

          {state.step === 2 && (
            <Step2SerpPreview serpAnalysis={state.serpAnalysis} />
          )}

          {state.step === 3 && (
            <Step3VoiceMode
              selected={state.voiceMode}
              onChange={handleVoiceModeChange}
            />
          )}
        </CardContent>

        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
                        onClick={state.step === 1 ? () => navigate({ to: "/clients/$clientId/briefs", params: { clientId } }) : handleBack}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {state.step === 1 ? "Cancel" : "Back"}
          </Button>

          {state.step === 1 && (
            <Button
              onClick={handleAnalyze}
              disabled={!state.mappingId || analyzeMutation.isPending}
            >
              {analyzeMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Analyze SERP
                </>
              )}
            </Button>
          )}

          {state.step === 2 && (
            <Button onClick={handleNext}>
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}

          {state.step === 3 && (
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Create Brief
                </>
              )}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

function Step1KeywordSelect({
  selectedMappingId,
  selectedKeyword,
  onSelect,
}: {
  selectedMappingId: string;
  selectedKeyword: string;
  onSelect: (mappingId: string, keyword: string) => void;
}) {
  const [search, setSearch] = useState("");

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="keyword-search">Search keywords</Label>
        <Input
          id="keyword-search"
          placeholder="Type to search mapped keywords..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mt-1"
        />
      </div>

      <div className="border rounded-md p-4 min-h-[200px]">
        <p className="text-sm text-muted-foreground mb-4">
          Select a keyword from your keyword-page mapping to create a content brief.
        </p>

        {selectedKeyword ? (
          <div className="p-3 border rounded-md bg-muted/50">
            <div className="flex items-center justify-between">
              <span className="font-medium">{selectedKeyword}</span>
              <Badge variant="outline">Selected</Badge>
            </div>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            No keyword selected. Use the keyword mapping page to add keywords first.
          </p>
        )}

        <div className="mt-4">
          <Label htmlFor="mapping-id">Or enter Mapping ID directly:</Label>
          <div className="flex gap-2 mt-1">
            <Input
              id="mapping-id"
              placeholder="mapping_abc123..."
              value={selectedMappingId}
              onChange={(e) => onSelect(e.target.value, e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Step2SerpPreview({ serpAnalysis }: { serpAnalysis: SerpAnalysisData | null }) {
  if (!serpAnalysis) {
    return (
      <div className="flex items-center justify-center h-[200px]">
        <p className="text-muted-foreground">No SERP data available</p>
      </div>
    );
  }

  const avgWordCount =
    serpAnalysis.competitorWordCounts.length > 0
      ? Math.round(
          serpAnalysis.competitorWordCounts.reduce((a, b) => a + b, 0) /
            serpAnalysis.competitorWordCounts.length
        )
      : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Target Word Count</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {avgWordCount > 0 ? Math.round(avgWordCount * 1.2).toLocaleString() : "1,800"}
            </p>
            <p className="text-xs text-muted-foreground">
              Based on competitor avg ({avgWordCount.toLocaleString()}) + 20%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Meta Lengths</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Title: <span className="font-medium">{serpAnalysis.metaLengths.title} chars</span>
            </p>
            <p className="text-sm">
              Desc: <span className="font-medium">{serpAnalysis.metaLengths.description} chars</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {serpAnalysis.paaQuestions.length > 0 && (
        <div>
          <h4 className="font-medium mb-2">People Also Ask</h4>
          <ul className="space-y-1">
            {serpAnalysis.paaQuestions.slice(0, 5).map((q, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-primary">•</span>
                {q}
              </li>
            ))}
          </ul>
        </div>
      )}

      {serpAnalysis.commonH2s.length > 0 && (
        <div>
          <h4 className="font-medium mb-2">Common H2 Headings</h4>
          <div className="flex flex-wrap gap-2">
            {serpAnalysis.commonH2s.slice(0, 6).map((h2, i) => (
              <Badge key={i} variant="secondary">
                {h2.heading} ({h2.frequency}x)
              </Badge>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Analyzed: {new Date(serpAnalysis.analyzedAt).toLocaleDateString()} • {serpAnalysis.location}
      </p>
    </div>
  );
}

function Step3VoiceMode({
  selected,
  onChange,
}: {
  selected: VoiceMode;
  onChange: (mode: VoiceMode) => void;
}) {
  return (
    <TooltipProvider>
      <RadioGroup value={selected} onValueChange={(v: string) => onChange(v as VoiceMode)}>
        <div className="space-y-4">
          {(Object.entries(VOICE_MODE_INFO) as [VoiceMode, { label: string; description: string }][]).map(
            ([mode, { label, description }]) => (
              <Tooltip key={mode}>
                <TooltipTrigger asChild>
                  <div
                    className={`flex items-start space-x-4 p-4 border rounded-lg cursor-pointer transition-colors ${
                      selected === mode
                        ? "border-primary bg-primary/5"
                        : "hover:border-muted-foreground/50"
                    }`}
                    onClick={() => onChange(mode)}
                  >
                    <RadioGroupItem value={mode} id={mode} className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor={mode} className="font-medium cursor-pointer flex items-center gap-2">
                        <Mic className="w-4 h-4" />
                        {label}
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {description}
                      </p>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p>{description}</p>
                </TooltipContent>
              </Tooltip>
            )
          )}
        </div>
      </RadioGroup>
    </TooltipProvider>
  );
}
