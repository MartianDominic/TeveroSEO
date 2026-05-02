/**
 * Platform Connection Service
 * Phase 61-04: Platform Integration Excellence
 *
 * Unified CRUD for OAuth and non-OAuth (app_password, api_key) connections.
 * Handles encrypted token storage and retrieval.
 */
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import {
  platformConnections,
  type OAuthPlatformType,
  type OAuthConnectionStatus,
} from "@/db/platform-connection-schema";
import { encryptToken, decryptToken } from "./TokenEncryption";

// ============================================================================
// Input Types
// ============================================================================

export interface CreateOAuthConnectionInput {
  workspaceId: string;
  prospectId?: string;
  platform: OAuthPlatformType;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType?: string;
  scopes?: string[];
  platformAccountId?: string;
  platformAccountName?: string;
  platformSiteUrl?: string;
  connectedBy: string;
}

export interface CreateAppPasswordConnectionInput {
  workspaceId: string;
  prospectId?: string;
  platform: "wordpress_org";
  siteUrl: string;
  credentials: {
    username: string;
    appPassword: string;
  };
  connectedBy: string;
}

// ============================================================================
// Output Types
// ============================================================================

export interface ConnectionWithoutCredentials {
  id: string;
  workspaceId: string;
  prospectId: string | null;
  platform: string;
  platformAccountId: string | null;
  platformAccountName: string | null;
  platformSiteUrl: string | null;
  credentialType: string | null;
  status: string;
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
  lastError: string | null;
  connectedAt: Date | null;
  hasTokens: boolean;
}

// ============================================================================
// Service Implementation
// ============================================================================

export class PlatformConnectionService {
  /**
   * Create OAuth connection with encrypted tokens.
   */
  async createOAuthConnection(input: CreateOAuthConnectionInput): Promise<string> {
    const id = nanoid();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + input.expiresIn * 1000);

