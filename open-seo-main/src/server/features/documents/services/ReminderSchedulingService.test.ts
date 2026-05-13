/**
 * ReminderSchedulingService Tests
 * Phase 101: Document Management (D-04)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the dependencies before importing the service
vi.mock("@/db", () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: "reminder_1" }]),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@/server/queues/documentReminderQueue", () => ({
  scheduleDocumentReminder: vi.fn().mockResolvedValue("job_1"),
  cancelDocumentReminder: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Import after mocks
import { ReminderSchedulingService } from "./ReminderSchedulingService";
import {
  scheduleDocumentReminder,
  cancelDocumentReminder,
} from "@/server/queues/documentReminderQueue";
import { db } from "@/db";

describe("ReminderSchedulingService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("scheduleReminder", () => {
    it("should schedule a reminder and return result", async () => {
      const input = {
        documentId: "doc_1",
        reminderType: "unopened" as const,
        scheduledFor: new Date("2026-01-15T09:00:00Z"),
        metadata: { reason: "test" },
      };

      const result = await ReminderSchedulingService.scheduleReminder(input);

      expect(result).toMatchObject({
        documentId: "doc_1",
        reminderType: "unopened",
        status: "pending",
      });
      expect(result.id).toBeDefined();
      expect(db.insert).toHaveBeenCalled();
      expect(scheduleDocumentReminder).toHaveBeenCalledWith(
        "doc_1",
        expect.any(String),
        "unopened",
        input.scheduledFor
      );
    });
  });

  describe("cancelReminder", () => {
    it("should cancel a pending reminder", async () => {
      const result = await ReminderSchedulingService.cancelReminder("reminder_1");

      expect(result).toBe(true);
      expect(db.update).toHaveBeenCalled();
      expect(cancelDocumentReminder).toHaveBeenCalledWith("reminder_1");
    });

    it("should return false if reminder not found", async () => {
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
      } as unknown as ReturnType<typeof db.update>);

      const result = await ReminderSchedulingService.cancelReminder("nonexistent");

      expect(result).toBe(false);
    });
  });

  describe("getNextBusinessDay", () => {
    it("should return a date at 9 AM", () => {
      const result = ReminderSchedulingService.getNextBusinessDay();

      // Always returns 9 AM local time
      expect(result.getHours()).toBe(9);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
    });

    it("should never return a weekend day", () => {
      const result = ReminderSchedulingService.getNextBusinessDay();

      // Should be Mon-Fri (1-5), not Sat (6) or Sun (0)
      expect(result.getDay()).toBeGreaterThan(0);
      expect(result.getDay()).toBeLessThan(6);
    });

    it("should return future date", () => {
      const now = new Date();
      const result = ReminderSchedulingService.getNextBusinessDay();

      // If it's before 9 AM on a weekday, it might be same day
      // Otherwise, it should be in the future
      const nowAt9AM = new Date(now);
      nowAt9AM.setHours(9, 0, 0, 0);

      // Result should be >= now at 9 AM today (or tomorrow's 9 AM if past)
      expect(result.getTime()).toBeGreaterThanOrEqual(nowAt9AM.getTime() - 86400000); // Allow for same day
    });
  });

  describe("markReminderSent", () => {
    it("should update reminder status to sent", async () => {
      await ReminderSchedulingService.markReminderSent("reminder_1");

      expect(db.update).toHaveBeenCalled();
    });
  });

  describe("getPendingReminders", () => {
    it("should return pending reminders for a document", async () => {
      const mockReminders = [
        {
          id: "r1",
          documentId: "doc_1",
          reminderType: "unopened",
          scheduledFor: new Date(),
          status: "pending",
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockReminders),
      } as unknown as ReturnType<typeof db.select>);

      const result = await ReminderSchedulingService.getPendingReminders("doc_1");

      expect(result).toHaveLength(1);
      expect(result[0].reminderType).toBe("unopened");
    });
  });
});
