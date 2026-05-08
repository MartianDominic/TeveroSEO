/**
 * Workspace Portal Settings Schema Tests
 * Phase 96: CPR-005, CPR-007
 */
import { describe, it, expect } from "vitest";
import {
  SESSION_TIMEOUT_OPTIONS,
  COMMON_TIMEZONES,
  DEFAULT_PORTAL_SETTINGS,
  type SessionTimeoutHours,
} from "./workspace-portal-settings-schema";

describe("Workspace Portal Settings Schema", () => {
  describe("SESSION_TIMEOUT_OPTIONS", () => {
    it("should contain expected timeout values in hours", () => {
      expect(SESSION_TIMEOUT_OPTIONS).toContain(1);
      expect(SESSION_TIMEOUT_OPTIONS).toContain(8);
      expect(SESSION_TIMEOUT_OPTIONS).toContain(24);
      expect(SESSION_TIMEOUT_OPTIONS).toContain(48);
      expect(SESSION_TIMEOUT_OPTIONS).toContain(72);
    });

    it("should have minimum of 1 hour", () => {
      const min = Math.min(...SESSION_TIMEOUT_OPTIONS);
      expect(min).toBe(1);
    });

    it("should have maximum of 72 hours", () => {
      const max = Math.max(...SESSION_TIMEOUT_OPTIONS);
      expect(max).toBe(72);
    });

    it("should be sorted in ascending order", () => {
      const sorted = [...SESSION_TIMEOUT_OPTIONS].sort((a, b) => a - b);
      expect(SESSION_TIMEOUT_OPTIONS).toEqual(sorted);
    });
  });

  describe("COMMON_TIMEZONES", () => {
    it("should contain UTC", () => {
      expect(COMMON_TIMEZONES).toContain("UTC");
    });

    it("should contain major US timezones", () => {
      expect(COMMON_TIMEZONES).toContain("America/New_York");
      expect(COMMON_TIMEZONES).toContain("America/Chicago");
      expect(COMMON_TIMEZONES).toContain("America/Denver");
      expect(COMMON_TIMEZONES).toContain("America/Los_Angeles");
    });

    it("should contain major European timezones", () => {
      expect(COMMON_TIMEZONES).toContain("Europe/London");
      expect(COMMON_TIMEZONES).toContain("Europe/Paris");
      expect(COMMON_TIMEZONES).toContain("Europe/Berlin");
      expect(COMMON_TIMEZONES).toContain("Europe/Vilnius");
    });

    it("should contain major Asia-Pacific timezones", () => {
      expect(COMMON_TIMEZONES).toContain("Asia/Tokyo");
      expect(COMMON_TIMEZONES).toContain("Asia/Singapore");
      expect(COMMON_TIMEZONES).toContain("Australia/Sydney");
    });

    it("should all be valid IANA timezone identifiers", () => {
      COMMON_TIMEZONES.forEach((tz) => {
        expect(() => {
          Intl.DateTimeFormat("en-US", { timeZone: tz });
        }).not.toThrow();
      });
    });
  });

  describe("DEFAULT_PORTAL_SETTINGS", () => {
    it("should have sessionTimeoutHours of 24", () => {
      expect(DEFAULT_PORTAL_SETTINGS.sessionTimeoutHours).toBe(24);
    });

    it("should have timezone of UTC", () => {
      expect(DEFAULT_PORTAL_SETTINGS.timezone).toBe("UTC");
    });

    it("should have sessionTimeoutHours within valid range", () => {
      expect(DEFAULT_PORTAL_SETTINGS.sessionTimeoutHours).toBeGreaterThanOrEqual(1);
      expect(DEFAULT_PORTAL_SETTINGS.sessionTimeoutHours).toBeLessThanOrEqual(72);
    });
  });

  describe("Type exports", () => {
    it("should export SessionTimeoutHours as valid type", () => {
      const timeout: SessionTimeoutHours = 24;
      expect(timeout).toBe(24);

      // These should all be valid
      const validTimeouts: SessionTimeoutHours[] = [1, 2, 4, 8, 12, 24, 48, 72];
      expect(validTimeouts).toHaveLength(SESSION_TIMEOUT_OPTIONS.length);
    });
  });
});