    await db.insert(platformConnections).values({
      id,
      workspaceId: input.workspaceId,
      prospectId: input.prospectId ?? null,
      platform: input.platform,
      platformAccountId: input.platformAccountId ?? null,
      platformAccountName: input.platformAccountName ?? null,
      platformSiteUrl: input.platformSiteUrl ?? null,
      accessTokenEncrypted: encryptToken(input.accessToken),
      refreshTokenEncrypted: input.refreshToken
        ? encryptToken(input.refreshToken)
        : null,
      tokenExpiresAt: expiresAt,
      tokenType: input.tokenType ?? "Bearer",
      credentialType: "oauth",
      status: "active",
      scopesRequested: input.scopes ?? [],
      scopesGranted: input.scopes ?? [],
      connectedAt: now,
      connectedBy: input.connectedBy,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  }

  /**
   * Create Application Password connection (WordPress).
   * Stores credentials as encrypted JSON per D-15.
   */
  async createAppPasswordConnection(
    input: CreateAppPasswordConnectionInput
  ): Promise<string> {
    const id = nanoid();
    const now = new Date();

    // Store credentials as encrypted JSON per D-15
    const credentialsJson = JSON.stringify(input.credentials);

    await db.insert(platformConnections).values({
      id,
      workspaceId: input.workspaceId,
      prospectId: input.prospectId ?? null,
      platform: input.platform,
      platformSiteUrl: input.siteUrl,
      credentialType: "app_password",
      credentialsEncrypted: encryptToken(credentialsJson),
      status: "active",
      connectedAt: now,
      connectedBy: input.connectedBy,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  }

  /**
   * Get connection by ID (without credentials).
   */
  async getConnection(id: string): Promise<ConnectionWithoutCredentials | null> {
    const row = await db.query.platformConnections.findFirst({
      where: eq(platformConnections.id, id),
    });

    if (!row) return null;

    return {
      id: row.id,
      workspaceId: row.workspaceId,
      prospectId: row.prospectId,
      platform: row.platform,
      platformAccountId: row.platformAccountId,
      platformAccountName: row.platformAccountName,
      platformSiteUrl: row.platformSiteUrl,
      credentialType: row.credentialType,
      status: row.status,
      lastSyncAt: row.lastSyncAt,
      lastSyncStatus: row.lastSyncStatus,
      lastError: row.lastError,
      connectedAt: row.connectedAt,
      hasTokens: !!(row.accessTokenEncrypted || row.credentialsEncrypted),
    };
  }

  /**
   * Get connections for workspace.
   */
  async getConnectionsForWorkspace(
    workspaceId: string,
    prospectId?: string
  ): Promise<ConnectionWithoutCredentials[]> {
    const rows = await db.query.platformConnections.findMany({
      where: eq(platformConnections.workspaceId, workspaceId),
    });

    return rows
      .filter((row) => !prospectId || row.prospectId === prospectId)
      .map((row) => ({
        id: row.id,
        workspaceId: row.workspaceId,
        prospectId: row.prospectId,
        platform: row.platform,
        platformAccountId: row.platformAccountId,
        platformAccountName: row.platformAccountName,
        platformSiteUrl: row.platformSiteUrl,
        credentialType: row.credentialType,
        status: row.status,
        lastSyncAt: row.lastSyncAt,
        lastSyncStatus: row.lastSyncStatus,
        lastError: row.lastError,
        connectedAt: row.connectedAt,
        hasTokens: !!(row.accessTokenEncrypted || row.credentialsEncrypted),
      }));
  }

  /**
   * Get decrypted OAuth tokens (server-side only).
   */
  async getOAuthTokens(id: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt: Date | null;
  } | null> {
    const row = await db.query.platformConnections.findFirst({
      where: eq(platformConnections.id, id),
    });

    if (!row?.accessTokenEncrypted) return null;

    return {
      accessToken: decryptToken(row.accessTokenEncrypted),
      refreshToken: row.refreshTokenEncrypted
        ? decryptToken(row.refreshTokenEncrypted)
        : undefined,
      expiresAt: row.tokenExpiresAt,
    };
  }

  /**
   * Get decrypted app password credentials (server-side only).
   */
  async getAppPasswordCredentials(id: string): Promise<{
    username: string;
    appPassword: string;
  } | null> {
    const row = await db.query.platformConnections.findFirst({
      where: eq(platformConnections.id, id),
    });

    if (!row?.credentialsEncrypted || row.credentialType !== "app_password") {
      return null;
    }

    return JSON.parse(decryptToken(row.credentialsEncrypted));
  }

  /**
   * Update connection status.
   */
  async updateStatus(
    id: string,
    status: OAuthConnectionStatus,
    error?: string
  ): Promise<void> {
    await db
      .update(platformConnections)
      .set({
        status,
        lastError: error ?? null,
        updatedAt: new Date(),
      })
      .where(eq(platformConnections.id, id));
  }

  /**
   * Update tokens after refresh.
   */
  async updateTokens(
    id: string,
    accessToken: string,
    refreshToken?: string,
    expiresIn?: number
  ): Promise<void> {
    const now = new Date();
    const expiresAt = expiresIn
      ? new Date(now.getTime() + expiresIn * 1000)
      : undefined;

    await db
      .update(platformConnections)
      .set({
        accessTokenEncrypted: encryptToken(accessToken),
        refreshTokenEncrypted: refreshToken
          ? encryptToken(refreshToken)
          : undefined,
        tokenExpiresAt: expiresAt,
        updatedAt: now,
      })
      .where(eq(platformConnections.id, id));
  }

  /**
   * Record successful sync.
   */
  async recordSync(
    id: string,
    status: "success" | "partial" | "failed",
    error?: string
  ): Promise<void> {
    await db
      .update(platformConnections)
      .set({
        lastSyncAt: new Date(),
        lastSyncStatus: status,
        lastError: status === "failed" ? error : null,
        updatedAt: new Date(),
      })
      .where(eq(platformConnections.id, id));
  }

  /**
   * Delete connection.
   */
  async deleteConnection(id: string): Promise<void> {
    await db.delete(platformConnections).where(eq(platformConnections.id, id));
  }
}

// Singleton export
export const platformConnectionService = new PlatformConnectionService();
