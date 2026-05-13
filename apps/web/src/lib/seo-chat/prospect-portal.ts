/**
 * Prospect Portal Utilities
 * Phase 98-07: Magic link validation and view tracking
 */

import { db } from "@/db";
import { proposals, proposalViews } from "@/db/schema/seo-chat";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

export interface ProposalData {
  id: string;
  domain: string;
  package: string;
  keywords: Array<{
    keyword: string;
    volume: number;
    difficulty: number;
    feasibility: string;
  }>;
  analysisResults: {
    domainHealth: {
      da: number;
      dr: number;
      traffic: number;
      summary: string;
    } | null;
  };
  createdAt: Date;
  expiresAt: Date | null;
  status: string;
  workspaceName: string;
  agencyLogo: string | null;
}

export interface MagicLinkValidation {
  valid: boolean;
  expired: boolean;
  proposal: ProposalData | null;
  error?: string;
}

/**
 * Validates a magic link token and returns the associated proposal.
 * Tokens are UUIDs stored in the proposals table.
 */
export async function validateMagicLink(
  token: string
): Promise<MagicLinkValidation> {
  try {
    // Validate token format (alphanumeric, 32 chars for nanoid)
    if (!token || token.length !== 32 || !/^[A-Za-z0-9_-]+$/.test(token)) {
      return {
        valid: false,
        expired: false,
        proposal: null,
        error: "Invalid token format",
      };
    }

    // Fetch proposal by magic link token
    const proposal = await db.query.proposals.findFirst({
      where: eq(proposals.magicLinkToken, token),
    });

    if (!proposal) {
      return {
        valid: false,
        expired: false,
        proposal: null,
        error: "Proposal not found",
      };
    }

    // Check expiration
    if (proposal.expiresAt && new Date(proposal.expiresAt) < new Date()) {
      return {
        valid: false,
        expired: true,
        proposal: null,
        error: "Link has expired",
      };
    }

    // Map to ProposalData
    const proposalData: ProposalData = {
      id: proposal.id,
      domain: proposal.domain,
      package: proposal.package,
      keywords: proposal.keywords as ProposalData["keywords"],
      analysisResults:
        (proposal.analysisResults as ProposalData["analysisResults"]) || {
          domainHealth: null,
        },
      createdAt: proposal.createdAt,
      expiresAt: proposal.expiresAt,
      status: proposal.status,
      workspaceName: "Agency", // TODO: Join with workspace when schema available
      agencyLogo: null, // TODO: Join with workspace when schema available
    };

    return { valid: true, expired: false, proposal: proposalData };
  } catch (error) {
    console.error("Magic link validation error:", error);
    return {
      valid: false,
      expired: false,
      proposal: null,
      error: "Validation failed",
    };
  }
}

/**
 * Tracks when a prospect views a proposal.
 * Updates proposal status to 'viewed' and logs the view event.
 */
export async function trackProposalView(
  proposalId: string,
  metadata?: {
    userAgent?: string;
    ip?: string;
    referrer?: string;
  }
): Promise<void> {
  try {
    // Update proposal status to 'viewed' if currently 'sent' or 'generated'
    await db
      .update(proposals)
      .set({
        status: "viewed",
        viewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(proposals.id, proposalId),
          // Only update if not already viewed/converted
          eq(proposals.status, "generated")
        )
      );

    // Log view event
    await db.insert(proposalViews).values({
      id: nanoid(),
      proposalId,
      viewedAt: new Date(),
      userAgent: metadata?.userAgent || null,
      ipAddress: metadata?.ip || null,
      referrer: metadata?.referrer || null,
    });
  } catch (error) {
    // Non-critical - don't throw
    console.error("Failed to track proposal view:", error);
  }
}

/**
 * Generates a new magic link for a proposal.
 */
export function generateMagicLink(token: string, baseUrl: string): string {
  return `${baseUrl}/p/${token}`;
}
