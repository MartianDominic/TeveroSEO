/**
 * MagicLinkService - White-label invitation link management.
 * Phase 49-51: Onboarding & Agency Dashboard
 *
 * Generates and validates secure magic links for client credential completion.
 * Implements D-01 (dual mode) and D-02 (white-label branding) decisions.
 */
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { magicLinks, type MagicLinkInsert } from "@/db/magic-link-schema";
import { organization } from "@/db/user-schema";

/**
 * 24 hours in milliseconds.
 */
const EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * Default brand color (emerald) when workspace has no custom color.
 */
const DEFAULT_PRIMARY_COLOR = "#10b981";

/**
 * Result of generating a magic link.
 */
export interface MagicLinkResult {
  /** The unique token */
  token: string;
  /** Expiration timestamp (24h from creation) */
  expiresAt: Date;
  /** Full URL path: /connect/{token} */
  url: string;
}

/**
 * Workspace branding information for white-label display.
 */
export interface WorkspaceBranding {
  /** Workspace/agency name */
  name: string;
  /** Logo URL (null if none) */
  logoUrl: string | null;
  /** Primary brand color (default emerald if not set) */
  primaryColor: string;
}

/**
 * Result of validating a magic link.
 */
export interface MagicLinkValidation {
  /** Whether the token is valid (not expired, not used, found) */
  valid: boolean;
  /** Reason for invalidity (only set when valid=false) */
  reason?: "expired" | "used" | "not_found";
  /** Workspace ID (only set when valid=true) */
  workspaceId?: string;
  /** Client ID (only set when valid=true) */
  clientId?: string;
  /** Checklist ID (only set when valid=true) */
  checklistId?: string;
  /** Item ID within checklist (only set when valid=true) */
  itemId?: string;
  /** Workspace branding for white-label display (only set when valid=true) */
  branding?: WorkspaceBranding;
}

/**
 * Generate a magic link for client onboarding credential completion.
 *
 * Creates a secure 32-char nanoid token with 24-hour expiry.
 * Per T-49-01: 128 bits entropy, token excluded from logs.
 *
 * @param workspaceId - Workspace generating the link
 * @param clientId - Client the link is for
 * @param checklistId - Associated onboarding checklist
 * @param itemId - Specific checklist item this link completes
 * @returns Token, expiry timestamp, and URL path
 */
export async function generateMagicLink(
  workspaceId: string,
  clientId: string,
  checklistId: string,
  itemId: string
): Promise<MagicLinkResult> {
  const token = nanoid(32); // 32 chars = 128 bits entropy
  const now = new Date();
  const expiresAt = new Date(now.getTime() + EXPIRY_MS);

  const magicLink: MagicLinkInsert = {
    id: nanoid(),
    workspaceId,
    clientId,
    checklistId,
    itemId,
    token,
    expiresAt,
  };

  const [inserted] = await db.insert(magicLinks).values(magicLink).returning();

  return {
    token: inserted.token,
    expiresAt: inserted.expiresAt,
    url: `/connect/${inserted.token}`,
  };
}

/**
 * Validate a magic link token.
 *
 * Checks:
 * - Token exists in database
 * - Token has not expired (expiresAt > now)
 * - Token has not been used (usedAt is null)
 *
 * Per T-49-02: All data comes from DB lookup, never trust client-provided values.
 *
 * @param token - Token to validate
 * @returns Validation result with workspace branding if valid
 */
export async function validateMagicLink(
  token: string
): Promise<MagicLinkValidation> {
  // Look up token
  const [link] = await db
    .select()
    .from(magicLinks)
    .where(eq(magicLinks.token, token))
    .limit(1);

  if (!link) {
    return { valid: false, reason: "not_found" };
  }

  // Check if expired
  const now = new Date();
  if (link.expiresAt < now) {
    return { valid: false, reason: "expired" };
  }

  // Check if already used
  if (link.usedAt !== null) {
    return { valid: false, reason: "used" };
  }

  // Fetch workspace for branding
  const [workspace] = await db
    .select()
    .from(organization)
    .where(eq(organization.id, link.workspaceId))
    .limit(1);

  const branding: WorkspaceBranding = {
    name: workspace?.name ?? "Agency",
    logoUrl: workspace?.logo ?? null,
    primaryColor: DEFAULT_PRIMARY_COLOR, // TODO: Add custom color support when workspace branding is extended
  };

  return {
    valid: true,
    workspaceId: link.workspaceId,
    clientId: link.clientId,
    checklistId: link.checklistId,
    itemId: link.itemId,
    branding,
  };
}

/**
 * Mark a magic link as used.
 *
 * Sets usedAt timestamp to prevent reuse.
 * Should be called after successful OAuth completion.
 *
 * @param token - Token to mark as used
 */
export async function markMagicLinkUsed(token: string): Promise<void> {
  await db
    .update(magicLinks)
    .set({ usedAt: new Date() })
    .where(eq(magicLinks.token, token));
}

export const MagicLinkService = {
  generateMagicLink,
  validateMagicLink,
  markMagicLinkUsed,
};
