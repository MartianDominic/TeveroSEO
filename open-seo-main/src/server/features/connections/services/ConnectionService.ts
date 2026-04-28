/**
 * Connection Service
 * Phase 31-03: Platform Adapters
 *
 * Provides CRUD operations for site connections with credential encryption.
 * Never returns decrypted credentials to callers - use getConnectionWithAdapter
 * when you need to make API calls.
 *
 * Security:
 * - Credentials encrypted with AES-256-GCM before storage
 * - getConnection returns hasCredentials flag, not actual credentials
 * - Only getConnectionWithAdapter decrypts for internal adapter use
 */
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import {
  siteConnections,
  type SiteConnectionSelect,
} from "@/db/connection-schema";
import type { PlatformType, ConnectionStatus } from "../types";
import type { PlatformAdapter, CapabilityResult } from "../adapters/BaseAdapter";
import { WordPressAdapter } from "../adapters/WordPressAdapter";
import { ShopifyAdapter } from "../adapters/ShopifyAdapter";
import { WixAdapter } from "../adapters/WixAdapter";
import { SquarespaceAdapter } from "../adapters/SquarespaceAdapter";
import { WebflowAdapter } from "../adapters/WebflowAdapter";
import { encryptCredential, decryptCredential } from "./CredentialEncryption";

// ============================================================================
// Types
// ============================================================================

/**
 * Input for creating a new connection.
 */
export interface CreateConnectionInput {
  /** Client ID this connection belongs to */
  clientId: string;

  /** Platform type (wordpress, shopify, etc.) */
  platform: PlatformType;

  /** Site URL */
  siteUrl: string;

  /** Display name (defaults to siteUrl) */
  displayName?: string;

  /** Platform-specific credentials (will be encrypted) */
  credentials: Record<string, unknown>;
}

/**
 * Connection object without encrypted credentials.
 * Safe to return to API callers.
 */
export interface ConnectionWithoutCredentials
  extends Omit<SiteConnectionSelect, "encryptedCredentials"> {
  /** Indicates if credentials are stored (for UI display) */
  hasCredentials: boolean;
}

// ============================================================================
// Connection Service Implementation
// ============================================================================

/**
 * Service for managing site connections with encrypted credentials.
 *
 * @example
 * ```typescript
 * const service = new ConnectionService();
 *
 * // Create connection (encrypts credentials)
 * const conn = await service.createConnection({
 *   clientId: 'client-123',
 *   platform: 'wordpress',
 *   siteUrl: 'https://example.com',
 *   credentials: { username: 'admin', appPassword: 'secret' },
 * });
 *
 * // Get adapter for API calls (decrypts credentials)
 * const adapter = await service.getConnectionWithAdapter(conn.id);
 * const result = await adapter.verifyConnection();
 * ```
 */
