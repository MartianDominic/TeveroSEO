"use client";

/**
 * KeywordAnalysisChat Component
 * Phase 82: Chat Integration + Phase 84: KeywordGenerator Integration
 *
 * Main chat interface for conversational keyword analysis.
 * Integrates CopilotKit tool, SSE progress, and results display.
 *
 * Phase 84 additions:
 * - Business description detection (vs keyword paste)
 * - KeywordGenerator integration for seed keyword generation
 * - Progress indicator during generation
 * - Keyword counts by category display
 */

import { useState, useCallback } from "react";

import { useCopilotAction } from "@copilotkit/react-core";
import {
  Upload,
  MessageSquare,
  History,
  Loader2,
  Sparkles,
  CheckCircle,
} from "lucide-react";

import { useKeywordAnalysis } from "@/hooks/useKeywordAnalysis";
import {
  analyzeKeywordsToolConfig,
  toAnalysisConfig,
  formatResultForChat,
  type AnalyzeKeywordsParams,
} from "@/lib/copilot/tools/keyword-analysis";
import {
  saveAnalysisSession,
  getClientSessions,
  type SessionSummary,
} from "@/lib/keyword-chat/session-service";

import { Button, Card, Textarea, Badge } from "@tevero/ui";

import { AnalysisProgress } from "./AnalysisProgress";
import { AnalysisResults } from "./AnalysisResults";
import {
  ClarifyingQuestionLoop,
  type ClarificationQuestion,
} from "./ClarifyingQuestionLoop";

interface KeywordAnalysisChatProps {
  clientId: string;
  workspaceId: string;
}

// Types for keyword generation
interface GeneratedKeywordsByCategory {
  product: string[];
  brand: string[];
  service: string[];
  commercial: string[];
  informational: string[];
}

interface KeywordCounts {
  total: number;
  product: number;
  brand: number;
  service: number;
  commercial: number;
  informational: number;
}

interface GenerateKeywordsResponse {
  success: boolean;
  keywords?: GeneratedKeywordsByCategory;
  counts?: KeywordCounts;
  clarificationNeeded?: Array<{
    field: string;
    question: string;
    options?: string[];
  }>;
  error?: string;
}

/**
 * Detect if input looks like a business description vs keywords.
 * Business descriptions typically have sentences and context.
 * Keywords are typically short, comma/newline separated.
 */
function isBusinessDescription(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  // If it has multiple lines with short entries, it's keywords
  const lines = trimmed.split(/[\n,]/).filter((l) => l.trim());
  if (lines.length > 5 && lines.every((l) => l.trim().split(/\s+/).length <= 4)) {
    return false;
  }

  // If it has sentence-like patterns (ending with period, question mark)
  const hasSentences = /[.!?]/.test(trimmed);

  // If it mentions business-related words
  const businessWords = [
    "we",
    "our",
    "sell",
    "provide",
    "offer",
    "business",
    "company",
    "service",
    "product",
    "client",
    "customer",
    "located",
    "based in",
    "serve",
    "target",
    "focus",
  ];
  const hasBusinessWords = businessWords.some((word) =>
    trimmed.toLowerCase().includes(word)
  );

  // If it's long and prose-like
  const isLongProse = trimmed.length > 100 && trimmed.split(/\s+/).length > 15;

  return hasSentences || hasBusinessWords || isLongProse;
}

