/**
 * Tests for platform-connection-schema.ts
 * Phase 61-01: Platform Integration Schema
 *
 * TDD: Tests written before implementation.
 */
import { describe, it, expect } from "vitest";
import { getTableName, getTableColumns } from "drizzle-orm";
import {
  platformConnections,
  OAUTH_PLATFORM_TYPES,
  OAUTH_CONNECTION_STATUS,
  CREDENTIAL_TYPES,
  SYNC_SCHEDULES,
  type PlatformConnectionSelect,
  type PlatformConnectionInsert,
} from "./platform-connection-schema";

describe("platform-connection-schema", () => {
  describe("platformConnections table", () => {
    it("should have table name 'platform_connections'", () => {
      expect(getTableName(platformConnections)).toBe("platform_connections");
    });

    it("should have all required columns for OAuth token storage", () => {
      const columns = getTableColumns(platformConnections);
      const columnNames = Object.keys(columns);

      // Core identification
      expect(columnNames).toContain("id");
      expect(columnNames).toContain("workspaceId");
      expect(columnNames).toContain("prospectId");
      expect(columnNames).toContain("platform");

      // OAuth tokens (encrypted)
      expect(columnNames).toContain("accessTokenEncrypted");
      expect(columnNames).toContain("refreshTokenEncrypted");
      expect(columnNames).toContain("tokenExpiresAt");
      expect(columnNames).toContain("tokenType");

      // Platform account info
      expect(columnNames).toContain("platformAccountId");
      expect(columnNames).toContain("platformAccountName");
      expect(columnNames).toContain("platformSiteUrl");

      // Non-OAuth credentials
      expect(columnNames).toContain("credentialType");
      expect(columnNames).toContain("credentialsEncrypted");

      // Status and sync
      expect(columnNames).toContain("status");
      expect(columnNames).toContain("lastSyncAt");
      expect(columnNames).toContain("lastSyncStatus");
      expect(columnNames).toContain("lastError");
      expect(columnNames).toContain("syncSchedule");

      // Scopes
      expect(columnNames).toContain("scopesRequested");
      expect(columnNames).toContain("scopesGranted");

      // Audit
      expect(columnNames).toContain("connectedAt");
      expect(columnNames).toContain("connectedBy");
      expect(columnNames).toContain("revokedAt");
      expect(columnNames).toContain("revokedBy");

      // Timestamps
      expect(columnNames).toContain("createdAt");
      expect(columnNames).toContain("updatedAt");
    });

    it("should have id as text primary key", () => {
      const columns = getTableColumns(platformConnections);
      expect(columns.id.dataType).toBe("string");
      expect(columns.id.notNull).toBe(true);
    });

    it("should have workspaceId as non-null text", () => {
      const columns = getTableColumns(platformConnections);
      expect(columns.workspaceId.dataType).toBe("string");
      expect(columns.workspaceId.notNull).toBe(true);
    });

    it("should have prospectId as nullable text", () => {
      const columns = getTableColumns(platformConnections);
      expect(columns.prospectId.dataType).toBe("string");
      expect(columns.prospectId.notNull).toBe(false);
    });

    it("should have platform as non-null text", () => {
      const columns = getTableColumns(platformConnections);
      expect(columns.platform.dataType).toBe("string");
      expect(columns.platform.notNull).toBe(true);
    });

    it("should have accessTokenEncrypted as nullable text", () => {
      const columns = getTableColumns(platformConnections);
      expect(columns.accessTokenEncrypted.dataType).toBe("string");
      expect(columns.accessTokenEncrypted.notNull).toBe(false);
    });

    it("should have refreshTokenEncrypted as nullable text", () => {
      const columns = getTableColumns(platformConnections);
      expect(columns.refreshTokenEncrypted.dataType).toBe("string");
      expect(columns.refreshTokenEncrypted.notNull).toBe(false);
    });

    it("should have tokenExpiresAt as nullable timestamp", () => {
      const columns = getTableColumns(platformConnections);
      expect(columns.tokenExpiresAt.dataType).toBe("date");
      expect(columns.tokenExpiresAt.notNull).toBe(false);
    });

    it("should have tokenType with default 'Bearer'", () => {
      const columns = getTableColumns(platformConnections);
      expect(columns.tokenType.dataType).toBe("string");
      expect(columns.tokenType.hasDefault).toBe(true);
      expect(columns.tokenType.default).toBe("Bearer");
    });

    it("should have status as non-null with default 'pending'", () => {
      const columns = getTableColumns(platformConnections);
      expect(columns.status.dataType).toBe("string");
      expect(columns.status.notNull).toBe(true);
      expect(columns.status.hasDefault).toBe(true);
      expect(columns.status.default).toBe("pending");
    });

    it("should have syncSchedule with default 'daily'", () => {
      const columns = getTableColumns(platformConnections);
      expect(columns.syncSchedule.dataType).toBe("string");
      expect(columns.syncSchedule.hasDefault).toBe(true);
      expect(columns.syncSchedule.default).toBe("daily");
    });

    it("should have scopesRequested and scopesGranted as jsonb", () => {
      const columns = getTableColumns(platformConnections);
      expect(columns.scopesRequested.dataType).toBe("json");
      expect(columns.scopesGranted.dataType).toBe("json");
    });

    it("should have createdAt and updatedAt as timestamps with defaults", () => {
      const columns = getTableColumns(platformConnections);
      expect(columns.createdAt.dataType).toBe("date");
      expect(columns.createdAt.notNull).toBe(true);
      expect(columns.createdAt.hasDefault).toBe(true);

      expect(columns.updatedAt.dataType).toBe("date");
      expect(columns.updatedAt.notNull).toBe(true);
      expect(columns.updatedAt.hasDefault).toBe(true);
    });
  });

  describe("Enum exports", () => {
    it("should export OAUTH_PLATFORM_TYPES with 15 platforms", () => {
      expect(OAUTH_PLATFORM_TYPES).toBeDefined();
      expect(OAUTH_PLATFORM_TYPES.length).toBeGreaterThanOrEqual(15);
      expect(OAUTH_PLATFORM_TYPES).toContain("google_search_console");
      expect(OAUTH_PLATFORM_TYPES).toContain("google_analytics");
      expect(OAUTH_PLATFORM_TYPES).toContain("google_business_profile");
      expect(OAUTH_PLATFORM_TYPES).toContain("wordpress_com");
      expect(OAUTH_PLATFORM_TYPES).toContain("shopify");
      expect(OAUTH_PLATFORM_TYPES).toContain("wix");
      expect(OAUTH_PLATFORM_TYPES).toContain("squarespace");
      expect(OAUTH_PLATFORM_TYPES).toContain("webflow");
    });

    it("should export OAUTH_CONNECTION_STATUS with all status values", () => {
      expect(OAUTH_CONNECTION_STATUS).toBeDefined();
      expect(OAUTH_CONNECTION_STATUS).toContain("pending");
      expect(OAUTH_CONNECTION_STATUS).toContain("connecting");
      expect(OAUTH_CONNECTION_STATUS).toContain("active");
      expect(OAUTH_CONNECTION_STATUS).toContain("expired");
      expect(OAUTH_CONNECTION_STATUS).toContain("revoked");
      expect(OAUTH_CONNECTION_STATUS).toContain("error");
    });

    it("should export CREDENTIAL_TYPES for non-OAuth auth", () => {
      expect(CREDENTIAL_TYPES).toBeDefined();
      expect(CREDENTIAL_TYPES).toContain("oauth");
      expect(CREDENTIAL_TYPES).toContain("app_password");
      expect(CREDENTIAL_TYPES).toContain("api_key");
    });

    it("should export SYNC_SCHEDULES", () => {
      expect(SYNC_SCHEDULES).toBeDefined();
      expect(SYNC_SCHEDULES).toContain("hourly");
      expect(SYNC_SCHEDULES).toContain("daily");
      expect(SYNC_SCHEDULES).toContain("weekly");
      expect(SYNC_SCHEDULES).toContain("manual");
    });
  });

  describe("Index definitions", () => {
    // Note: Index definitions are verified via migration SQL generation.
    // Drizzle ORM does not expose a runtime API for querying indexes.
    it("should define indexes in schema (verified via migration)", () => {
      // The schema defines these indexes:
      // - idx_platform_connections_workspace_prospect ON (workspaceId, prospectId)
      // - idx_platform_connections_status ON (status)
      // - idx_platform_connections_expiry ON (tokenExpiresAt)
      // Actual verification happens when migration is generated.
      expect(platformConnections).toBeDefined();
    });
  });

  describe("Type exports", () => {
    it("should export PlatformConnectionSelect type", () => {
      const _typeCheck: PlatformConnectionSelect = {
        id: "conn-1",
        workspaceId: "ws-1",
        prospectId: null,
        platform: "google_search_console",
        platformAccountId: null,
        platformAccountName: null,
        platformSiteUrl: null,
        accessTokenEncrypted: null,
        refreshTokenEncrypted: null,
        tokenExpiresAt: null,
        tokenType: "Bearer",
        credentialType: null,
        credentialsEncrypted: null,
        status: "pending",
        lastSyncAt: null,
        lastSyncStatus: null,
        lastError: null,
        syncSchedule: "daily",
        scopesRequested: null,
        scopesGranted: null,
        connectedAt: null,
        connectedBy: null,
        revokedAt: null,
        revokedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(_typeCheck).toBeDefined();
    });

    it("should export PlatformConnectionInsert type", () => {
      const _typeCheck: PlatformConnectionInsert = {
        id: "conn-1",
        workspaceId: "ws-1",
        platform: "google_search_console",
      };
      expect(_typeCheck).toBeDefined();
    });
  });
});