export class ConnectionService {
  /**
   * Create a new site connection with encrypted credentials.
   *
   * @param input - Connection details including credentials
   * @returns Connection without decrypted credentials
   */
  async createConnection(
    input: CreateConnectionInput
  ): Promise<ConnectionWithoutCredentials> {
    // Encrypt credentials before storage
    const credentialsJson = JSON.stringify(input.credentials);
    const encrypted = encryptCredential(credentialsJson);

    const id = nanoid();
    const now = new Date();

    const [row] = await db
      .insert(siteConnections)
      .values({
        id,
        clientId: input.clientId,
        platform: input.platform,
        siteUrl: input.siteUrl,
        displayName: input.displayName ?? input.siteUrl,
        encryptedCredentials: encrypted.toString("base64"),
        status: "pending",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return this.stripCredentials(row);
  }

  /**
   * Get connection by ID without decrypted credentials.
   * Use getConnectionWithAdapter if you need to make API calls.
   *
   * @param id - Connection ID
   * @returns Connection without credentials or null
   */
  async getConnection(id: string): Promise<ConnectionWithoutCredentials | null> {
    const row = await db.query.siteConnections.findFirst({
      where: eq(siteConnections.id, id),
    });

    return row ? this.stripCredentials(row) : null;
  }

  /**
   * Get all connections for a client.
   *
   * @param clientId - Client ID
   * @returns Array of connections without credentials
   */
  async getConnectionsForClient(
    clientId: string
  ): Promise<ConnectionWithoutCredentials[]> {
    const rows = await db.query.siteConnections.findMany({
      where: eq(siteConnections.clientId, clientId),
    });

    return rows.map((row) => this.stripCredentials(row));
  }

  /**
   * Get connection with decrypted credentials as platform adapter.
   * Only use server-side when you need to make API calls.
   *
   * @param id - Connection ID
   * @returns Platform adapter or null
   */
  async getConnectionWithAdapter(id: string): Promise<PlatformAdapter | null> {
    const row = await db.query.siteConnections.findFirst({
      where: eq(siteConnections.id, id),
    });

    if (!row || !row.encryptedCredentials) {
      return null;
    }

    // Decrypt credentials
    const packed = Buffer.from(row.encryptedCredentials, "base64");
    const credentialsJson = decryptCredential(packed);
    const credentials = JSON.parse(credentialsJson);

    return this.createAdapter(
      row.platform as PlatformType,
      row.siteUrl,
      credentials
    );
  }

  /**
   * Verify connection and update status/capabilities in database.
   *
   * @param id - Connection ID
   * @returns Success status and error message if failed
   */
  async verifyConnection(
    id: string
  ): Promise<{ success: boolean; error?: string }> {
    const adapter = await this.getConnectionWithAdapter(id);

    if (!adapter) {
      return { success: false, error: "Connection not found" };
    }

    try {
      const result: CapabilityResult = await adapter.verifyConnection();

      // Update status and capabilities
      await db
        .update(siteConnections)
        .set({
          status: result.connected ? "active" : "error",
          capabilities: result.capabilities
            ? Object.keys(result.capabilities).filter(
                (k) =>
                  result.capabilities![k as keyof typeof result.capabilities]
              )
            : [],
          lastVerifiedAt: new Date(),
          lastErrorMessage: result.error ?? null,
          updatedAt: new Date(),
        })
        .where(eq(siteConnections.id, id));

      return { success: result.connected, error: result.error };
    } catch (error) {
      // Update status to error
      await db
        .update(siteConnections)
        .set({
          status: "error",
          lastErrorMessage: (error as Error).message,
          updatedAt: new Date(),
        })
        .where(eq(siteConnections.id, id));

      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Update connection status.
   *
   * @param id - Connection ID
   * @param status - New status
   * @param errorMessage - Optional error message
   */
  async updateStatus(
    id: string,
    status: ConnectionStatus,
    errorMessage?: string
  ): Promise<void> {
    await db
      .update(siteConnections)
      .set({
        status,
        lastErrorMessage: errorMessage ?? null,
        updatedAt: new Date(),
      })
      .where(eq(siteConnections.id, id));
  }

  /**
   * Delete a connection.
   *
   * @param id - Connection ID
   */
  async deleteConnection(id: string): Promise<void> {
    await db.delete(siteConnections).where(eq(siteConnections.id, id));
  }

  /**
   * Strip encrypted credentials from connection row.
   * Returns hasCredentials flag instead.
   */
  private stripCredentials(
    row: SiteConnectionSelect
  ): ConnectionWithoutCredentials {
    const { encryptedCredentials, ...rest } = row;
    return {
      ...rest,
      hasCredentials: !!encryptedCredentials,
    };
  }

  /**
   * Create platform adapter from decrypted credentials.
   *
   * @throws Error for unsupported platforms
   */
  private createAdapter(
    platform: PlatformType,
    siteUrl: string,
    credentials: Record<string, unknown>
  ): PlatformAdapter {
    switch (platform) {
      case "wordpress":
        return new WordPressAdapter({
          siteUrl,
          username: credentials.username as string,
          appPassword: credentials.appPassword as string,
        });
      case "shopify":
        return new ShopifyAdapter({
          shopDomain: new URL(siteUrl).hostname,
          accessToken: credentials.accessToken as string,
        });
      case "wix":
        return new WixAdapter({
          siteId: credentials.siteId as string,
          accessToken: credentials.accessToken as string,
          accountId: credentials.accountId as string | undefined,
        });
      case "squarespace":
        return new SquarespaceAdapter({
          siteId: credentials.siteId as string,
          apiKey: credentials.apiKey as string,
        });
      case "webflow":
        return new WebflowAdapter({
          siteId: credentials.siteId as string,
          accessToken: credentials.accessToken as string,
        });
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }
}

/**
 * Singleton instance for use in API routes.
 */
export const connectionService = new ConnectionService();