export function KeywordAnalysisChat({
  clientId,
  workspaceId,
}: KeywordAnalysisChatProps) {
  // Form state
  const [conversation, setConversation] = useState("");
  const [keywordsText, setKeywordsText] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Keyword generation state (Phase 84)
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedKeywords, setGeneratedKeywords] =
    useState<GeneratedKeywordsByCategory | null>(null);
  const [keywordCounts, setKeywordCounts] = useState<KeywordCounts | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Clarifying questions state (Phase 84 Task 2)
  const [clarificationQuestions, setClarificationQuestions] = useState<
    ClarificationQuestion[]
  >([]);
  const [clarificationAnswers, setClarificationAnswers] = useState<
    Record<string, string>
  >({});

  // Analysis state from hook
  const {
    stage,
    progress,
    message,
    result,
    partials,
    error,
    isAnalyzing,
    analyze,
    reset,
  } = useKeywordAnalysis({
    onComplete: async (analysisResult) => {
      // Save session on completion
      try {
        await saveAnalysisSession({
          clientId,
          workspaceId,
          conversation,
          result: analysisResult,
        });
      } catch (err) {
        // Log error but don't fail the analysis
        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.error("Failed to save session:", err);
        }
      }
    },
  });

  // Parse keywords from text (one per line or comma-separated)
  const parseKeywords = useCallback((text: string): string[] => {
    return text
      .split(/[\n,]/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
  }, []);

  // Generate keywords from business description (Phase 84)
  const handleGenerateKeywords = useCallback(async () => {
    if (!conversation.trim()) {
      setGenerationError("Please describe your business first");
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);
    setGeneratedKeywords(null);
    setKeywordCounts(null);

    try {
      const response = await fetch("/api/keywords/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessDescription: conversation,
          language: "en", // TODO: Get from workspace settings
        }),
      });

      const data: GenerateKeywordsResponse = await response.json();

      if (!data.success) {
        setGenerationError(data.error || "Failed to generate keywords");
        return;
      }

      if (data.clarificationNeeded && data.clarificationNeeded.length > 0) {
        // Show clarifying questions loop (Phase 84 Task 2)
        setClarificationQuestions(data.clarificationNeeded);
        return;
      }

      if (data.keywords && data.counts) {
        setGeneratedKeywords(data.keywords);
        setKeywordCounts(data.counts);

        // Auto-populate keywords text for analysis
        const allKeywords = [
          ...data.keywords.product,
          ...data.keywords.brand,
          ...data.keywords.service,
          ...data.keywords.commercial,
          ...data.keywords.informational,
        ];
        setKeywordsText(allKeywords.join("\n"));
      }
    } catch (err) {
      setGenerationError(
        err instanceof Error ? err.message : "Failed to generate keywords"
      );
    } finally {
      setIsGenerating(false);
    }
  }, [conversation]);

  // Check if we should show generate button
  const showGenerateButton =
    isBusinessDescription(conversation) && !keywordsText.trim();

  // Handle clarifying question answer (Phase 84 Task 2)
  const handleClarificationAnswer = useCallback(
    (field: string, answer: string) => {
      setClarificationAnswers((prev) => ({
        ...prev,
        [field]: answer,
      }));
    },
    []
  );

  // Handle clarification completion - re-run generation with enriched context
  const handleClarificationComplete = useCallback(
    async (answers: Record<string, string>) => {
      setClarificationQuestions([]);

      // Build enriched context from answers
      const enrichedContext = Object.entries(answers)
        .map(([field, answer]) => `${field}: ${answer}`)
        .join(". ");

      setIsGenerating(true);
      setGenerationError(null);

      try {
        const response = await fetch("/api/keywords/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessDescription: conversation,
            language: "en",
            enrichedContext,
          }),
        });

        const data: GenerateKeywordsResponse = await response.json();

        if (!data.success) {
          setGenerationError(data.error || "Failed to generate keywords");
          return;
        }

        // If still need clarification (round 2 or 3)
        if (data.clarificationNeeded && data.clarificationNeeded.length > 0) {
          setClarificationQuestions(data.clarificationNeeded);
          return;
        }

        if (data.keywords && data.counts) {
          setGeneratedKeywords(data.keywords);
          setKeywordCounts(data.counts);

          const allKeywords = [
            ...data.keywords.product,
            ...data.keywords.brand,
            ...data.keywords.service,
            ...data.keywords.commercial,
            ...data.keywords.informational,
          ];
          setKeywordsText(allKeywords.join("\n"));
        }
      } catch (err) {
        setGenerationError(
          err instanceof Error ? err.message : "Failed to generate keywords"
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [conversation]
  );

  // Start analysis
  const handleAnalyze = useCallback(async () => {
    const keywords = parseKeywords(keywordsText);
    if (keywords.length === 0) {
      alert("Please enter at least one keyword");
      return;
    }
    if (keywords.length > 10000) {
      alert("Maximum 10,000 keywords allowed");
      return;
    }

    await analyze(clientId, conversation, keywords);
  }, [clientId, conversation, keywordsText, parseKeywords, analyze]);

  // Load previous sessions
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const data = await getClientSessions(clientId, 10);
      setSessions(data);
      setShowHistory(true);
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.error("Failed to load history:", err);
      }
    } finally {
      setLoadingHistory(false);
    }
  }, [clientId]);

  // Register CopilotKit action
  useCopilotAction({
    ...analyzeKeywordsToolConfig,
    handler: async (args) => {
      // Cast to our known params type
      const params = args as unknown as AnalyzeKeywordsParams;
      const keywords = params.keywords || [];
      const config = toAnalysisConfig(params);

      // Update form state for display
      setConversation(params.conversation || "");
      setKeywordsText(keywords.join("\n"));

      // Run analysis
      await analyze(clientId, params.conversation || "", keywords, config);

      // Return formatted result for chat
      if (result) {
        return formatResultForChat(result);
      }
      return "Analysis in progress...";
    },
  });

  const keywordCount = parseKeywords(keywordsText).length;

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Input section */}
      {!isAnalyzing && !result && (
        <Card className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              <MessageSquare className="inline h-4 w-4 mr-1" />
              Client Conversation
            </label>
            <Textarea
              value={conversation}
              onChange={(e) => setConversation(e.target.value)}
              placeholder="Paste the client conversation here. Describe their business, location, target audience, and what they want to achieve..."
              rows={4}
              className="w-full"
            />
          </div>

          {/* Keyword generation section (Phase 84) */}
          {showGenerateButton && !isGenerating && !generatedKeywords && (
            <Card className="p-3 bg-[var(--surface-1)] border-[var(--accent)]/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    <Sparkles className="inline h-4 w-4 mr-1 text-[var(--accent)]" />
                    Generate keywords from your business description
                  </p>
                  <p className="text-xs text-[var(--text-3)] mt-1">
                    We detected a business description. Would you like us to generate
                    relevant keywords?
                  </p>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleGenerateKeywords}
                >
                  Generate Keywords
                </Button>
              </div>
            </Card>
          )}

          {/* Generation progress */}
          {isGenerating && (
            <Card className="p-4 bg-[var(--surface-1)]">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
                <div>
                  <p className="text-sm font-medium">
                    Generating keywords based on your business...
                  </p>
                  <p className="text-xs text-[var(--text-3)]">
                    Analyzing description and creating keyword suggestions
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Clarifying questions loop (Phase 84 Task 2) */}
          {clarificationQuestions.length > 0 && (
            <ClarifyingQuestionLoop
              clarifications={clarificationQuestions}
              onAnswer={handleClarificationAnswer}
              onComplete={handleClarificationComplete}
            />
          )}

          {/* Generation error */}
          {generationError && (
            <Card className="p-3 border-[var(--error)] bg-[var(--error)]/10">
              <p className="text-sm text-[var(--error)]">{generationError}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setGenerationError(null)}
                className="mt-2"
              >
                Dismiss
              </Button>
            </Card>
          )}

          {/* Generated keywords summary */}
          {generatedKeywords && keywordCounts && (
            <Card className="p-4 bg-[var(--surface-1)] border-[var(--success)]/30">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-[var(--success)]" />
                  <span className="font-medium">
                    Generated {keywordCounts.total} keywords
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setGeneratedKeywords(null);
                    setKeywordCounts(null);
                    setKeywordsText("");
                  }}
                >
                  Clear
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {keywordCounts.product > 0 && (
                  <Badge variant="secondary">
                    {keywordCounts.product} product
                  </Badge>
                )}
                {keywordCounts.brand > 0 && (
                  <Badge variant="secondary">{keywordCounts.brand} brand</Badge>
                )}
                {keywordCounts.service > 0 && (
                  <Badge variant="secondary">
                    {keywordCounts.service} service
                  </Badge>
                )}
                {keywordCounts.commercial > 0 && (
                  <Badge variant="secondary">
                    {keywordCounts.commercial} commercial
                  </Badge>
                )}
                {keywordCounts.informational > 0 && (
                  <Badge variant="secondary">
                    {keywordCounts.informational} informational
                  </Badge>
                )}
              </div>
            </Card>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">
              <Upload className="inline h-4 w-4 mr-1" />
              Keywords ({keywordCount})
              {generatedKeywords && (
                <span className="text-[var(--text-3)] font-normal ml-2">
                  - Auto-populated from generation
                </span>
              )}
            </label>
            <Textarea
              value={keywordsText}
              onChange={(e) => setKeywordsText(e.target.value)}
              placeholder="Paste keywords here (one per line or comma-separated), or describe your business above to generate keywords..."
              rows={6}
              className="w-full font-mono text-sm"
            />
          </div>

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={loadHistory}
              disabled={loadingHistory}
            >
              {loadingHistory ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <History className="h-4 w-4 mr-2" />
              )}
              Previous Analyses
            </Button>

            <Button
              onClick={handleAnalyze}
              disabled={keywordCount === 0 || !conversation.trim()}
            >
              Analyze Keywords
            </Button>
          </div>
        </Card>
      )}

      {/* Progress section */}
      {isAnalyzing && (
        <AnalysisProgress
          stage={stage}
          progress={progress}
          message={message}
          partials={partials}
        />
      )}

      {/* Error display */}
      {error && (
        <Card className="p-4 border-[var(--error)] bg-[var(--error)]/10">
          <p className="text-[var(--error)]">{error}</p>
          <Button variant="outline" size="sm" onClick={reset} className="mt-2">
            Try Again
          </Button>
        </Card>
      )}

      {/* Results section */}
      {result && (
        <>
          <AnalysisResults result={result} />
          <div className="flex justify-end pt-4">
            <Button variant="outline" onClick={reset}>
              New Analysis
            </Button>
          </div>
        </>
      )}

      {/* History drawer */}
      {showHistory && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">Previous Analyses</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory(false)}
            >
              Close
            </Button>
          </div>
          {sessions.length === 0 ? (
            <p className="text-[var(--text-3)]">No previous analyses found.</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-2 bg-[var(--surface-1)] rounded border border-[var(--hairline)] hover:border-[var(--accent)] cursor-pointer"
                  onClick={() => {
                    // TODO: Load full session result
                    setShowHistory(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setShowHistory(false);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div>
                    <span className="text-sm">
                      {new Date(session.createdAt).toLocaleDateString()}
                    </span>
                    <span className="text-[var(--text-3)] ml-2">
                      {session.keywordCount} keywords
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-[var(--success)]">
                      {session.selectedCount}
                    </span>
                    <span className="text-[var(--text-3)]"> selected</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
