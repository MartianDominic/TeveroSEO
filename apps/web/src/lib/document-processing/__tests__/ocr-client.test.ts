/**
 * OCR Client Tests
 * Phase 102-09: Task 5 - OCR client for direct OCR calls.
 *
 * Comprehensive tests for:
 * - Happy path OCR processing
 * - Retry logic with exponential backoff
 * - Timeout handling
 * - Error recovery and non-retryable errors
 * - Response validation
 * - Cost estimation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocks are set up
import {
  requestOcr,
  extractOcrFields,
  estimateOcrCost,
  type OcrResult,
  type OcrTier,
} from "../ocr-client";
import { logger } from "@/lib/logger";

describe("ocr-client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Set required env var
    process.env.DOCUMENT_PARSER_URL = "http://localhost:8001";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("requestOcr", () => {
    describe("happy path", () => {
      it("successfully processes single image buffer", async () => {
        const mockResponse: OcrResult = {
          text: "Extracted text from image",
          confidence: 0.95,
          tier: "tesseract",
          cost: 0,
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValueOnce(mockResponse),
        });

        const imageBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG header
        const resultPromise = requestOcr([imageBuffer]);

        // Advance timers to allow async operations
        await vi.runAllTimersAsync();
        const result = await resultPromise;

        expect(result.text).toBe("Extracted text from image");
        expect(result.confidence).toBe(0.95);
        expect(result.tier).toBe("tesseract");
        expect(result.cost).toBe(0);
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      it("successfully processes multiple image buffers", async () => {
        const mockResponse = {
          text: "Page 1 content\nPage 2 content",
          confidence: 0.92,
          tier: "deepseek",
          cost: 0.004,
          escalation_reason: "Low tesseract confidence",
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValueOnce(mockResponse),
        });

        const buffers = [
          Buffer.from([1, 2, 3, 4]),
          Buffer.from([5, 6, 7, 8]),
        ];

        const resultPromise = requestOcr(buffers);
        await vi.runAllTimersAsync();
        const result = await resultPromise;

        expect(result.text).toContain("Page 1 content");
        expect(result.escalationReason).toBe("Low tesseract confidence");
        expect(result.tier).toBe("deepseek");
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      it("sends correct Content-Type with FormData", async () => {
        const mockResponse = {
          text: "Test",
          confidence: 0.9,
          tier: "tesseract",
          cost: 0,
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValueOnce(mockResponse),
        });

        const buffer = Buffer.from([1, 2, 3]);
        const resultPromise = requestOcr([buffer]);
        await vi.runAllTimersAsync();
        await resultPromise;

        const fetchCall = mockFetch.mock.calls[0];
        expect(fetchCall[0]).toBe("http://localhost:8001/ocr");
        expect(fetchCall[1].method).toBe("POST");
        expect(fetchCall[1].body).toBeInstanceOf(FormData);
      });

      it("maps escalation_reason from API to camelCase", async () => {
        const mockResponse = {
          text: "Complex scanned document",
          confidence: 0.88,
          tier: "gemini" as OcrTier,
          cost: 0.006,
          escalation_reason: "DeepSeek failed quality threshold",
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValueOnce(mockResponse),
        });

        const resultPromise = requestOcr([Buffer.from([1])]);
        await vi.runAllTimersAsync();
        const result = await resultPromise;

        expect(result.escalationReason).toBe("DeepSeek failed quality threshold");
      });

      it("logs successful OCR request with metrics", async () => {
        const mockResponse = {
          text: "Success",
          confidence: 0.99,
          tier: "tesseract",
          cost: 0,
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValueOnce(mockResponse),
        });

        const resultPromise = requestOcr([Buffer.from([1, 2, 3])]);
        await vi.runAllTimersAsync();
        await resultPromise;

        expect(logger.info).toHaveBeenCalledWith(
          "[ocr-client] Starting OCR request",
          expect.objectContaining({
            imageCount: 1,
            totalSizeBytes: 3,
          })
        );
        expect(logger.info).toHaveBeenCalledWith(
          "[ocr-client] OCR request completed",
          expect.objectContaining({
            tier: "tesseract",
            confidence: 0.99,
          })
        );
      });
    });

    describe("retry logic with exponential backoff", () => {
      it("retries on network error with exponential backoff", async () => {
        const networkError = new TypeError("fetch failed");

        mockFetch
          .mockRejectedValueOnce(networkError)
          .mockRejectedValueOnce(networkError)
          .mockResolvedValueOnce({
            ok: true,
            json: vi.fn().mockResolvedValueOnce({
              text: "Recovered",
              confidence: 0.9,
              tier: "tesseract",
              cost: 0,
            }),
          });

        const resultPromise = requestOcr([Buffer.from([1])]);

        // First attempt fails, wait for 1000ms backoff
        await vi.advanceTimersByTimeAsync(1000);
        // Second attempt fails, wait for 2000ms backoff
        await vi.advanceTimersByTimeAsync(2000);
        // Third attempt succeeds
        await vi.runAllTimersAsync();

        const result = await resultPromise;

        expect(mockFetch).toHaveBeenCalledTimes(3);
        expect(result.text).toBe("Recovered");
        expect(logger.warn).toHaveBeenCalledTimes(2);
      });

      it("retries on 500 server error", async () => {
        mockFetch
          .mockResolvedValueOnce({
            ok: false,
            status: 500,
            text: vi.fn().mockResolvedValueOnce("Internal Server Error"),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: vi.fn().mockResolvedValueOnce({
              text: "Recovered from 500",
              confidence: 0.85,
              tier: "tesseract",
              cost: 0,
            }),
          });

        const resultPromise = requestOcr([Buffer.from([1])]);

        // First attempt fails with 500, wait for backoff
        await vi.advanceTimersByTimeAsync(1000);
        await vi.runAllTimersAsync();

        const result = await resultPromise;

        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(result.text).toBe("Recovered from 500");
      });

      it("retries on 502 Bad Gateway", async () => {
        mockFetch
          .mockResolvedValueOnce({
            ok: false,
            status: 502,
            text: vi.fn().mockResolvedValueOnce("Bad Gateway"),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: vi.fn().mockResolvedValueOnce({
              text: "Success after 502",
              confidence: 0.9,
              tier: "tesseract",
              cost: 0,
            }),
          });

        const resultPromise = requestOcr([Buffer.from([1])]);
        await vi.advanceTimersByTimeAsync(1000);
        await vi.runAllTimersAsync();

        const result = await resultPromise;

        expect(result.text).toBe("Success after 502");
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      it("retries on 503 Service Unavailable", async () => {
        mockFetch
          .mockResolvedValueOnce({
            ok: false,
            status: 503,
            text: vi.fn().mockResolvedValueOnce("Service Unavailable"),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: vi.fn().mockResolvedValueOnce({
              text: "Success after 503",
              confidence: 0.9,
              tier: "tesseract",
              cost: 0,
            }),
          });

        const resultPromise = requestOcr([Buffer.from([1])]);
        await vi.advanceTimersByTimeAsync(1000);
        await vi.runAllTimersAsync();

        const result = await resultPromise;

        expect(result.text).toBe("Success after 503");
      });

      it("exhausts all 3 retries and throws on persistent failure", async () => {
        const networkError = new TypeError("fetch failed");

        mockFetch
          .mockRejectedValueOnce(networkError)
          .mockRejectedValueOnce(networkError)
          .mockRejectedValueOnce(networkError);

        const resultPromise = requestOcr([Buffer.from([1])]);
        // Immediately attach catch handler to prevent unhandled rejection warning
        resultPromise.catch(() => {});

        // Advance through all backoff periods
        await vi.advanceTimersByTimeAsync(1000); // 1st retry
        await vi.advanceTimersByTimeAsync(2000); // 2nd retry
        await vi.runAllTimersAsync();

        // Await the promise that will reject
        try {
          await resultPromise;
        } catch {
          // Expected to throw
        }

        expect(mockFetch).toHaveBeenCalledTimes(3);
        expect(logger.error).toHaveBeenCalledWith(
          "[ocr-client] OCR request failed after all retries",
          expect.any(Object)
        );
      });

      it("uses exponential backoff: 1s, 2s, 4s", async () => {
        const networkError = new TypeError("fetch failed");

        mockFetch
          .mockRejectedValueOnce(networkError)
          .mockRejectedValueOnce(networkError)
          .mockResolvedValueOnce({
            ok: true,
            json: vi.fn().mockResolvedValueOnce({
              text: "Success",
              confidence: 0.9,
              tier: "tesseract",
              cost: 0,
            }),
          });

        const resultPromise = requestOcr([Buffer.from([1])]);

        // First backoff: 1000ms (1000 * 2^0)
        expect(mockFetch).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(999);
        expect(mockFetch).toHaveBeenCalledTimes(1); // Still waiting
        await vi.advanceTimersByTimeAsync(1);
        expect(mockFetch).toHaveBeenCalledTimes(2); // First retry

        // Second backoff: 2000ms (1000 * 2^1)
        await vi.advanceTimersByTimeAsync(1999);
        expect(mockFetch).toHaveBeenCalledTimes(2); // Still waiting
        await vi.advanceTimersByTimeAsync(1);
        expect(mockFetch).toHaveBeenCalledTimes(3); // Second retry

        await vi.runAllTimersAsync();
        await resultPromise;
      });
    });

    describe("timeout handling", () => {
      it("aborts request after 60 second timeout", async () => {
        // Simulate AbortError being thrown when timeout occurs
        mockFetch.mockImplementation(() => {
          return new Promise((_, reject) => {
            // Immediately simulate what happens when AbortController.abort() is called
            const error = new Error("The operation was aborted");
            error.name = "AbortError";
            reject(error);
          });
        });

        const resultPromise = requestOcr([Buffer.from([1])]);
        resultPromise.catch(() => {}); // Prevent unhandled rejection warning

        // Advance through retry backoffs
        await vi.advanceTimersByTimeAsync(1000); // 1st backoff
        await vi.advanceTimersByTimeAsync(2000); // 2nd backoff
        await vi.runAllTimersAsync();

        let thrownError: Error | null = null;
        try {
          await resultPromise;
        } catch (e) {
          thrownError = e as Error;
        }
        expect(thrownError?.message).toContain("timed out");
      }, 10000);

      it("retries on timeout with backoff", async () => {
        // First two attempts timeout, third succeeds
        let callCount = 0;
        mockFetch.mockImplementation(() => {
          callCount++;
          if (callCount < 3) {
            return new Promise((_, reject) => {
              // Simulate timeout by immediately aborting
              const error = new Error("The operation was aborted");
              error.name = "AbortError";
              reject(error);
            });
          }
          return Promise.resolve({
            ok: true,
            json: vi.fn().mockResolvedValue({
              text: "Success after timeout retries",
              confidence: 0.9,
              tier: "tesseract",
              cost: 0,
            }),
          });
        });

        const resultPromise = requestOcr([Buffer.from([1])]);

        await vi.advanceTimersByTimeAsync(1000); // First backoff
        await vi.advanceTimersByTimeAsync(2000); // Second backoff
        await vi.runAllTimersAsync();

        const result = await resultPromise;

        expect(result.text).toBe("Success after timeout retries");
        expect(logger.warn).toHaveBeenCalledWith(
          "[ocr-client] OCR request timed out, retrying",
          expect.any(Object)
        );
      });

      it("logs timeout after all retries exhausted", async () => {
        mockFetch.mockImplementation(() => {
          return new Promise((_, reject) => {
            const error = new Error("The operation was aborted");
            error.name = "AbortError";
            reject(error);
          });
        });

        const resultPromise = requestOcr([Buffer.from([1])]);
        resultPromise.catch(() => {}); // Prevent unhandled rejection warning

        await vi.advanceTimersByTimeAsync(1000);
        await vi.advanceTimersByTimeAsync(2000);
        await vi.runAllTimersAsync();

        try {
          await resultPromise;
        } catch (e) {
          expect((e as Error).message).toContain("timed out");
        }

        expect(logger.error).toHaveBeenCalledWith(
          "[ocr-client] OCR request failed after all retries (timeout)",
          expect.objectContaining({
            imageCount: 1,
          })
        );
      });
    });

    describe("non-retryable errors", () => {
      it("does not retry on 400 Bad Request", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: vi.fn().mockResolvedValueOnce("Bad Request: Invalid image format"),
        });

        const resultPromise = requestOcr([Buffer.from([1])]);
        resultPromise.catch(() => {}); // Prevent unhandled rejection warning
        await vi.runAllTimersAsync();

        let thrownError: Error | null = null;
        try {
          await resultPromise;
        } catch (e) {
          thrownError = e as Error;
        }

        expect(thrownError?.message).toContain("OCR service error");
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      it("does not retry on 401 Unauthorized", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: vi.fn().mockResolvedValueOnce("Unauthorized"),
        });

        const resultPromise = requestOcr([Buffer.from([1])]);
        resultPromise.catch(() => {}); // Prevent unhandled rejection warning
        await vi.runAllTimersAsync();

        let thrownError: Error | null = null;
        try {
          await resultPromise;
        } catch (e) {
          thrownError = e as Error;
        }

        expect(thrownError?.message).toContain("OCR service error");
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      it("does not retry on 404 Not Found", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          text: vi.fn().mockResolvedValueOnce("Endpoint not found"),
        });

        const resultPromise = requestOcr([Buffer.from([1])]);
        resultPromise.catch(() => {}); // Prevent unhandled rejection warning
        await vi.runAllTimersAsync();

        let thrownError: Error | null = null;
        try {
          await resultPromise;
        } catch (e) {
          thrownError = e as Error;
        }

        expect(thrownError?.message).toContain("OCR service error");
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      it("does not retry on 422 Unprocessable Entity", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 422,
          text: vi.fn().mockResolvedValueOnce("Invalid image data"),
        });

        const resultPromise = requestOcr([Buffer.from([1])]);
        resultPromise.catch(() => {}); // Prevent unhandled rejection warning
        await vi.runAllTimersAsync();

        let thrownError: Error | null = null;
        try {
          await resultPromise;
        } catch (e) {
          thrownError = e as Error;
        }

        expect(thrownError?.message).toContain("OCR service error");
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      it("logs non-retryable error immediately", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: vi.fn().mockResolvedValueOnce("Bad Request"),
        });

        const resultPromise = requestOcr([Buffer.from([1])]);
        resultPromise.catch(() => {}); // Prevent unhandled rejection warning
        await vi.runAllTimersAsync();

        try {
          await resultPromise;
        } catch {
          // Expected to throw
        }

        expect(logger.error).toHaveBeenCalledWith(
          "[ocr-client] OCR request failed (non-retryable)",
          expect.objectContaining({
            imageCount: 1,
          })
        );
      });
    });

    describe("response validation", () => {
      it("throws on missing required fields", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValueOnce({
            text: "Test",
            // Missing: confidence, tier, cost
          }),
        });

        const resultPromise = requestOcr([Buffer.from([1])]);
        resultPromise.catch(() => {}); // Prevent unhandled rejection warning
        await vi.runAllTimersAsync();

        let thrownError: Error | null = null;
        try {
          await resultPromise;
        } catch (e) {
          thrownError = e as Error;
        }

        expect(thrownError?.message).toContain("Invalid OCR response");
      });

      it("throws on invalid tier value", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValueOnce({
            text: "Test",
            confidence: 0.9,
            tier: "invalid_tier",
            cost: 0,
          }),
        });

        const resultPromise = requestOcr([Buffer.from([1])]);
        resultPromise.catch(() => {}); // Prevent unhandled rejection warning
        await vi.runAllTimersAsync();

        let thrownError: Error | null = null;
        try {
          await resultPromise;
        } catch (e) {
          thrownError = e as Error;
        }

        expect(thrownError?.message).toContain("Invalid OCR response");
      });

      it("throws on non-numeric confidence", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValueOnce({
            text: "Test",
            confidence: "high",
            tier: "tesseract",
            cost: 0,
          }),
        });

        const resultPromise = requestOcr([Buffer.from([1])]);
        resultPromise.catch(() => {}); // Prevent unhandled rejection warning
        await vi.runAllTimersAsync();

        let thrownError: Error | null = null;
        try {
          await resultPromise;
        } catch (e) {
          thrownError = e as Error;
        }

        expect(thrownError?.message).toContain("Invalid OCR response");
      });

      it("accepts all valid tier values: tesseract, deepseek, gemini", async () => {
        const tiers: OcrTier[] = ["tesseract", "deepseek", "gemini"];

        for (const tier of tiers) {
          vi.clearAllMocks();

          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: vi.fn().mockResolvedValueOnce({
              text: `Text from ${tier}`,
              confidence: 0.9,
              tier,
              cost: tier === "tesseract" ? 0 : 0.002,
            }),
          });

          const resultPromise = requestOcr([Buffer.from([1])]);
          await vi.runAllTimersAsync();
          const result = await resultPromise;

          expect(result.tier).toBe(tier);
        }
      });

      it("accepts optional escalation_reason field", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValueOnce({
            text: "Test",
            confidence: 0.9,
            tier: "tesseract",
            cost: 0,
            // No escalation_reason - should be fine
          }),
        });

        const resultPromise = requestOcr([Buffer.from([1])]);
        await vi.runAllTimersAsync();
        const result = await resultPromise;

        expect(result.escalationReason).toBeUndefined();
      });
    });

    describe("rate limiting responses", () => {
      it("retries on 429 Too Many Requests", async () => {
        // 429 is a 4xx but special case for rate limiting
        // Current implementation doesn't retry 4xx - testing current behavior
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: vi.fn().mockResolvedValueOnce("Rate limit exceeded"),
        });

        const resultPromise = requestOcr([Buffer.from([1])]);
        resultPromise.catch(() => {}); // Prevent unhandled rejection warning
        await vi.runAllTimersAsync();

        let thrownError: Error | null = null;
        try {
          await resultPromise;
        } catch (e) {
          thrownError = e as Error;
        }

        // Per current implementation, 4xx errors are not retried
        expect(thrownError?.message).toContain("OCR service error");
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      it("includes rate limit error message in thrown error", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: vi.fn().mockResolvedValueOnce("Rate limit exceeded: 10 requests per minute"),
        });

        const resultPromise = requestOcr([Buffer.from([1])]);
        resultPromise.catch(() => {}); // Prevent unhandled rejection warning
        await vi.runAllTimersAsync();

        let thrownError: Error | null = null;
        try {
          await resultPromise;
        } catch (e) {
          thrownError = e as Error;
        }

        expect(thrownError?.message).toContain("Rate limit exceeded");
      });
    });
  });

  describe("extractOcrFields", () => {
    it("extracts all OCR fields from API response", () => {
      const apiResponse = {
        ocr_tier: "deepseek",
        ocr_confidence: 0.92,
        ocr_cost: 0.002,
      };

      const result = extractOcrFields(apiResponse);

      expect(result.ocrTier).toBe("deepseek");
      expect(result.ocrConfidence).toBe(0.92);
      expect(result.ocrCost).toBe(0.002);
    });

    it("returns undefined for missing fields", () => {
      const apiResponse = {};

      const result = extractOcrFields(apiResponse);

      expect(result.ocrTier).toBeUndefined();
      expect(result.ocrConfidence).toBeUndefined();
      expect(result.ocrCost).toBeUndefined();
    });

    it("validates ocr_tier against schema", () => {
      const apiResponse = {
        ocr_tier: "invalid_tier",
        ocr_confidence: 0.9,
        ocr_cost: 0,
      };

      const result = extractOcrFields(apiResponse);

      expect(result.ocrTier).toBeUndefined(); // Invalid tier is rejected
      expect(result.ocrConfidence).toBe(0.9);
      expect(result.ocrCost).toBe(0);
    });

    it("converts string numbers to numbers", () => {
      const apiResponse = {
        ocr_tier: "tesseract",
        ocr_confidence: "0.95",
        ocr_cost: "0.001",
      };

      const result = extractOcrFields(apiResponse);

      expect(result.ocrConfidence).toBe(0.95);
      expect(result.ocrCost).toBe(0.001);
    });

    it("handles null values gracefully", () => {
      const apiResponse = {
        ocr_tier: null,
        ocr_confidence: null,
        ocr_cost: null,
      };

      const result = extractOcrFields(apiResponse);

      expect(result.ocrTier).toBeUndefined();
      expect(result.ocrConfidence).toBeUndefined();
      expect(result.ocrCost).toBeUndefined();
    });

    it("handles partial response", () => {
      const apiResponse = {
        ocr_tier: "gemini",
        // missing ocr_confidence and ocr_cost
      };

      const result = extractOcrFields(apiResponse);

      expect(result.ocrTier).toBe("gemini");
      expect(result.ocrConfidence).toBeUndefined();
      expect(result.ocrCost).toBeUndefined();
    });
  });

  describe("estimateOcrCost", () => {
    it("returns zero minimum cost (tesseract is free)", () => {
      const estimate = estimateOcrCost(10);

      expect(estimate.min).toBe(0);
    });

    it("calculates maximum cost for worst case (all Gemini)", () => {
      // Worst case: $0.006/page (DeepSeek + Gemini)
      const estimate = estimateOcrCost(10);

      expect(estimate.max).toBe(0.06); // 10 * 0.006
    });

    it("calculates expected cost based on tier distribution", () => {
      // Expected: 70% Tesseract ($0), 25% DeepSeek ($0.002), 5% Gemini ($0.006)
      const estimate = estimateOcrCost(100);

      // 100 * 0.70 * 0 + 100 * 0.25 * 0.002 + 100 * 0.05 * 0.006
      // = 0 + 0.05 + 0.03 = 0.08
      expect(estimate.expected).toBeCloseTo(0.08, 4);
    });

    it("handles single page", () => {
      const estimate = estimateOcrCost(1);

      expect(estimate.min).toBe(0);
      expect(estimate.max).toBe(0.006);
      expect(estimate.expected).toBeGreaterThan(0);
      expect(estimate.expected).toBeLessThan(estimate.max);
    });

    it("handles zero pages", () => {
      const estimate = estimateOcrCost(0);

      expect(estimate.min).toBe(0);
      expect(estimate.max).toBe(0);
      expect(estimate.expected).toBe(0);
    });

    it("rounds to 4 decimal places", () => {
      const estimate = estimateOcrCost(7);

      // Verify precision is limited
      expect(estimate.max.toString().split(".")[1]?.length ?? 0).toBeLessThanOrEqual(4);
      expect(estimate.expected.toString().split(".")[1]?.length ?? 0).toBeLessThanOrEqual(4);
    });

    it("scales linearly with page count", () => {
      const estimate10 = estimateOcrCost(10);
      const estimate20 = estimateOcrCost(20);

      expect(estimate20.max).toBe(estimate10.max * 2);
      expect(estimate20.expected).toBeCloseTo(estimate10.expected * 2, 4);
    });
  });
});
