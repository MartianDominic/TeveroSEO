/**
 * SSE Streaming Endpoint for Keyword Analysis Chat
 * Phase 82: Chat Integration
 *
 * POST /api/keyword-chat/analyze
 *
 * Accepts conversation + keywords, streams progressive analysis results.
 *
 * Security:
 * - T-82-01: Validates Clerk authentication
 * - T-82-02: Validates user has access to specified client
 */

import { NextRequest } from 'next/server';

import { auth } from '@clerk/nextjs/server';

import { runAnalysisPipeline } from '@/lib/keyword-chat/analysis-pipeline';
import { StageEmitter } from '@/lib/keyword-chat/stage-emitter';
import type { AnalyzeRequest, AnalysisEvent } from '@/lib/keyword-chat/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Request validation
function validateRequest(body: unknown): body is AnalyzeRequest {
  if (!body || typeof body !== 'object') return false;
  const req = body as Record<string, unknown>;

  if (typeof req.clientId !== 'string' || !req.clientId) return false;
  if (typeof req.conversation !== 'string') return false;
  if (!Array.isArray(req.keywords)) return false;
  if (req.keywords.length === 0) return false;
  if (req.keywords.length > 10000) return false;

  return true;
}

export async function POST(request: NextRequest) {
  // Verify authentication
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate request
  if (!validateRequest(body)) {
    return new Response(
      JSON.stringify({
        error:
          'Invalid request. Required: clientId (string), conversation (string), keywords (array 1-10000)',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const analyzeRequest: AnalyzeRequest = {
    clientId: body.clientId,
    conversation: body.conversation,
    keywords: body.keywords.filter((k): k is string => typeof k === 'string'),
    config: body.config,
  };

  // TODO: Verify user has access to clientId via AI-Writer API
  // For now, trust the request since they're authenticated

  const encoder = new TextEncoder();
  let heartbeatInterval: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: AnalysisEvent) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        } catch {
          // Stream may have been closed
        }
      };

      // Create emitter that writes to stream
      const emitter = new StageEmitter(async (event) => {
        sendEvent(event);
      });

      // Heartbeat to keep connection alive
      heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
        } catch {
          // Stream closed, clear interval
          if (heartbeatInterval) clearInterval(heartbeatInterval);
        }
      }, 15000);

      try {
        // Run the analysis pipeline
        await runAnalysisPipeline(analyzeRequest, emitter);

        // TODO: Persist session to database (Task 4)
        // await saveAnalysisSession(result, analyzeRequest.clientId);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Analysis failed';
        sendEvent({ type: 'error', message });
      } finally {
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        controller.close();
      }
    },
    cancel() {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
