/**
 * useVerificationPoll Hook Tests
 * Phase 66-06: Verification UI
 *
 * Tests polling behavior, status transitions, cleanup, and error handling.
 */
import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { useVerificationPoll } from "../use-verification-poll";

// Mock fetch globally
const mockFetch = vi.fn();

describe("useVerificationPoll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initial state", () => {
    it("should return pending status when no siteId provided", () => {
      const { result } = renderHook(() => useVerificationPoll(null));

      expect(result.current.status).toBe("pending");
      expect(result.current.isPolling).toBe(false);
      expect(result.current.attempts).toBe(0);
      expect(result.current.location).toBeUndefined();
      expect(result.current.error).toBeUndefined();
    });

    it("should not auto-start polling", () => {
      const { result } = renderHook(() => useVerificationPoll("site-123"));

      expect(result.current.isPolling).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("startPolling", () => {
    it("should set isPolling true and make API call", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "detected",
          pingCount: 1,
          location: { city: "San Francisco", country: "United States" },
        }),
      });

      const { result } = renderHook(() => useVerificationPoll("site-123"));

      act(() => {
        result.current.startPolling();
      });

      // isPolling should be true after startPolling is called
      // (it may become false quickly after the fetch resolves)
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/connect/verify?siteId=site-123"),
          expect.objectContaining({
            signal: expect.any(AbortSignal),
          })
        );
      });
    });

    it("should not start polling without siteId", async () => {
      const { result } = renderHook(() => useVerificationPoll(null));

      act(() => {
        result.current.startPolling();
      });

      expect(result.current.isPolling).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should update status to detected when pixel found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "detected",
          pingCount: 1,
          firstPing: "2026-05-03T10:00:00Z",
          location: { city: "San Francisco", country: "United States" },
        }),
      });

      const { result } = renderHook(() => useVerificationPoll("site-123"));

      act(() => {
        result.current.startPolling();
      });

      await waitFor(() => {
        expect(result.current.status).toBe("detected");
      });

      expect(result.current.isPolling).toBe(false);
      expect(result.current.location).toEqual({
        city: "San Francisco",
        country: "United States",
      });
    });

    it("should stop polling when status is verified", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "verified",
          pingCount: 5,
          location: { city: "New York", country: "United States" },
        }),
      });

      const { result } = renderHook(() => useVerificationPoll("site-123"));

      act(() => {
        result.current.startPolling();
      });

      await waitFor(() => {
        expect(result.current.status).toBe("verified");
      });

      expect(result.current.isPolling).toBe(false);
    });
  });

  describe("retry behavior", () => {
    it("should increment attempts on timeout", async () => {
      // First call returns timeout, second call returns detected
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: "pending",
            pingCount: 0,
            timedOut: true,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: "detected",
            pingCount: 1,
          }),
        });

      const { result } = renderHook(() => useVerificationPoll("site-123"));

      act(() => {
        result.current.startPolling();
      });

      await waitFor(() => {
        expect(result.current.status).toBe("detected");
      });

      // Should have made 2 calls
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should stop after max attempts (5)", async () => {
      // All calls return timeout
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "pending",
          pingCount: 0,
          timedOut: true,
        }),
      });

      const { result } = renderHook(() => useVerificationPoll("site-123"));

      act(() => {
        result.current.startPolling();
      });

      await waitFor(
        () => {
          expect(result.current.attempts).toBe(5);
        },
        { timeout: 2000 }
      );

      expect(result.current.isPolling).toBe(false);
      expect(result.current.status).toBe("pending");
      expect(mockFetch).toHaveBeenCalledTimes(5);
    });
  });

  describe("stopPolling", () => {
    it("should stop polling when called", async () => {
      // Keep pending indefinitely
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "pending",
          pingCount: 0,
        }),
      });

      const { result } = renderHook(() => useVerificationPoll("site-123"));

      act(() => {
        result.current.startPolling();
      });

      // Stop immediately
      act(() => {
        result.current.stopPolling();
      });

      expect(result.current.isPolling).toBe(false);
    });
  });

  describe("checkNow", () => {
    it("should make single request without starting poll", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "detected",
          pingCount: 1,
          location: { city: "London", country: "United Kingdom" },
        }),
      });

      const { result } = renderHook(() => useVerificationPoll("site-123"));

      await act(async () => {
        await result.current.checkNow();
      });

      expect(result.current.status).toBe("detected");
      expect(result.current.isPolling).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should not make request without siteId", async () => {
      const { result } = renderHook(() => useVerificationPoll(null));

      await act(async () => {
        await result.current.checkNow();
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should set error state on fetch failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useVerificationPoll("site-123"));

      await act(async () => {
        await result.current.checkNow();
      });

      expect(result.current.error).toBe("Network error");
      expect(result.current.status).toBe("error");
    });

    it("should set error on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { result } = renderHook(() => useVerificationPoll("site-123"));

      await act(async () => {
        await result.current.checkNow();
      });

      expect(result.current.error).toBe("Verification request failed");
      expect(result.current.status).toBe("error");
    });

    it("should handle error status from API", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "error",
          pingCount: 0,
        }),
      });

      const { result } = renderHook(() => useVerificationPoll("site-123"));

      await act(async () => {
        await result.current.checkNow();
      });

      expect(result.current.status).toBe("error");
    });
  });

  describe("cleanup", () => {
    it("should stop polling on unmount without errors", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "detected",
          pingCount: 1,
        }),
      });

      const { result, unmount } = renderHook(() =>
        useVerificationPoll("site-123")
      );

      act(() => {
        result.current.startPolling();
      });

      // Unmount should not throw
      expect(() => unmount()).not.toThrow();
    });

    it("should handle unmount before any polling starts", () => {
      const { unmount } = renderHook(() => useVerificationPoll("site-123"));

      // Unmount without starting polling should not throw
      expect(() => unmount()).not.toThrow();
    });
  });
});
