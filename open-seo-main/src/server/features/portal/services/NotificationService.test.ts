/**
 * NotificationService tests - Portal notification infrastructure.
 * Phase 90-01: Trust Foundation
 *
 * Tests notification queueing, settings management, and delivery tracking.
 * Notifications are async via BullMQ, delivered via Resend for email channel.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotificationService } from "./NotificationService";
import type {
  PortalNotificationSelect,
  PortalNotificationSettingsSelect,
  NotificationPayload,
} from "@/db";

// Track mock call responses for sequential db calls
let mockCallResponses: unknown[] = [];
let mockCallIndex = 0;

// Mock queue add function - must be hoisted via vi.hoisted()
const { mockQueueAdd } = vi.hoisted(() => ({
  mockQueueAdd: vi.fn().mockResolvedValue({ id: "job-123" }),
}));

// Mock the database module
vi.mock("@/db", () => {
  const chainMock = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => {
      const response = mockCallResponses[mockCallIndex] ?? [];
      mockCallIndex++;
      return Promise.resolve(response);
    }),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockImplementation(() => {
      const response = mockCallResponses[mockCallIndex] ?? [];
      mockCallIndex++;
      return Promise.resolve(response);
    }),
    set: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockImplementation(() => ({
      returning: vi.fn().mockImplementation(() => {
        const response = mockCallResponses[mockCallIndex] ?? [];
        mockCallIndex++;
        return Promise.resolve(response);
      }),
    })),
  };

  return {
    db: {
      select: vi.fn().mockReturnValue(chainMock),
      insert: vi.fn().mockReturnValue(chainMock),
      update: vi.fn().mockReturnValue(chainMock),
    },
    portalNotifications: {
      id: Symbol("id"),
      clientId: Symbol("clientId"),
      type: Symbol("type"),
      channel: Symbol("channel"),
      status: Symbol("status"),
      payload: Symbol("payload"),
      createdAt: Symbol("createdAt"),
      sentAt: Symbol("sentAt"),
    },
    portalNotificationSettings: {
      clientId: Symbol("clientId"),
      winEmail: Symbol("winEmail"),
      winSlack: Symbol("winSlack"),
      winPush: Symbol("winPush"),
      alertEmail: Symbol("alertEmail"),
      alertSlack: Symbol("alertSlack"),
      alertPush: Symbol("alertPush"),
      updatePush: Symbol("updatePush"),
      weeklyDigest: Symbol("weeklyDigest"),
      digestDay: Symbol("digestDay"),
      settings: Symbol("settings"),
      updatedAt: Symbol("updatedAt"),
    },
    NOTIFICATION_TYPES: ["win", "alert", "update", "digest"],
    NOTIFICATION_CHANNELS: ["in_app", "email", "slack", "push"],
    NOTIFICATION_STATUS: ["pending", "sent", "failed"],
  };
});

// Mock the notification queue
vi.mock("@/server/queues/notificationQueue", () => ({
  getNotificationQueue: vi.fn().mockReturnValue({
    add: mockQueueAdd,
  }),
  NOTIFICATION_QUEUE_NAME: "portal-notifications",
}));

// Import mocked module after vi.mock
import { db } from "@/db";
import { getNotificationQueue } from "@/server/queues/notificationQueue";

// Helper to set mock responses for sequential db calls
function setMockResponses(...responses: unknown[]) {
  mockCallResponses = responses;
  mockCallIndex = 0;
}

describe("NotificationService", () => {
  const testClientId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    vi.clearAllMocks();
    mockCallResponses = [];
    mockCallIndex = 0;
    mockQueueAdd.mockClear();
  });

  describe("queueNotification", () => {
    it("adds job to BullMQ queue", async () => {
      // Mock notification settings that allow email wins
      const mockSettings: Partial<PortalNotificationSettingsSelect> = {
        clientId: testClientId,
        winEmail: true,
        winSlack: true,
        winPush: true,
      };

      // Mock: first call returns settings, second returns inserted notification
      const insertedNotification: Partial<PortalNotificationSelect> = {
        id: "notification-123",
        clientId: testClientId,
        type: "win",
        channel: "email",
        status: "pending",
        payload: { keyword: "best seo tool", position: 5 } as NotificationPayload,
        createdAt: new Date(),
      };

      setMockResponses([mockSettings], [insertedNotification]);

      const result = await NotificationService.queueNotification(
        testClientId,
        "win",
        "email",
        { keyword: "best seo tool", position: 5 }
      );

      expect(result).toBeDefined();
      expect(mockQueueAdd).toHaveBeenCalledTimes(1);
      expect(mockQueueAdd).toHaveBeenCalledWith(
        "win",
        expect.objectContaining({
          notificationId: "notification-123",
          clientId: testClientId,
          type: "win",
          channel: "email",
        }),
        expect.any(Object)
      );
    });

    it("checks notification settings before queuing", async () => {
      // Mock notification settings that DISABLE email wins
      const mockSettings: Partial<PortalNotificationSettingsSelect> = {
        clientId: testClientId,
        winEmail: false, // Disabled!
        winSlack: true,
        winPush: true,
      };

      setMockResponses([mockSettings]);

      const result = await NotificationService.queueNotification(
        testClientId,
        "win",
        "email",
        { keyword: "best seo tool", position: 5 }
      );

      // Should return null and NOT queue
      expect(result).toBeNull();
      expect(mockQueueAdd).not.toHaveBeenCalled();
    });
  });

  describe("getNotificationSettings", () => {
    it("returns client preferences with defaults", async () => {
      // Mock: return existing settings
      const mockSettings: Partial<PortalNotificationSettingsSelect> = {
        clientId: testClientId,
        winEmail: true,
        winSlack: false,
        winPush: true,
        alertEmail: true,
        alertSlack: false,
        alertPush: true,
        updatePush: true,
        weeklyDigest: true,
        digestDay: 1,
        settings: {},
      };

      setMockResponses([mockSettings]);

      const result = await NotificationService.getNotificationSettings(testClientId);

      expect(result.winEmail).toBe(true);
      expect(result.winSlack).toBe(false);
      expect(result.digestDay).toBe(1);
    });
  });

  describe("updateNotificationSettings", () => {
    it("upserts client preferences", async () => {
      const updatedSettings: Partial<PortalNotificationSettingsSelect> = {
        clientId: testClientId,
        winEmail: false,
        winSlack: true,
        winPush: true,
        alertEmail: true,
        alertSlack: true,
        alertPush: true,
        updatePush: true,
        weeklyDigest: false,
        digestDay: 5,
        settings: {},
      };

      setMockResponses([updatedSettings]);

      const result = await NotificationService.updateNotificationSettings(
        testClientId,
        { winEmail: false, weeklyDigest: false, digestDay: 5 }
      );

      expect(result.winEmail).toBe(false);
      expect(result.weeklyDigest).toBe(false);
      expect(result.digestDay).toBe(5);
    });
  });

  describe("getClientNotifications", () => {
    it("returns recent notifications (in_app channel)", async () => {
      const mockNotifications: Partial<PortalNotificationSelect>[] = [
        {
          id: "notif-1",
          clientId: testClientId,
          type: "win",
          channel: "in_app",
          status: "sent",
          payload: { keyword: "seo tool", position: 3 } as NotificationPayload,
          createdAt: new Date("2026-05-01"),
        },
        {
          id: "notif-2",
          clientId: testClientId,
          type: "alert",
          channel: "in_app",
          status: "sent",
          payload: { keyword: "rank tracker", dropAmount: 10 } as NotificationPayload,
          createdAt: new Date("2026-04-28"),
        },
      ];

      setMockResponses(mockNotifications);

      const result = await NotificationService.getClientNotifications(testClientId, 10);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe("win");
      expect(result[1].type).toBe("alert");
    });
  });

  describe("markNotificationSent", () => {
    it("updates notification status to sent", async () => {
      const updatedNotification: Partial<PortalNotificationSelect> = {
        id: "notif-1",
        clientId: testClientId,
        status: "sent",
        sentAt: new Date(),
      };

      setMockResponses([updatedNotification]);

      const result = await NotificationService.markNotificationSent("notif-1");

      expect(result?.status).toBe("sent");
      expect(result?.sentAt).toBeDefined();
    });
  });
});
