/**
 * Tests for oauth-state-schema.ts
 * Phase 61-01: OAuth State Schema for CSRF protection
 *
 * TDD: Tests written before implementation.
 */
import { describe, it, expect } from "vitest";
import { getTableName, getTableColumns } from "drizzle-orm";
import {
  oauthStates,
  type OAuthStateSelect,
  type OAuthStateInsert,
} from "./oauth-state-schema";

describe("oauth-state-schema", () => {
  describe("oauthStates table", () => {
    it("should have table name 'oauth_states'", () => {
      expect(getTableName(oauthStates)).toBe("oauth_states");
    });

    it("should have all required columns for CSRF protection", () => {
      const columns = getTableColumns(oauthStates);
      const columnNames = Object.keys(columns);

      expect(columnNames).toContain("id");
      expect(columnNames).toContain("state");
      expect(columnNames).toContain("platform");
      expect(columnNames).toContain("workspaceId");
      expect(columnNames).toContain("prospectId");
      expect(columnNames).toContain("userId");
      expect(columnNames).toContain("redirectUri");
      expect(columnNames).toContain("scopes");
      expect(columnNames).toContain("expiresAt");
      expect(columnNames).toContain("usedAt");
      expect(columnNames).toContain("createdAt");
    });

    it("should have id as text primary key", () => {
      const columns = getTableColumns(oauthStates);
      expect(columns.id.dataType).toBe("string");
      expect(columns.id.notNull).toBe(true);
    });

    it("should have state as unique non-null text", () => {
      const columns = getTableColumns(oauthStates);
      expect(columns.state.dataType).toBe("string");
      expect(columns.state.notNull).toBe(true);
      expect(columns.state.isUnique).toBe(true);
    });

    it("should have platform as non-null text", () => {
      const columns = getTableColumns(oauthStates);
      expect(columns.platform.dataType).toBe("string");
      expect(columns.platform.notNull).toBe(true);
    });

    it("should have workspaceId as non-null text", () => {
      const columns = getTableColumns(oauthStates);
      expect(columns.workspaceId.dataType).toBe("string");
      expect(columns.workspaceId.notNull).toBe(true);
    });

    it("should have prospectId as nullable text", () => {
      const columns = getTableColumns(oauthStates);
      expect(columns.prospectId.dataType).toBe("string");
      expect(columns.prospectId.notNull).toBe(false);
    });

    it("should have userId as non-null text", () => {
      const columns = getTableColumns(oauthStates);
      expect(columns.userId.dataType).toBe("string");
      expect(columns.userId.notNull).toBe(true);
    });

    it("should have redirectUri as non-null text", () => {
      const columns = getTableColumns(oauthStates);
      expect(columns.redirectUri.dataType).toBe("string");
      expect(columns.redirectUri.notNull).toBe(true);
    });

    it("should have scopes as non-null jsonb", () => {
      const columns = getTableColumns(oauthStates);
      expect(columns.scopes.dataType).toBe("json");
      expect(columns.scopes.notNull).toBe(true);
    });

    it("should have expiresAt as non-null timestamp for 10-minute expiry", () => {
      const columns = getTableColumns(oauthStates);
      expect(columns.expiresAt.dataType).toBe("date");
      expect(columns.expiresAt.notNull).toBe(true);
    });

    it("should have usedAt as nullable timestamp", () => {
      const columns = getTableColumns(oauthStates);
      expect(columns.usedAt.dataType).toBe("date");
      expect(columns.usedAt.notNull).toBe(false);
    });

    it("should have createdAt as timestamp with default", () => {
      const columns = getTableColumns(oauthStates);
      expect(columns.createdAt.dataType).toBe("date");
      expect(columns.createdAt.hasDefault).toBe(true);
    });
  });

  describe("Type exports", () => {
    it("should export OAuthStateSelect type", () => {
      const _typeCheck: OAuthStateSelect = {
        id: "state-1",
        state: "random-csrf-token",
        platform: "google_search_console",
        workspaceId: "ws-1",
        prospectId: null,
        userId: "user-1",
        redirectUri: "https://app.example.com/oauth/callback",
        scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
        expiresAt: new Date(),
        usedAt: null,
        createdAt: new Date(),
      };
      expect(_typeCheck).toBeDefined();
    });

    it("should export OAuthStateInsert type", () => {
      const _typeCheck: OAuthStateInsert = {
        id: "state-1",
        state: "random-csrf-token",
        platform: "google_search_console",
        workspaceId: "ws-1",
        userId: "user-1",
        redirectUri: "https://app.example.com/oauth/callback",
        scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
        expiresAt: new Date(),
      };
      expect(_typeCheck).toBeDefined();
    });
  });
});
