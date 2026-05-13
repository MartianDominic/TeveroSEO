import { tool } from 'ai';
import { z } from 'zod';
import { runDomainHealthAnalysis } from '../executors/domain-health.executor';

export const domainHealthTool = tool({
  description: `Get domain health metrics for a prospect`,
  parameters: z.object({
    domain: z.string().describe("Domain to analyze"),
  }),
  // @ts-ignore - AI SDK tool() type compatibility issue
  execute: async (input: { domain: string }) => {
    return await runDomainHealthAnalysis(input.domain);
  },
});
