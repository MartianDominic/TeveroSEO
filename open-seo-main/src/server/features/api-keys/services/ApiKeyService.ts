/**
 * API Key management service with audit logging.
 *
 * Provides secure CRUD operations for API keys with comprehensive audit trails.
 * Keys are hashed before storage; the raw key is only returned on creation.
 */

import { eq, and, desc, isNull, or, gt } from "drizzle-orm";
import { db } from "@/db/index";
import {
  apiKeys,
  type ApiKeySelect,
  type ApiKeyInsert,
  type ApiKeyScope,
  API_KEY_SCOPES,
} from "@/db/api-key-schema";
import { withAudit, type AuditContext } from "@/db/audit";
import { AppError } from "@/server/lib/errors";
import { nanoid } from "nanoid";
import { createHash, randomBytes } from "crypto";

/**
 * Generate a secure API key.
 * Format: oseo_<32 random chars>
 */
function generateApiKey(): string {
  const randomPart = randomBytes(24).toString("base64url");
  return `oseo_${randomPart}`;
}

/**
 * Hash an API key using SHA-256.
 */
function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Get the prefix of an API key for display.
 */
function getKeyPrefix(key: string): string {
  return key.substring(0, 12);
}

export interface CreateApiKeyInput {
  organizationId: string;
  name: string;
  createdBy: string;
  scopes?: ApiKeyScope[];
  clientId?: string;
  expiresAt?: Date;
}

export interface ApiKeyWithRawKey extends ApiKeySelect {
  /** The raw API key - only available on creation */
  rawKey: string;
}

export interface ApiKeyPublic {
  id: string;
  name: string;
  keyPrefix: string;
  organizationId: string;
  clientId: string | null;
  scopes: ApiKeyScope[];
  enabled: boolean;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
}

/**
 * Convert ApiKeySelect to public view (removes sensitive fields).
 */
function toPublicKey(key: ApiKeySelect): ApiKeyPublic {
  return {
    id: key.id,
    name: key.name,
    keyPrefix: key.keyPrefix,
    organizationId: key.organizationId,
    clientId: key.clientId,
    scopes: JSON.parse(key.scopes) as ApiKeyScope[],
    enabled: key.enabled,
    expiresAt: key.expiresAt,
    lastUsedAt: key.lastUsedAt,
    createdAt: key.createdAt,
  };
}

/**
 * API Key service with audit logging.
 */
