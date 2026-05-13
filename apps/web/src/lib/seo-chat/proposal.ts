/**
 * SEO Chat Proposal Service
 * Phase 98-03: Proposal generation with Gemini narrative
 */

import { db } from "@/db";
import { nanoid } from "nanoid";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";

interface CreateProposalInput {
  sessionId: string;
  domain: string;
  package: "pamatas" | "augimas" | "autoritetas";
  keywords: any[];
  email?: string;
  workspaceId: string;
}

const PACKAGE_CONFIG = {
  pamatas: { price: 2500, keywordLimit: 100 },
  augimas: { price: 3500, keywordLimit: 200 },
  autoritetas: { price: 7100, keywordLimit: 400 },
};

/**
 * Create a proposal with magic link
 * Generates narrative with Gemini 3.1 Pro
 */
export async function createProposal(input: CreateProposalInput) {
  const token = nanoid(32); // 32-char secure token
  const config = PACKAGE_CONFIG[input.package];
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days

  // Generate narrative with Gemini 3.1 Pro (per 98-RESEARCH.md Pattern 2)
  const { text: narrative } = await generateText({
    model: google("gemini-3.1-pro"),
    prompt: `Write a compelling SEO proposal narrative in Lithuanian for ${input.domain}.

Package: ${input.package.toUpperCase()} (EUR ${config.price})
Keywords: ${input.keywords.length} assigned
Top keywords: ${input.keywords.slice(0, 5).map((k: any) => k.keyword || k).join(", ")}

The narrative should:
- Be 2-3 paragraphs
- Highlight the opportunity (competitor gaps, traffic potential)
- Build urgency without being pushy
- Sound like a confident agency partner, not a salesperson

Write in natural Lithuanian, professional tone.`,
  });

  // TODO: Insert proposal into proposals table
  // For now, return the generated data
  return {
    id: nanoid(),
    token,
    package: input.package,
    price: config.price,
    keywords: input.keywords,
    narrative,
    expiresAt,
    email: input.email,
  };
}

/**
 * Get proposal by magic link token
 */
export async function getProposalByToken(token: string) {
  // TODO: Query proposals table
  return null;
}
