/**
 * SEO Chat Main API Route
 * Phase 98-03: API Routes
 *
 * Handles streaming chat with AI tool calling using Vercel AI SDK.
 * Uses Grok 4.1-fast for intent classification and tool selection.
 *
 * Per 98-RESEARCH.md Pitfall 1: Node.js runtime (not Edge) for 60s timeout.
 */

import { streamText } from "ai";
import { xai } from "@ai-sdk/xai";
import { seoTools } from "@/lib/seo-chat/tools";
import {
  getSessionContext,
  saveMessage,
  updateSessionContext,
} from "@/lib/seo-chat/session";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs"; // 60s timeout, not Edge 25s
export const maxDuration = 60;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages, sessionId } = await req.json();

  // Load session context (domain, keywords, etc.)
  const sessionContext = await getSessionContext(sessionId);
  if (!sessionContext) {
    return new Response("Session not found", { status: 404 });
  }

  // Build system prompt with session context
  const systemPrompt = `You are an SEO sales assistant for a Lithuanian agency.
You help agency owners analyze prospects and generate proposals.

CURRENT SESSION:
- Prospect domain: ${sessionContext.prospectDomain || "Not set yet"}
- Keywords analyzed: ${sessionContext.keywordsAnalyzed || 0}
- Proposal draft keywords: ${sessionContext.proposalId ? "Draft created" : "Not yet"}

INSTRUCTIONS:
- Use tools to perform analyses - never make up data
- Extract domain from user messages automatically (regex: [a-z0-9-]+\\.[a-z]{2,})
- Respond in the same language as the user (Lithuanian or English)
- Keep responses concise and action-oriented
- After analyses, suggest next steps (e.g., "Want me to add these to the proposal?")

AVAILABLE TOOLS:
- domain_health: Check site metrics (DA, DR, traffic)
- keyword_analysis: Discover keywords (specify count: 100, 200, 400)
- feasibility_check: Check if specific keywords are rankable
- add_to_proposal: Add keywords to proposal draft
- generate_proposal: Create magic link for prospect`;

  const result = await streamText({
    model: xai("grok-4.1-fast"),
    system: systemPrompt,
    messages,
    tools: seoTools,
    toolChoice: "auto",
    onFinish: async ({ text, toolCalls }) => {
      // Persist assistant message and tool results
      await saveMessage(sessionId, {
        role: "assistant",
        content: text,
        toolCalls: toolCalls || [],
        toolResults: [],
      });

      // Update session context if domain was detected
      if (toolCalls && toolCalls.length > 0) {
        const domainCall = toolCalls.find((t: any) => t.toolName === "domain_health");
        if (domainCall && 'args' in domainCall && (domainCall as any).args?.domain) {
          await updateSessionContext(sessionId, {
            prospectDomain: (domainCall as any).args.domain,
          });
        }

        // Update keyword count if keyword analysis was performed
        const keywordCall = toolCalls.find(
          (t: any) => t.toolName === "keyword_analysis"
        );
        if (keywordCall && 'result' in keywordCall) {
          const result = (keywordCall as any).result;
          if (result?.keywords) {
            await updateSessionContext(sessionId, {
              keywordsAnalyzed: result.keywords.length,
            });
          }
        }
      }
    },
  });

  return result.toTextStreamResponse();
}
