import { tool } from 'ai';
import { z } from 'zod';

export const generateProposalTool = tool({
  description: `Generate a proposal with magic link`,
  parameters: z.object({
    package: z.enum(['pamatas', 'augimas', 'autoritetas']),
    email: z.string().email().optional(),
  }),
  // @ts-ignore - AI SDK tool() type compatibility issue
  execute: async (input: { package: 'pamatas' | 'augimas' | 'autoritetas'; email?: string }) => {
    const magicToken = "abc123xyz";
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    return {
      magicLink: `https://tevero.lt/p/${magicToken}`,
      expiresAt: expiresAt.toISOString(),
      keywordsAssigned: 0,
      package: input.package,
    };
  },
});
