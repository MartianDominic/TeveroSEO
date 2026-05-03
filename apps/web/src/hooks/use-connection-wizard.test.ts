/**
 * useConnectionWizard Hook Tests
 * Phase 66-04: Connection Wizard UI
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useConnectionWizard } from "./use-connection-wizard";
import { connectApi } from "@/lib/api/connect";

// Mock the connect API
vi.mock("@/lib/api/connect", () => ({
  connectApi: {
    detect: vi.fn(),
    getGuide: vi.fn(),
    verify: vi.fn(),
    createInstallation: vi.fn(),
    sendHandoff: vi.fn(),
  },
  ConnectApiError: class extends Error {
    status: number;
    code?: string;
    constructor(message: string, status: number, code?: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));

describe("useConnectionWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("initial state", () => {
    it("starts with url step and empty values", () => {
      const { result } = renderHook(() => useConnectionWizard());

      expect(result.current.state.step).toBe("url");
      expect(result.current.state.url).toBe("");
      expect(result.current.state.detection).toBeNull();
      expect(result.current.state.guide).toBeNull();
      expect(result.current.state.siteId).toBeNull();
      expect(result.current.state.currentGuideStep).toBe(0);
    });

    it("returns correct initial computed values", () => {
      const { result } = renderHook(() => useConnectionWizard());

      expect(result.current.canProceed).toBe(false);
      expect(result.current.progress).toBe(0);
    });
  });

  describe("submitUrl", () => {
    it("transitions to detecting state on submit", async () => {
      const mockDetection = {
        platform: "shopify",
        confidence: 100,
        features: ["ecommerce"],
        paidPlanRequired: false,
        estimatedTime: "2 min",
      };

      vi.mocked(connectApi.detect).mockResolvedValueOnce(mockDetection);
      vi.mocked(connectApi.createInstallation).mockResolvedValueOnce({
        installationId: "install-1",
        siteId: "site-123",
        snippet: "<script></script>",
      });

      const { result } = renderHook(() => useConnectionWizard({ workspaceId: "ws-1" }));

      act(() => {
        result.current.submitUrl("example.myshopify.com");
      });

      expect(result.current.state.step).toBe("detecting");
      expect(result.current.state.url).toBe("example.myshopify.com");

      await waitFor(() => {
        expect(result.current.state.step).toBe("choice");
      });

      expect(result.current.state.detection).toEqual(mockDetection);
      expect(connectApi.detect).toHaveBeenCalledWith("example.myshopify.com");
    });

    it("handles detection errors gracefully", async () => {
      vi.mocked(connectApi.detect).mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useConnectionWizard());

      act(() => {
        result.current.submitUrl("test.com");
      });

      await waitFor(() => {
        expect(result.current.state.step).toBe("error");
      });

      expect(result.current.state.error).toBe("Network error");
    });

    it("creates installation after successful detection", async () => {
      const mockDetection = {
        platform: "wix",
        confidence: 95,
        features: [],
        paidPlanRequired: true,
        estimatedTime: "2 min",
      };

      vi.mocked(connectApi.detect).mockResolvedValueOnce(mockDetection);
      vi.mocked(connectApi.createInstallation).mockResolvedValueOnce({
        installationId: "install-1",
        siteId: "site-456",
        snippet: "<script></script>",
      });

      const { result } = renderHook(() => useConnectionWizard({ workspaceId: "ws-1" }));

      act(() => {
        result.current.submitUrl("mysite.wixsite.com");
      });

      await waitFor(() => {
        expect(result.current.state.siteId).toBe("site-456");
      });

      expect(connectApi.createInstallation).toHaveBeenCalledWith("ws-1", "mysite.wixsite.com");
    });
  });

  describe("selectPath", () => {
    it("transitions to diy step and fetches guide", async () => {
      const mockGuide = {
        guide: {
          platform: "shopify",
          name: "Shopify",
          steps: [{ number: 1, title: "Step 1", description: "Do this" }],
          estimatedTime: "2 min",
          difficulty: "easy" as const,
          paidPlanRequired: false,
          fallbackToGtm: true,
        },
        snippet: "<script></script>",
      };

      vi.mocked(connectApi.getGuide).mockResolvedValueOnce(mockGuide);

      const { result } = renderHook(() => useConnectionWizard());

      // Setup state to be at choice step
      act(() => {
        result.current.setState({
          step: "choice",
          url: "test.com",
          detection: {
            platform: "shopify",
            confidence: 100,
            features: [],
            paidPlanRequired: false,
            estimatedTime: "2 min",
          },
          guide: null,
          siteId: "site-123",
          currentGuideStep: 0,
          error: null,
        });
      });

      act(() => {
        result.current.selectPath("diy");
      });

      await waitFor(() => {
        expect(result.current.state.step).toBe("diy");
      });

      expect(result.current.state.guide).toEqual(mockGuide);
      expect(connectApi.getGuide).toHaveBeenCalledWith("shopify", "site-123");
    });

    it("transitions to developer step for developer path", async () => {
      const { result } = renderHook(() => useConnectionWizard());

      act(() => {
        result.current.setState({
          step: "choice",
          url: "test.com",
          detection: { platform: "wix", confidence: 95, features: [], paidPlanRequired: true, estimatedTime: "2 min" },
          guide: null,
          siteId: "site-123",
          currentGuideStep: 0,
          error: null,
        });
      });

      act(() => {
        result.current.selectPath("developer");
      });

      expect(result.current.state.step).toBe("developer");
    });

    it("transitions to oauth step for oauth path", () => {
      const { result } = renderHook(() => useConnectionWizard());

      act(() => {
        result.current.setState({
          step: "choice",
          url: "test.com",
          detection: { platform: "shopify", confidence: 100, features: [], paidPlanRequired: false, estimatedTime: "2 min" },
          guide: null,
          siteId: "site-123",
          currentGuideStep: 0,
          error: null,
        });
      });

      act(() => {
        result.current.selectPath("oauth");
      });

      expect(result.current.state.step).toBe("oauth");
    });
  });

  describe("guide navigation", () => {
    it("nextGuideStep increments currentGuideStep", () => {
      const { result } = renderHook(() => useConnectionWizard());

      act(() => {
        result.current.setState({
          step: "diy",
          url: "test.com",
          detection: null,
          guide: {
            guide: {
              platform: "shopify",
              name: "Shopify",
              steps: [
                { number: 1, title: "Step 1", description: "Do this" },
                { number: 2, title: "Step 2", description: "Do that" },
                { number: 3, title: "Step 3", description: "Done" },
              ],
              estimatedTime: "2 min",
              difficulty: "easy" as const,
              paidPlanRequired: false,
              fallbackToGtm: true,
            },
            snippet: "<script></script>",
          },
          siteId: "site-123",
          currentGuideStep: 0,
          error: null,
        });
      });

      act(() => {
        result.current.nextGuideStep();
      });

      expect(result.current.state.currentGuideStep).toBe(1);

      act(() => {
        result.current.nextGuideStep();
      });

      expect(result.current.state.currentGuideStep).toBe(2);
    });

    it("nextGuideStep transitions to verifying on last step", async () => {
      vi.mocked(connectApi.verify).mockResolvedValueOnce({
        status: "detected",
        firstPing: "2026-05-03T12:00:00Z",
        location: "San Francisco, CA",
      });

      const { result } = renderHook(() => useConnectionWizard());

      act(() => {
        result.current.setState({
          step: "diy",
          url: "test.com",
          detection: null,
          guide: {
            guide: {
              platform: "shopify",
              name: "Shopify",
              steps: [
                { number: 1, title: "Step 1", description: "Do this" },
                { number: 2, title: "Step 2", description: "Do that" },
              ],
              estimatedTime: "2 min",
              difficulty: "easy" as const,
              paidPlanRequired: false,
              fallbackToGtm: true,
            },
            snippet: "<script></script>",
          },
          siteId: "site-123",
          currentGuideStep: 1, // Last step (0-indexed)
          error: null,
        });
      });

      act(() => {
        result.current.nextGuideStep();
      });

      await waitFor(() => {
        expect(result.current.state.step).toBe("verifying");
      });
    });

    it("prevGuideStep decrements currentGuideStep", () => {
      const { result } = renderHook(() => useConnectionWizard());

      act(() => {
        result.current.setState({
          step: "diy",
          url: "test.com",
          detection: null,
          guide: {
            guide: {
              platform: "shopify",
              name: "Shopify",
              steps: [
                { number: 1, title: "Step 1", description: "Do this" },
                { number: 2, title: "Step 2", description: "Do that" },
              ],
              estimatedTime: "2 min",
              difficulty: "easy" as const,
              paidPlanRequired: false,
              fallbackToGtm: true,
            },
            snippet: "<script></script>",
          },
          siteId: "site-123",
          currentGuideStep: 1,
          error: null,
        });
      });

      act(() => {
        result.current.prevGuideStep();
      });

      expect(result.current.state.currentGuideStep).toBe(0);
    });

    it("prevGuideStep does not go below 0", () => {
      const { result } = renderHook(() => useConnectionWizard());

      act(() => {
        result.current.setState({
          step: "diy",
          url: "test.com",
          detection: null,
          guide: null,
          siteId: "site-123",
          currentGuideStep: 0,
          error: null,
        });
      });

      act(() => {
        result.current.prevGuideStep();
      });

      expect(result.current.state.currentGuideStep).toBe(0);
    });
  });

  describe("retry", () => {
    it("resets state to url step", () => {
      const { result } = renderHook(() => useConnectionWizard());

      act(() => {
        result.current.setState({
          step: "error",
          url: "test.com",
          detection: null,
          guide: null,
          siteId: null,
          currentGuideStep: 0,
          error: "Something went wrong",
        });
      });

      act(() => {
        result.current.retry();
      });

      expect(result.current.state.step).toBe("url");
      expect(result.current.state.url).toBe("");
      expect(result.current.state.error).toBeNull();
    });
  });

  describe("computed values", () => {
    it("canProceed is true when URL is valid", () => {
      const { result } = renderHook(() => useConnectionWizard());

      act(() => {
        result.current.setState({
          step: "url",
          url: "example.com",
          detection: null,
          guide: null,
          siteId: null,
          currentGuideStep: 0,
          error: null,
        });
      });

      expect(result.current.canProceed).toBe(true);
    });

    it("canProceed is false when URL is empty", () => {
      const { result } = renderHook(() => useConnectionWizard());

      expect(result.current.canProceed).toBe(false);
    });

    it("progress increases through steps", () => {
      const { result } = renderHook(() => useConnectionWizard());

      // URL step = 0%
      expect(result.current.progress).toBe(0);

      // Detection step = ~20%
      act(() => {
        result.current.setState({
          step: "detecting",
          url: "test.com",
          detection: null,
          guide: null,
          siteId: null,
          currentGuideStep: 0,
          error: null,
        });
      });
      expect(result.current.progress).toBe(20);

      // Choice step = ~40%
      act(() => {
        result.current.setState({
          step: "choice",
          url: "test.com",
          detection: { platform: "shopify", confidence: 100, features: [], paidPlanRequired: false, estimatedTime: "2 min" },
          guide: null,
          siteId: "site-1",
          currentGuideStep: 0,
          error: null,
        });
      });
      expect(result.current.progress).toBe(40);

      // DIY step = ~60%
      act(() => {
        result.current.setState({
          step: "diy",
          url: "test.com",
          detection: { platform: "shopify", confidence: 100, features: [], paidPlanRequired: false, estimatedTime: "2 min" },
          guide: null,
          siteId: "site-1",
          currentGuideStep: 0,
          error: null,
        });
      });
      expect(result.current.progress).toBe(60);

      // Success = 100%
      act(() => {
        result.current.setState({
          step: "success",
          url: "test.com",
          detection: { platform: "shopify", confidence: 100, features: [], paidPlanRequired: false, estimatedTime: "2 min" },
          guide: null,
          siteId: "site-1",
          currentGuideStep: 0,
          error: null,
        });
      });
      expect(result.current.progress).toBe(100);
    });
  });

  describe("verification", () => {
    it("transitions to success when verification detects pixel", async () => {
      // Mock immediate success on first poll
      vi.mocked(connectApi.verify).mockResolvedValue({
        status: "detected",
        firstPing: "2026-05-03T12:00:00Z",
        location: "San Francisco, CA",
      });

      const onSuccess = vi.fn();
      const { result } = renderHook(() => useConnectionWizard({ onSuccess }));

      act(() => {
        result.current.setState({
          step: "verifying",
          url: "test.com",
          detection: null,
          guide: null,
          siteId: "site-123",
          currentGuideStep: 0,
          error: null,
        });
      });

      // Start verification (immediate poll)
      act(() => {
        result.current.startVerification();
      });

      // Wait for success transition
      await waitFor(() => {
        expect(result.current.state.step).toBe("success");
      });

      expect(onSuccess).toHaveBeenCalledWith("site-123");
      expect(connectApi.verify).toHaveBeenCalledWith("site-123");
    });

    it("calls verify API with siteId", async () => {
      vi.mocked(connectApi.verify).mockResolvedValue({ status: "pending" });

      const { result } = renderHook(() => useConnectionWizard());

      act(() => {
        result.current.setState({
          step: "verifying",
          url: "test.com",
          detection: null,
          guide: null,
          siteId: "site-abc",
          currentGuideStep: 0,
          error: null,
        });
      });

      act(() => {
        result.current.startVerification();
      });

      await waitFor(() => {
        expect(connectApi.verify).toHaveBeenCalledWith("site-abc");
      });
    });
  });
});
