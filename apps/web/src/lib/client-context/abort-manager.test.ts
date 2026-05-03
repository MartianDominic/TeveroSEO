/**
 * Tests for AbortManager.
 * Phase 68-02: Client Context Security
 */
import { describe, it, expect, beforeEach } from "vitest";
import { abortManager, isAbortError } from "./abort-manager";

describe("AbortManager", () => {
  beforeEach(() => {
    abortManager._reset();
  });

  describe("getController", () => {
    it("creates new controller for unknown client", () => {
      const controller = abortManager.getController("client-1");
      expect(controller).toBeInstanceOf(AbortController);
      expect(controller.signal.aborted).toBe(false);
    });

    it("returns same controller for same client", () => {
      const controller1 = abortManager.getController("client-1");
      const controller2 = abortManager.getController("client-1");
      expect(controller1).toBe(controller2);
    });

    it("returns different controllers for different clients", () => {
      const controller1 = abortManager.getController("client-1");
      const controller2 = abortManager.getController("client-2");
      expect(controller1).not.toBe(controller2);
    });
  });

  describe("getSignal", () => {
    it("returns signal for client controller", () => {
      const signal = abortManager.getSignal("client-1");
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(signal.aborted).toBe(false);
    });
  });

  describe("abortClient", () => {
    it("aborts the controller for the client", () => {
      const controller = abortManager.getController("client-1");
      expect(controller.signal.aborted).toBe(false);

      abortManager.abortClient("client-1");
      expect(controller.signal.aborted).toBe(true);
    });

    it("removes the controller from the map", () => {
      abortManager.getController("client-1");
      expect(abortManager.hasActiveController("client-1")).toBe(true);

      abortManager.abortClient("client-1");
      expect(abortManager.hasActiveController("client-1")).toBe(false);
    });

    it("does nothing for unknown client", () => {
      expect(() => abortManager.abortClient("unknown")).not.toThrow();
    });

    it("creates new controller after abort", () => {
      const controller1 = abortManager.getController("client-1");
      abortManager.abortClient("client-1");

      const controller2 = abortManager.getController("client-1");
      expect(controller2).not.toBe(controller1);
      expect(controller2.signal.aborted).toBe(false);
    });
  });

  describe("abortAll", () => {
    it("aborts all controllers", () => {
      const controller1 = abortManager.getController("client-1");
      const controller2 = abortManager.getController("client-2");

      abortManager.abortAll();

      expect(controller1.signal.aborted).toBe(true);
      expect(controller2.signal.aborted).toBe(true);
    });

    it("clears all controllers", () => {
      abortManager.getController("client-1");
      abortManager.getController("client-2");
      expect(abortManager.getActiveCount()).toBe(2);

      abortManager.abortAll();
      expect(abortManager.getActiveCount()).toBe(0);
    });
  });

  describe("hasActiveController", () => {
    it("returns false for unknown client", () => {
      expect(abortManager.hasActiveController("unknown")).toBe(false);
    });

    it("returns true for active controller", () => {
      abortManager.getController("client-1");
      expect(abortManager.hasActiveController("client-1")).toBe(true);
    });

    it("returns false for aborted controller", () => {
      abortManager.getController("client-1");
      abortManager.abortClient("client-1");
      expect(abortManager.hasActiveController("client-1")).toBe(false);
    });
  });

  describe("getActiveCount", () => {
    it("returns 0 when no controllers", () => {
      expect(abortManager.getActiveCount()).toBe(0);
    });

    it("counts active controllers", () => {
      abortManager.getController("client-1");
      abortManager.getController("client-2");
      expect(abortManager.getActiveCount()).toBe(2);
    });

    it("excludes aborted controllers from count", () => {
      abortManager.getController("client-1");
      abortManager.getController("client-2");
      abortManager.abortClient("client-1");
      // After abort, controller is removed from map
      expect(abortManager.getActiveCount()).toBe(1);
    });
  });
});

describe("isAbortError", () => {
  it("returns true for AbortError", () => {
    const error = new DOMException("The operation was aborted", "AbortError");
    expect(isAbortError(error)).toBe(true);
  });

  it("returns true for error with aborted message", () => {
    const error = new Error("Request was aborted");
    expect(isAbortError(error)).toBe(true);
  });

  it("returns false for other errors", () => {
    const error = new Error("Network error");
    expect(isAbortError(error)).toBe(false);
  });

  it("returns false for non-errors", () => {
    expect(isAbortError("error")).toBe(false);
    expect(isAbortError(null)).toBe(false);
    expect(isAbortError(undefined)).toBe(false);
  });
});
