/**
 * CopilotKit Runtime API Route
 * Phase 86-07: Proposal Editing
 *
 * Uses Grok 4.1 Fast ($0.20/1M) for real-time chat responses.
 * Per LLM-ARCHITECTURE.md:
 * - Grok 4.1 Fast: Structured extraction, real-time chat
 * - Cost: ~$0.001 per CopilotKit response
 *
 * NO FALLBACKS to other models - quality must remain constant.
 *
 * TODO: Install openai SDK and configure OpenAIAdapter
 * For now, this is a stub that returns a minimal runtime.
 */

import {
  CopilotRuntime,
  copilotRuntimeNextJSAppRouterEndpoint,
} from '@copilotkit/runtime';

// TODO: Replace with OpenAIAdapter + Grok 4.1 Fast once openai SDK is installed
// import OpenAI from 'openai';
// const grokClient = new OpenAI({
//   apiKey: process.env.XAI_API_KEY!,
//   baseURL: 'https://api.x.ai/v1',
// });
// const serviceAdapter = new OpenAIAdapter({
//   openai: grokClient,
//   model: 'grok-4.1-fast',
// });

const runtime = new CopilotRuntime();

const handler = copilotRuntimeNextJSAppRouterEndpoint({
  runtime,
  // serviceAdapter, // TODO: Add once OpenAI SDK is installed
  endpoint: '/api/copilot',
});

export const POST = handler.handleRequest;

/**
 * Environment variable required:
 * XAI_API_KEY=xai-xxxxxxxxxxxx
 */
