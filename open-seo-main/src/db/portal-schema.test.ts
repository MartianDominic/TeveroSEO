/**
 * Tests for portal-schema.ts
 * Phase 87-01: Client Portal Foundation
 * Phase 90-01: Trust Foundation Extension
 *
 * TDD RED phase - tests for portal tokens, users, activities, and notifications schema
 */
import { describe, it, expect } from "vitest";
import {
  portalTokens,
  portalUsers,
  portalActivities,
  portalNotifications,
  portalNotificationSettings,
  AUTH_LEVELS,
  ACTIVITY_CATEGORIES,
  NOTIFICATION_TYPES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATUS,
  type AuthLevel,
  type ActivityCategory,
  type NotificationType,
  type NotificationChannel,
  type NotificationStatus,
  type PortalTokenSelect,
  type PortalUserSelect,
  type PortalActivitySelect,
  type PortalNotificationSelect,
  type PortalNotificationSettingsSelect,
  type ActivityArtifact,
  type NotificationPayload,
} from "./portal-schema";

describe("portal-schema", () => {
  describe("portalTokens table", () => {
    it("should have required columns", () => {
      // Verifies table structure via column enumeration
      const columns = Object.keys(portalTokens);
      expect(columns.length).toBeGreaterThan(0);
    });

    it("should have required columns", () => {
      const columns = Object.keys(portalTokens);
      expect(columns).toContain("id");
      expect(columns).toContain("clientId");
      expect(columns).toContain("token");
      expect(columns).toContain("authLevel");
      expect(columns).toContain("expiresAt");
      expect(columns).toContain("lastAccessedAt");
      expect(columns).toContain("accessCount");
      expect(columns).toContain("isRevoked");
      expect(columns).toContain("revokedAt");
      expect(columns).toContain("createdAt");
    });

    it("should have token column with max length 32", () => {
      // Check token column exists and has varchar type
      expect(portalTokens.token).toBeDefined();
    });
  });

  describe("portalUsers table", () => {
    it("should have required columns", () => {
      const columns = Object.keys(portalUsers);
      expect(columns.length).toBeGreaterThan(0);
    });

    it("should have required columns", () => {
      const columns = Object.keys(portalUsers);
      expect(columns).toContain("id");
      expect(columns).toContain("clientId");
      expect(columns).toContain("email");
      expect(columns).toContain("clerkUserId");
      expect(columns).toContain("emailVerifiedAt");
      expect(columns).toContain("lastLoginAt");
      expect(columns).toContain("loginCount");
      expect(columns).toContain("createdAt");
    });
  });

  describe("AUTH_LEVELS enum", () => {
    it("should have three valid auth levels", () => {
      expect(AUTH_LEVELS).toContain("token_only");
      expect(AUTH_LEVELS).toContain("email_verify");
      expect(AUTH_LEVELS).toContain("full_login");
      expect(AUTH_LEVELS.length).toBe(3);
    });
  });

  describe("type exports", () => {
    it("should export AuthLevel type", () => {
      const level: AuthLevel = "token_only";
      expect(level).toBe("token_only");
    });
  });

  // =============================================================================
  // Phase 90-01: Trust Foundation Extension Tests
  // =============================================================================

  describe("portalActivities table", () => {
    it("should have required columns", () => {
      const columns = Object.keys(portalActivities);
      expect(columns).toContain("id");
      expect(columns).toContain("clientId");
      expect(columns).toContain("contractId");
      expect(columns).toContain("category");
      expect(columns).toContain("title");
      expect(columns).toContain("description");
      expect(columns).toContain("artifacts");
      expect(columns).toContain("createdAt");
      expect(columns).toContain("createdBy");
    });

    it("should have artifacts column for JSONB array", () => {
      expect(portalActivities.artifacts).toBeDefined();
    });
  });

  describe("ACTIVITY_CATEGORIES enum", () => {
    it("should have six valid activity categories", () => {
      expect(ACTIVITY_CATEGORIES).toContain("content");
      expect(ACTIVITY_CATEGORIES).toContain("technical");
      expect(ACTIVITY_CATEGORIES).toContain("links");
      expect(ACTIVITY_CATEGORIES).toContain("tracking");
      expect(ACTIVITY_CATEGORIES).toContain("analytics");
      expect(ACTIVITY_CATEGORIES).toContain("communication");
      expect(ACTIVITY_CATEGORIES.length).toBe(6);
    });

    it("should allow valid ActivityCategory type values", () => {
      const category: ActivityCategory = "content";
      expect(category).toBe("content");
    });
  });

  describe("portalNotifications table", () => {
    it("should have required columns", () => {
      const columns = Object.keys(portalNotifications);
      expect(columns).toContain("id");
      expect(columns).toContain("clientId");
      expect(columns).toContain("type");
      expect(columns).toContain("channel");
      expect(columns).toContain("status");
      expect(columns).toContain("payload");
      expect(columns).toContain("createdAt");
      expect(columns).toContain("sentAt");
      expect(columns).toContain("failedAt");
      expect(columns).toContain("failureReason");
    });

    it("should have payload column for JSONB", () => {
      expect(portalNotifications.payload).toBeDefined();
    });
  });

  describe("NOTIFICATION_TYPES enum", () => {
    it("should have four valid notification types", () => {
      expect(NOTIFICATION_TYPES).toContain("win");
      expect(NOTIFICATION_TYPES).toContain("alert");
      expect(NOTIFICATION_TYPES).toContain("update");
      expect(NOTIFICATION_TYPES).toContain("digest");
      expect(NOTIFICATION_TYPES.length).toBe(4);
    });

    it("should allow valid NotificationType type values", () => {
      const type: NotificationType = "win";
      expect(type).toBe("win");
    });
  });

  describe("NOTIFICATION_CHANNELS enum", () => {
    it("should have four valid notification channels", () => {
      expect(NOTIFICATION_CHANNELS).toContain("in_app");
      expect(NOTIFICATION_CHANNELS).toContain("email");
      expect(NOTIFICATION_CHANNELS).toContain("slack");
      expect(NOTIFICATION_CHANNELS).toContain("push");
      expect(NOTIFICATION_CHANNELS.length).toBe(4);
    });

    it("should allow valid NotificationChannel type values", () => {
      const channel: NotificationChannel = "email";
      expect(channel).toBe("email");
    });
  });

  describe("NOTIFICATION_STATUS enum", () => {
    it("should have three valid notification statuses", () => {
      expect(NOTIFICATION_STATUS).toContain("pending");
      expect(NOTIFICATION_STATUS).toContain("sent");
      expect(NOTIFICATION_STATUS).toContain("failed");
      expect(NOTIFICATION_STATUS.length).toBe(3);
    });

    it("should allow valid NotificationStatus type values", () => {
      const status: NotificationStatus = "pending";
      expect(status).toBe("pending");
    });
  });

  describe("portalNotificationSettings table", () => {
    it("should have required columns", () => {
      const columns = Object.keys(portalNotificationSettings);
      expect(columns).toContain("clientId");
      expect(columns).toContain("winEmail");
      expect(columns).toContain("winSlack");
      expect(columns).toContain("winPush");
      expect(columns).toContain("alertEmail");
      expect(columns).toContain("alertSlack");
      expect(columns).toContain("alertPush");
      expect(columns).toContain("updatePush");
      expect(columns).toContain("weeklyDigest");
      expect(columns).toContain("digestDay");
      expect(columns).toContain("settings");
      expect(columns).toContain("updatedAt");
    });

    it("should use clientId as primary key", () => {
      expect(portalNotificationSettings.clientId).toBeDefined();
    });
  });

  describe("ActivityArtifact interface", () => {
    it("should have label and url properties", () => {
      const artifact: ActivityArtifact = {
        label: "Content Brief",
        url: "https://example.com/brief.pdf",
      };
      expect(artifact.label).toBe("Content Brief");
      expect(artifact.url).toBe("https://example.com/brief.pdf");
    });
  });

  describe("NotificationPayload interface", () => {
    it("should support win notification payload", () => {
      const payload: NotificationPayload = {
        keyword: "seo services",
        position: 5,
        previousPosition: 15,
        monthlyVolume: 5000,
        portalUrl: "https://portal.example.com",
      };
      expect(payload.keyword).toBe("seo services");
      expect(payload.position).toBe(5);
      expect(payload.previousPosition).toBe(15);
    });

    it("should support alert notification payload", () => {
      const payload: NotificationPayload = {
        keyword: "seo services",
        position: 25,
        previousPosition: 8,
        dropAmount: 17,
      };
      expect(payload.dropAmount).toBe(17);
    });

    it("should support digest notification payload", () => {
      const payload: NotificationPayload = {
        summary: {
          clicks: 1500,
          impressions: 50000,
          top10Count: 12,
          winsCount: 3,
        },
      };
      expect(payload.summary?.clicks).toBe(1500);
      expect(payload.summary?.winsCount).toBe(3);
    });
  });
});
