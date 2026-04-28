/**
 * Tests for blocker detector.
 */
import { describe, it, expect } from "vitest";
import { detectBlocker, isRetryable, BLOCKER_TYPE } from "./blocker-detector";

describe("blocker-detector", () => {
  describe("detectBlocker", () => {
    it("should return DISCUSS_REQUIRED when gsd-discuss output detected", () => {
      const output = "Phase requires discussion. Invoking /gsd-discuss to gather input.";
      const blocker = detectBlocker(output, 0);

      expect(blocker).toBeTruthy();
      expect(blocker?.type).toBe(BLOCKER_TYPE.DISCUSS_REQUIRED);
      expect(blocker?.message).toContain("discussion");
      expect(blocker?.recoverable).toBe(true);
    });

    it("should return DISCUSS_REQUIRED when checkpoint:decision detected", () => {
      const output = "CHECKPOINT REACHED\n\nType: checkpoint:decision\n\nAwaiting user selection...";
      const blocker = detectBlocker(output, 0);

      expect(blocker?.type).toBe(BLOCKER_TYPE.DISCUSS_REQUIRED);
    });

    it("should return VERIFICATION_FAILED when verification fails", () => {
      const output = "Running verification...\nVERIFICATION FAILED: tests did not pass";
      const blocker = detectBlocker(output, 1);

      expect(blocker).toBeTruthy();
      expect(blocker?.type).toBe(BLOCKER_TYPE.VERIFICATION_FAILED);
      expect(blocker?.recoverable).toBe(true);
    });

    it("should return VERIFICATION_FAILED on non-zero exit with verify output", () => {
      const output = "Running verify step...\nError during verification";
      const blocker = detectBlocker(output, 1);

      expect(blocker?.type).toBe(BLOCKER_TYPE.VERIFICATION_FAILED);
    });

    it("should return MISSING_ENV_VAR when env var error detected", () => {
      const output = "Error: Missing required environment variable: DATABASE_URL";
      const blocker = detectBlocker(output, 1);

      expect(blocker).toBeTruthy();
      expect(blocker?.type).toBe(BLOCKER_TYPE.MISSING_ENV_VAR);
      expect(blocker?.context).toEqual({ envVar: "DATABASE_URL" });
      expect(blocker?.suggestedAction).toContain("DATABASE_URL");
    });

    it("should return AUTH_ERROR when authentication failed", () => {
      const output = "API call failed: authentication failed";
      const blocker = detectBlocker(output, 1);

      expect(blocker?.type).toBe(BLOCKER_TYPE.AUTH_ERROR);
    });

    it("should return AUTH_ERROR when 401 status detected", () => {
      const output = "HTTP 401 Unauthorized";
      const blocker = detectBlocker(output, 1);

      expect(blocker?.type).toBe(BLOCKER_TYPE.AUTH_ERROR);
    });

    it("should return MANUAL_ACTION_REQUIRED when checkpoint:human-action detected", () => {
      const output = "checkpoint:human-action - User must verify email link";
      const blocker = detectBlocker(output, 0);

      expect(blocker?.type).toBe(BLOCKER_TYPE.MANUAL_ACTION_REQUIRED);
      expect(blocker?.recoverable).toBe(true);
    });

    it("should return null when no blocker conditions met", () => {
      const output = "Plan executed successfully. All tests passed.";
      const blocker = detectBlocker(output, 0);

      expect(blocker).toBeNull();
    });

    it("should return null when exit code 0 and no blocker patterns", () => {
      const output = "Task completed";
      const blocker = detectBlocker(output, 0);

      expect(blocker).toBeNull();
    });
  });

  describe("isRetryable", () => {
    it("should return false for DISCUSS_REQUIRED", () => {
      const blocker = {
        type: BLOCKER_TYPE.DISCUSS_REQUIRED,
        message: "Discussion required",
        context: {},
        recoverable: true,
        suggestedAction: "Run gsd-discuss",
      };

      expect(isRetryable(blocker)).toBe(false);
    });

    it("should return false for MANUAL_ACTION_REQUIRED", () => {
      const blocker = {
        type: BLOCKER_TYPE.MANUAL_ACTION_REQUIRED,
        message: "Manual action needed",
        context: {},
        recoverable: true,
        suggestedAction: "Complete action",
      };

      expect(isRetryable(blocker)).toBe(false);
    });

    it("should return true for VERIFICATION_FAILED", () => {
      const blocker = {
        type: BLOCKER_TYPE.VERIFICATION_FAILED,
        message: "Verification failed",
        context: {},
        recoverable: true,
        suggestedAction: "Review output",
      };

      expect(isRetryable(blocker)).toBe(true);
    });

    it("should return true for MISSING_ENV_VAR", () => {
      const blocker = {
        type: BLOCKER_TYPE.MISSING_ENV_VAR,
        message: "Missing env var",
        context: {},
        recoverable: true,
        suggestedAction: "Set env var",
      };

      expect(isRetryable(blocker)).toBe(true);
    });

    it("should return true for AUTH_ERROR", () => {
      const blocker = {
        type: BLOCKER_TYPE.AUTH_ERROR,
        message: "Auth error",
        context: {},
        recoverable: true,
        suggestedAction: "Check credentials",
      };

      expect(isRetryable(blocker)).toBe(true);
    });

    it("should return false when not recoverable", () => {
      const blocker = {
        type: BLOCKER_TYPE.VERIFICATION_FAILED,
        message: "Fatal error",
        context: {},
        recoverable: false,
        suggestedAction: "Manual fix required",
      };

      expect(isRetryable(blocker)).toBe(false);
    });
  });

  describe("BLOCKER_TYPE", () => {
    it("should have correct blocker type values", () => {
      expect(BLOCKER_TYPE.DISCUSS_REQUIRED).toBe("discuss_required");
      expect(BLOCKER_TYPE.VERIFICATION_FAILED).toBe("verification_failed");
      expect(BLOCKER_TYPE.MISSING_ENV_VAR).toBe("missing_env_var");
      expect(BLOCKER_TYPE.AUTH_ERROR).toBe("auth_error");
      expect(BLOCKER_TYPE.MANUAL_ACTION_REQUIRED).toBe("manual_action_required");
    });
  });
});
