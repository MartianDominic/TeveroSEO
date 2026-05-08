/**
 * Portal Token Service
 * Phase 87-01: Client Portal Foundation
 * Phase 96: CPR-005 (Configurable Session Timeout)
 *
 * Manages portal access tokens: generation, validation, revocation.
 * Supports three auth levels: token_only, email_verify, full_login.
 *
 * CPR-005: Session timeout is now configurable per agency via
 * workspace_portal_settings table (1-72 hours range).
 */
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db, portalTokens, clients } from "@/db";
import type { DbClient } from "@/db";
import { workspacePortalSettingsService } from "./WorkspacePortalSettingsService";

// Auth levels for portal access
export type AuthLevel = "token_only" | "email_verify" | "full_login";

/**
 * Options for generating a new portal token.
 */
export interface TokenGenerationOptions {
  clientId: string;
  authLevel?: AuthLevel;
  expiresInDays?: number; // default 30 for token links
  /** CPR-005: Use agency's configured session timeout instead of expiresInDays */
  useAgencySessionTimeout?: boolean;
}

/**
 * Result of token validation.
 */
export interface TokenValidationResult {
  valid: boolean;
  clientId?: string;
  authLevel?: AuthLevel;
  error?: "expired" | "revoked" | "not_found";
}

/**
 * Service for managing portal access tokens.
 */
export class PortalTokenService {
  private db: DbClient;

  constructor(dbClient: DbClient = db) {
    this.db = dbClient;
  }

  /**
   * Generate a new portal access token.
   *
   * CPR-005: Now supports agency-configurable session timeout.
   * When useAgencySessionTimeout is true, looks up the client's workspace
   * and uses the configured session timeout instead of expiresInDays.
   *
   * @param options Token generation options
   * @returns The generated token string (nanoid 12 chars)
   */
  async generateToken(options: TokenGenerationOptions): Promise<string> {
    const token = nanoid(12);
    let expiresAt: Date;

    // CPR-005: Use agency session timeout if requested
    if (options.useAgencySessionTimeout) {
      // Look up client to get workspaceId
      const client = await this.db.query.clients.findFirst({
        where: eq(clients.id, options.clientId),
      });

      if (client) {
        expiresAt = await workspacePortalSettingsService.getSessionExpiryDate(
          client.workspaceId
        );
      } else {
        // Fallback to default 24 hours if client not found
        expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }
    } else {
      // Legacy behavior: use expiresInDays (default 30 for shareable links)
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (options.expiresInDays ?? 30));
    }

    await this.db.insert(portalTokens).values({
      clientId: options.clientId,
      token,
      authLevel: options.authLevel ?? "token_only",
      expiresAt,
    });

    return token;
  }

  /**
   * Validate a portal token.
   *
   * Checks existence, expiry, and revocation status.
   * Updates access tracking on successful validation.
   *
   * @param token The token to validate
   * @returns Validation result with clientId and authLevel if valid
   */
  async validateToken(token: string): Promise<TokenValidationResult> {
    const record = await this.db.query.portalTokens.findFirst({
      where: eq(portalTokens.token, token),
    });

    if (!record) {
      return { valid: false, error: "not_found" };
    }

    if (record.isRevoked) {
      return { valid: false, error: "revoked" };
    }

    if (record.expiresAt < new Date()) {
      return { valid: false, error: "expired" };
    }

    // Update access tracking
    await this.db
      .update(portalTokens)
      .set({
        lastAccessedAt: new Date(),
        accessCount: (record.accessCount ?? 0) + 1,
      })
      .where(eq(portalTokens.id, record.id));

    return {
      valid: true,
      clientId: record.clientId,
      authLevel: record.authLevel as AuthLevel,
    };
  }

  /**
   * Revoke a portal token.
   *
   * @param token The token to revoke
   * @returns true if token was found and revoked, false if not found
   */
  async revokeToken(token: string): Promise<boolean> {
    const result = await this.db
      .update(portalTokens)
      .set({
        isRevoked: true,
        revokedAt: new Date(),
      })
      .where(eq(portalTokens.token, token))
      .returning();

    return result.length > 0;
  }

  /**
   * List all tokens for a client.
   *
   * @param clientId The client ID
   * @returns Array of token records ordered by createdAt desc
   */
  async listClientTokens(
    clientId: string
  ): Promise<(typeof portalTokens.$inferSelect)[]> {
    return this.db.query.portalTokens.findMany({
      where: eq(portalTokens.clientId, clientId),
      orderBy: (t, { desc }) => desc(t.createdAt),
    });
  }
}

/**
 * Factory function to create a PortalTokenService instance.
 *
 * @param dbClient Optional database client (for testing)
 * @returns PortalTokenService instance
 */
export function createPortalTokenService(dbClient?: DbClient): PortalTokenService {
  return new PortalTokenService(dbClient);
}

// Default singleton instance
export const portalTokenService = new PortalTokenService();
