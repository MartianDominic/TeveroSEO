import { tool } from 'ai';
import { z } from 'zod';

export const addToProposalTool = tool({
  description: `Add keywords to the proposal draft`,
  parameters: z.object({
    filter: z.enum(['feasible', 'challenging', 'all']).default('feasible'),
    limit: z.number().optional(),
    keywordIds: z.array(z.string()).optional(),
  }),
  execute: async ({ filter, limit, keywordIds }: { filter: 'feasible' | 'challenging' | 'all'; limit?: number; keywordIds?: string[] }) => {
    return {
      added: 0,
      total: 0,
      message: "Keywords added to proposal draft",
    };
  },
});