export const ApiKeyService = {
  /**
   * Create a new API key with audit logging.
   * Returns the raw key - this is the only time it's available.
   */
  async create(
    input: CreateApiKeyInput,
    auditContext: AuditContext
  ): Promise<ApiKeyWithRawKey> {
    const audit = withAudit<ApiKeySelect>("api_key", auditContext);

    // Validate scopes
    const scopes = input.scopes ?? ["*"];
    for (const scope of scopes) {
      if (!API_KEY_SCOPES.includes(scope)) {
        throw new AppError(
          "VALIDATION_ERROR",
          `Invalid scope: ${scope}. Valid scopes: ${API_KEY_SCOPES.join(", ")}`
        );
      }
    }

    // Generate the key
    const rawKey = generateApiKey();
    const keyHash = hashApiKey(rawKey);
    const keyPrefix = getKeyPrefix(rawKey);

    const id = nanoid();
    const now = new Date();

    const [created] = await db
      .insert(apiKeys)
      .values({
        id,
        keyHash,
        keyPrefix,
        name: input.name,
        organizationId: input.organizationId,
        clientId: input.clientId,
        createdBy: input.createdBy,
        scopes: JSON.stringify(scopes),
        expiresAt: input.expiresAt,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Log creation (without the key hash for security)
    await audit.logCreate(id, {
      ...created,
      keyHash: "[REDACTED]",
    } as unknown as ApiKeySelect, {
      scopes,
      hasClientRestriction: !!input.clientId,
      hasExpiration: !!input.expiresAt,
    });

    return {
      ...created,
      rawKey,
    };
  },

  /**
   * Find API key by ID (public view only).
   */
  async findById(id: string): Promise<ApiKeyPublic | null> {
    const [key] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, id))
      .limit(1);

    return key ? toPublicKey(key) : null;
  },

  /**
   * Find all API keys for an organization.
   */
  async findByOrganization(organizationId: string): Promise<ApiKeyPublic[]> {
    const keys = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.organizationId, organizationId))
      .orderBy(desc(apiKeys.createdAt));

    return keys.map(toPublicKey);
  },

  /**
   * Validate an API key and return its metadata.
   * Updates lastUsedAt timestamp.
   */
  async validateKey(
    rawKey: string,
    auditContext?: AuditContext
  ): Promise<ApiKeyPublic | null> {
    const keyHash = hashApiKey(rawKey);

    const [key] = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.keyHash, keyHash),
          eq(apiKeys.enabled, true),
          or(
            isNull(apiKeys.expiresAt),
            gt(apiKeys.expiresAt, new Date())
          )
        )
      )
      .limit(1);

    if (!key) {
      return null;
    }

    // Update last used timestamp
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, key.id));

    // Log sensitive access if audit context provided
    if (auditContext) {
      const audit = withAudit<ApiKeySelect>("api_key", auditContext);
      await audit.logSensitiveRead(key.id, ["key_validation"], {
        keyPrefix: key.keyPrefix,
      });
    }

    return toPublicKey(key);
  },

  /**
   * Update API key name or scopes with audit logging.
   */
  async update(
    id: string,
    input: { name?: string; scopes?: ApiKeyScope[] },
    auditContext: AuditContext
  ): Promise<ApiKeyPublic> {
    const audit = withAudit<ApiKeySelect>("api_key", auditContext);

    // Get current values
    const [oldKey] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, id))
      .limit(1);

    if (!oldKey) {
      throw new AppError("NOT_FOUND", `API key not found: ${id}`);
    }

    // Validate scopes if provided
    if (input.scopes) {
      for (const scope of input.scopes) {
        if (!API_KEY_SCOPES.includes(scope)) {
          throw new AppError(
            "VALIDATION_ERROR",
            `Invalid scope: ${scope}`
          );
        }
      }
    }

    const updateData: Partial<ApiKeyInsert> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.scopes !== undefined) updateData.scopes = JSON.stringify(input.scopes);

    const [updated] = await db
      .update(apiKeys)
      .set(updateData)
      .where(eq(apiKeys.id, id))
      .returning();

    // Log the update
    await audit.logUpdate(id, oldKey, updated);

    return toPublicKey(updated);
  },

  /**
   * Enable or disable an API key with audit logging.
   */
  async setEnabled(
    id: string,
    enabled: boolean,
    auditContext: AuditContext
  ): Promise<ApiKeyPublic> {
    const audit = withAudit<ApiKeySelect>("api_key", auditContext);

    const [oldKey] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, id))
      .limit(1);

    if (!oldKey) {
      throw new AppError("NOT_FOUND", `API key not found: ${id}`);
    }

    const [updated] = await db
      .update(apiKeys)
      .set({
        enabled,
        updatedAt: new Date(),
      })
      .where(eq(apiKeys.id, id))
      .returning();

    await audit.logUpdate(id, oldKey, updated, {
      operation: enabled ? "enable" : "disable",
    });

    return toPublicKey(updated);
  },

  /**
   * Revoke (delete) an API key with audit logging.
   */
  async revoke(id: string, auditContext: AuditContext): Promise<void> {
    const audit = withAudit<ApiKeySelect>("api_key", auditContext);

    const [key] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, id))
      .limit(1);

    if (!key) {
      throw new AppError("NOT_FOUND", `API key not found: ${id}`);
    }

    await db.delete(apiKeys).where(eq(apiKeys.id, id));

    // Log the revocation
    await audit.logDelete(id, key, {
      operation: "revoke",
      keyPrefix: key.keyPrefix,
    });
  },

  /**
   * Check if an API key has a specific scope.
   */
  hasScope(key: ApiKeyPublic, requiredScope: ApiKeyScope): boolean {
    // Full access scope
    if (key.scopes.includes("*")) {
      return true;
    }

    return key.scopes.includes(requiredScope);
  },

  /**
   * Rotate an API key (revoke old, create new) with audit logging.
   */
  async rotate(
    id: string,
    auditContext: AuditContext
  ): Promise<ApiKeyWithRawKey> {
    const audit = withAudit<ApiKeySelect>("api_key", auditContext);

    // Get the existing key
    const [oldKey] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, id))
      .limit(1);

    if (!oldKey) {
      throw new AppError("NOT_FOUND", `API key not found: ${id}`);
    }

    // Log the rotation as a sensitive operation
    await audit.logSensitiveRead(id, ["key_rotation"], {
      operation: "rotate",
      oldKeyPrefix: oldKey.keyPrefix,
    });

    // Create the new key
    const newKey = await this.create(
      {
        organizationId: oldKey.organizationId,
        name: oldKey.name,
        createdBy: auditContext.userId ?? oldKey.createdBy,
        scopes: JSON.parse(oldKey.scopes) as ApiKeyScope[],
        clientId: oldKey.clientId ?? undefined,
        expiresAt: oldKey.expiresAt ?? undefined,
      },
      auditContext
    );

    // Revoke the old key
    await this.revoke(id, auditContext);

    return newKey;
  },
};
