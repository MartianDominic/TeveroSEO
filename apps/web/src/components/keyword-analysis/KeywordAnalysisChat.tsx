"use client";

/**
 * KeywordAnalysisChat Component
 * Phase 82: Chat Integration
 *
 * Main chat interface for conversational keyword analysis.
 * Integrates CopilotKit tool, SSE progress, and results display.
 */

import { useState, useCallback } from "react";
import { useCopilotAction } from "@copilotkit/react-core";
import { Button, Card, Textarea } from "@tevero/ui";
import { Upload, MessageSquare, History, Loader2 } from "lucide-react";
import { useKeywordAnalysis } from "@/hooks/useKeywordAnalysis";
import { AnalysisProgress } from "./AnalysisProgress";
import { AnalysisResults } from "./AnalysisResults";
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

interface KeywordAnalysisChatProps {
  clientId: string;
  workspaceId: string;
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

          <div>
            <label className="block text-sm font-medium mb-2">
              <Upload className="inline h-4 w-4 mr-1" />
              Keywords ({keywordCount})
            </label>
            <Textarea
              value={keywordsText}
              onChange={(e) => setKeywordsText(e.target.value)}
              placeholder="Paste keywords here (one per line or comma-separated)..."
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
