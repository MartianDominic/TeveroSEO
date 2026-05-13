/**
 * SEO Chat Tools - Aggregate Export
 * Phase 98-02: Tools & Executors
 *
 * Exports all 5 tools for use in Vercel AI SDK streamText().
 * Each tool has Zod parameter schemas and execute functions.
 */

import { domainHealthTool } from './domain-health';
import { keywordAnalysisTool } from './keyword-analysis';
import { feasibilityCheckTool } from './feasibility-check';
import { addToProposalTool } from './add-to-proposal';
import { generateProposalTool } from './generate-proposal';

/**
 * SEO Chat tools object for use in streamText()
 *
 * Usage:
 * ```typescript
 * import { seoTools } from '@/lib/seo-chat/tools';
 *
 * const result = await streamText({
 *   model: xai('grok-4.1-fast'),
 *   tools: seoTools,
 *   // ...
 * });
 * ```
 */
export const seoTools = {
  domain_health: domainHealthTool,
  keyword_analysis: keywordAnalysisTool,
  feasibility_check: feasibilityCheckTool,
  add_to_proposal: addToProposalTool,
  generate_proposal: generateProposalTool,
};

// Named exports for individual tool access
export { domainHealthTool, keywordAnalysisTool, feasibilityCheckTool, addToProposalTool, generateProposalTool };
