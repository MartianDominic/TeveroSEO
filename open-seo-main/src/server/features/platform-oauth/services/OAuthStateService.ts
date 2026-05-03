/**
 * OAuthStateService - Manages OAuth state tokens for CSRF protection.
 * MED-VAL-02 FIX: Implements proper state ownership verification to prevent IDOR.
 *
 * Security features:
 * - State tokens are bound to userId at creation time
 * - State tokens expire after 10 minutes
 * - State tokens can only be used once (marked as used after verification)
 * - State verification requires matching userId
 */

import { eq, and, isNull, lt } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { DbClient } from "@/db";
import {
  oauthStates,
  type OAuthStateInsert,
  type OAuthStateSelect,
} from "@/db/oauth-state-schema";
import type { OAuthPlatform } from "../types";

// State token expiry time in milliseconds (10 minutes)
const STATE_EXPIRY_MS = 10 * 60 * 1000;

/**
 * Request to create a new OAuth state token.
 */
export interface CreateStateRequest {
  platform: OAuthPlatform;
  workspaceId: string;
  userId: string;
  redirectUri: string;
  scopes: string[];
  prospectId?: string;
}

/**
 * Result of state verification.
 */
export interface StateVerificationResult {
  valid: boolean;
  state?: OAuthStateSelect;
  error?: string;
}

/**
 * OAuthStateService - Manages OAuth CSRF state tokens.
 */
export class OAuthStateService {
  constructor(private readonly db: DbClient) {}

  /**
   * Create a new OAuth state token bound to a user.
   *
   * The state token is:
   * - Cryptographically random (32 characters)
   * - Bound to the userId who initiated the OAuth flow
   * - Expires after 10 minutes
   *
   * @param request - State creation request
   * @returns The created state record
   */
  async createState(request: CreateStateRequest): Promise<OAuthStateSelect> {
    const {
      platform,
      workspaceId,
      userId,
      redirectUri,
      scopes,
      prospectId,
    } = request;

    const id = nanoid();
    const state = nanoid(32); // Cryptographically secure random state
    const expiresAt = new Date(Date.now() + STATE_EXPIRY_MS);

    const stateRecord: OAuthStateInsert = {
      id,
      state,
      platform,
      workspaceId,
      userId, // CRITICAL: Bind state to user for ownership verification
      redirectUri,
      scopes,
      prospectId: prospectId ?? null,
      expiresAt,
    };

    const [created] = await this.db
      .insert(oauthStates)
      .values(stateRecord)
      .returning();

    return created;
  }

  /**
   * Verify an OAuth state token and mark it as used.
   *
   * Security checks:
   * 1. State token exists
   * 2. State token has not expired
   * 3. State token has not been used
   * 4. State token belongs to the requesting user (IDOR prevention)
   *
   * @param state - The state token from OAuth callback
   * @param userId - The userId of the current session (must match)
   * @returns Verification result with state data or error
   */
  async verifyState(
    state: string,
    userId: string
  ): Promise<StateVerificationResult> {
    const now = new Date();

    // Find the state record
    const stateRecord = await this.db.query.oauthStates.findFirst({
      where: eq(oauthStates.state, state),
    });

    // State not found
    if (!stateRecord) {
      return {
        valid: false,
        error: "Invalid or expired state token",
      };
    }

    // State expired
    if (stateRecord.expiresAt < now) {
      return {
        valid: false,
        error: "State token has expired",
      };
    }

    // State already used (replay attack prevention)
    if (stateRecord.usedAt !== null) {
      return {
        valid: false,
        error: "State token has already been used",
      };
    }

    // CRITICAL: Verify user ownership (IDOR prevention - MED-VAL-02)
    if (stateRecord.userId !== userId) {
      // Log potential attack attempt but return generic error
      console.warn(
        `OAuth state ownership mismatch: state userId=${stateRecord.userId}, request userId=${userId}`
      );
      return {
        valid: false,
        error: "Invalid state token",
      };
    }

    // Mark state as used (atomic operation to prevent race conditions)
    const [updated] = await this.db
      .update(oauthStates)
      .set({ usedAt: now })
      .where(
        and(
          eq(oauthStates.id, stateRecord.id),
          isNull(oauthStates.usedAt) // Double-check not used
        )
      )
      .returning();

    // Another request used this state between our check and update
    if (!updated) {
      return {
        valid: false,
        error: "State token has already been used",
      };
    }

    return {
      valid: true,
      state: updated,
    };
  }

  /**
   * Clean up expired state tokens.
   * Should be called periodically (e.g., via cron job).
   *
   * @returns Number of deleted records
   */
  async cleanupExpiredStates(): Promise<number> {
    const now = new Date();

    const result = await this.db
      .delete(oauthStates)
      .where(
        // Delete states where expiresAt < now (expired)
        lt(oauthStates.expiresAt, now)
      );

    return result.rowCount ?? 0;
  }

  /**
   * Get a state record by state token (for debugging/audit purposes).
   * Does not verify ownership - use verifyState for OAuth callbacks.
   *
   * @param state - The state token
   * @returns State record or null
   */
  async getState(state: string): Promise<OAuthStateSelect | null> {
    const record = await this.db.query.oauthStates.findFirst({
      where: eq(oauthStates.state, state),
    });

    return record ?? null;
  }
}

/**
 * Create an OAuthStateService instance with the provided database client.
 */
export function createOAuthStateService(db: DbClient): OAuthStateService {
  return new OAuthStateService(db);
}
