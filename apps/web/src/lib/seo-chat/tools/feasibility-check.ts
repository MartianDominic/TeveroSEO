import { tool } from 'ai';
import { z } from 'zod';
import { calculateFeasibility } from '../executors/feasibility.executor';
import type { FeasibilityResult } from '../types';

export const feasibilityCheckTool = tool({
  description: `Check if specific keywords are rankable`,
  parameters: z.object({
    domain: z.string().describe("Domain to check"),
    keywords: z.array(z.string()).min(1).max(20).describe("Keywords to check"),
  }),
  execute: async ({ domain, keywords }: { domain: string; keywords: string[] }) => {
    const results: FeasibilityResult[] = keywords.map((keyword) =>
      calculateFeasibility({
        keyword,
        searchVolume: 0,
        keywordDifficulty: 50,
        currentPosition: null,
        ourDA: 0,
        competitorAvgDA: 50,
        domainAgeMonths: 12,
        relatedKeywordsRanked: 0,
        totalClusterKeywords: 0,
        serpFeatures: {
          featuredSnippet: false,
          localPack: false,
          peopleAlsoAsk: false,
          aiOverview: false,
          hasGiantCompetitors: false,
        },
        searchIntent: 'informational',
        isYMYL: false,
        isLocal: false,
      })
    );
    return { results };
  },
});
