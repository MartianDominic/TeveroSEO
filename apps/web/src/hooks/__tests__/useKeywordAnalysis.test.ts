/**
 * useKeywordAnalysis Hook Tests
 * Phase 82: Chat Integration - TDD RED phase
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { useKeywordAnalysis } from "../useKeywordAnalysis";

// Mock fetch for SSE testing
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("useKeywordAnalysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should initialize with idle state", () => {
    const { result } = renderHook(() => useKeywordAnalysis());

    expect(result.current.stage).toBe("idle");
    expect(result.current.progress).toBe(0);
    expect(result.current.result).toBeNull();
    expect(result.current.partials).toEqual([]);
    expect(result.current.error).toBeUndefined();
    expect(result.current.isAnalyzing).toBe(false);
  });

  it("should have analyze, reset, and disconnect functions", () => {
    const { result } = renderHook(() => useKeywordAnalysis());

    expect(typeof result.current.analyze).toBe("function");
    expect(typeof result.current.reset).toBe("function");
    expect(typeof result.current.disconnect).toBe("function");
  });

  it("should set isAnalyzing to true when analyze is called", async () => {
    // Mock a never-resolving stream to keep isAnalyzing true
    const neverResolve = new Promise<Response>(() => {});
    mockFetch.mockReturnValue(neverResolve);

    const { result } = renderHook(() => useKeywordAnalysis());

    act(() => {
      result.current.analyze("client-1", "conversation text", ["keyword1", "keyword2"]);
    });

    // Should immediately set to analyzing
    expect(result.current.isAnalyzing).toBe(true);
    expect(result.current.stage).toBe("extracting_constraints");
  });

  it("should update stage on progress events", async () => {
    // Create a mock readable stream
    const progressEvent = JSON.stringify({
      type: "progress",
      stage: "classifying_funnel",
      progress: 25,
      message: "Classifying funnel stages",
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${progressEvent}\n\n`));
        // Don't close - keep stream open
      },
    });

    mockFetch.mockResolvedValue({
      ok: true,
      body: stream,
    } as Response);

    const { result } = renderHook(() => useKeywordAnalysis());

    await act(async () => {
      result.current.analyze("client-1", "conversation", ["kw1"]);
      // Wait for stream processing
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.stage).toBe("classifying_funnel");
    expect(result.current.progress).toBe(25);
    expect(result.current.message).toBe("Classifying funnel stages");
  });

  it("should accumulate partial events", async () => {
    const partialEvent = JSON.stringify({
      type: "partial",
      data: { funnelBreakdown: { bofu: 10, mofu: 20, tofu: 30 } },
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${partialEvent}\n\n`));
      },
    });

    mockFetch.mockResolvedValue({
      ok: true,
      body: stream,
    } as Response);

    const { result } = renderHook(() => useKeywordAnalysis());

    await act(async () => {
      result.current.analyze("client-1", "conversation", ["kw1"]);
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.partials.length).toBeGreaterThan(0);
    expect(result.current.partials[0]).toHaveProperty("funnelBreakdown");
  });

  it("should call onComplete callback on complete event", async () => {
    const mockResult = {
      sessionId: "session-1",
      constraints: { businessType: "service" },
      stats: { totalKeywords: 10 },
    };

    const completeEvent = JSON.stringify({
      type: "complete",
      data: mockResult,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${completeEvent}\n\n`));
        controller.close();
      },
    });

    mockFetch.mockResolvedValue({
      ok: true,
      body: stream,
    } as Response);

    const onComplete = vi.fn();
    const { result } = renderHook(() => useKeywordAnalysis({ onComplete }));

    await act(async () => {
      result.current.analyze("client-1", "conversation", ["kw1"]);
      await new Promise((r) => setTimeout(r, 50));
    });

    await waitFor(() => {
      expect(result.current.stage).toBe("complete");
      expect(result.current.result).not.toBeNull();
      expect(result.current.isAnalyzing).toBe(false);
      expect(onComplete).toHaveBeenCalled();
    });
  });

  it("should call onError callback on error event", async () => {
    const errorEvent = JSON.stringify({
      type: "error",
      message: "Analysis failed",
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${errorEvent}\n\n`));
        controller.close();
      },
    });

    mockFetch.mockResolvedValue({
      ok: true,
      body: stream,
    } as Response);

    const onError = vi.fn();
    const { result } = renderHook(() => useKeywordAnalysis({ onError }));

    await act(async () => {
      result.current.analyze("client-1", "conversation", ["kw1"]);
      await new Promise((r) => setTimeout(r, 50));
    });

    await waitFor(() => {
      expect(result.current.error).toBe("Analysis failed");
      expect(result.current.isAnalyzing).toBe(false);
      expect(onError).toHaveBeenCalledWith("Analysis failed");
    });
  });

  it("should handle HTTP errors gracefully", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    } as unknown as Response);

    const onError = vi.fn();
    const { result } = renderHook(() => useKeywordAnalysis({ onError }));

    await act(async () => {
      result.current.analyze("client-1", "conversation", ["kw1"]);
      await new Promise((r) => setTimeout(r, 50));
    });

    await waitFor(() => {
      expect(result.current.error).toBe("Unauthorized");
      expect(result.current.isAnalyzing).toBe(false);
      expect(onError).toHaveBeenCalled();
    });
  });

  it("should reset state when reset is called", async () => {
    const completeEvent = JSON.stringify({
      type: "complete",
      data: { sessionId: "s1", stats: {} },
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${completeEvent}\n\n`));
        controller.close();
      },
    });

    mockFetch.mockResolvedValue({
      ok: true,
      body: stream,
    } as Response);

    const { result } = renderHook(() => useKeywordAnalysis());

    await act(async () => {
      result.current.analyze("client-1", "conversation", ["kw1"]);
      await new Promise((r) => setTimeout(r, 50));
    });

    await waitFor(() => {
      expect(result.current.stage).toBe("complete");
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.stage).toBe("idle");
    expect(result.current.progress).toBe(0);
    expect(result.current.result).toBeNull();
    expect(result.current.partials).toEqual([]);
    expect(result.current.isAnalyzing).toBe(false);
  });
});
