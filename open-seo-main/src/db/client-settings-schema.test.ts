/**
 * Tests for client-settings-schema.ts
 * Phase 87-01: Client Portal Foundation
 *
 * TDD RED phase - tests for client settings and notification preferences
 */
import { describe, it, expect } from "vitest";
import {
  clientSettings,
  notificationPreferences,
  COMMUNICATION_STYLES,
  type CommunicationStyle,
  type ClientSettingsSelect,
  type NotificationPreferencesSelect,
} from "./client-settings-schema";

describe("client-settings-schema", () => {
  describe("clientSettings table", () => {
    it("should have required columns", () => {
      const columns = Object.keys(clientSettings);
      expect(columns.length).toBeGreaterThan(0);
    });

    it("should have required columns", () => {
      const columns = Object.keys(clientSettings);
      expect(columns).toContain("id");
      expect(columns).toContain("clientId");
      expect(columns).toContain("communicationStyle");
      expect(columns).toContain("portalEnabled");
      expect(columns).toContain("portalAuthLevel");
      expect(columns).toContain("notificationsEnabled");
      expect(columns).toContain("contentApprovalRequired");
      expect(columns).toContain("autoApproveAfterDays");
      expect(columns).toContain("keywordLockinEnabled");
      expect(columns).toContain("keywordLockinStrict");
      expect(columns).toContain("updatedAt");
    });
  });

  describe("notificationPreferences table", () => {
    it("should have required columns", () => {
      const columns = Object.keys(notificationPreferences);
      expect(columns.length).toBeGreaterThan(0);
    });

    it("should have required columns", () => {
      const columns = Object.keys(notificationPreferences);
      expect(columns).toContain("id");
      expect(columns).toContain("clientId");
      expect(columns).toContain("weeklyDigest");
      expect(columns).toContain("monthlyReport");
      expect(columns).toContain("milestoneAlerts");
      expect(columns).toContain("contentPublished");
      expect(columns).toContain("recipientEmails");
      expect(columns).toContain("updatedAt");
    });
  });

  describe("COMMUNICATION_STYLES enum", () => {
    it("should have three valid styles", () => {
      expect(COMMUNICATION_STYLES).toContain("high_touch");
      expect(COMMUNICATION_STYLES).toContain("hybrid");
      expect(COMMUNICATION_STYLES).toContain("self_service");
      expect(COMMUNICATION_STYLES.length).toBe(3);
    });
  });

  describe("type exports", () => {
    it("should export CommunicationStyle type", () => {
      const style: CommunicationStyle = "hybrid";
      expect(style).toBe("hybrid");
    });
  });
});
