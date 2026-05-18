/**
 * AI Generator Service Tests
 * Phase 102-03: AI content generation
 *
 * TDD tests for the AI content generation service.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock the Google AI SDK
vi.mock("@ai-sdk/google", () => ({
  google: vi.fn(() => ({
    name: "gemini-1.5-pro",
  })),
}));

vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

import { generateText } from "ai";

import {
  generateBlockContent,
  buildPrompt,
  classifyError,
  calculateRetryDelay,
  type GenerationRequest,
} from "../ai-generator";

const mockGenerateText = generateText as ReturnType<typeof vi.fn>;

describe("ai-generator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("generateBlockContent", () => {
    it("accepts GenerationRequest and returns content string", async () => {
      const request: GenerationRequest = {
        blockType: "pain_amplifier",
        intent: "create",
        prospect: {
          id: "prospect-1",
          domain: "example.com",
          niche: "e-commerce",
          painPoints: ["low traffic", "poor rankings"],
        },
        language: "lt",
      };

      mockGenerateText.mockResolvedValueOnce({
        text: "Jūsų dabartinė SEO strategija kainuoja jums €5,000 per mėnesį...",
      });

      const result = await generateBlockContent(request);

      expect(typeof result.content).toBe("string");
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it("calls generateText with gemini-1.5-pro model", async () => {
      const request: GenerationRequest = {
        blockType: "credibility",
        intent: "create",
        prospect: {
          id: "prospect-1",
          domain: "test.lt",
        },
        language: "lt",
      };

      mockGenerateText.mockResolvedValueOnce({
        text: "Per pastaruosius 5 metus padėjome...",
      });

      await generateBlockContent(request);

      expect(mockGenerateText).toHaveBeenCalledTimes(1);
      const callArgs = mockGenerateText.mock.calls[0][0];
      expect(callArgs.model.name).toBe("gemini-1.5-pro");
    });

    it("returns fallback message on API failure", async () => {
      const request: GenerationRequest = {
        blockType: "cta",
        intent: "create",
        prospect: { id: "prospect-1" },
        language: "en",
      };

      // Use non-retryable error (400) to avoid retry delays
      const validationError = new Error("Invalid request");
      (validationError as Error & { status: number }).status = 400;
      mockGenerateText.mockRejectedValueOnce(validationError);

      const result = await generateBlockContent(request);

      expect(result.content).toContain("Unable to generate content");
      expect(result.confidence).toBe(0);
    });

    it("handles timeout scenario gracefully", async () => {
      const request: GenerationRequest = {
        blockType: "credibility",
        intent: "create",
        prospect: { id: "prospect-1" },
        language: "en",
      };

      // Simulate AbortError from timeout - fail all retries
      const abortError = new Error("This operation was aborted");
      abortError.name = "AbortError";
      mockGenerateText
        .mockRejectedValueOnce(abortError)
        .mockRejectedValueOnce(abortError)
        .mockRejectedValueOnce(abortError)
        .mockRejectedValueOnce(abortError);

      const resultPromise = generateBlockContent(request);

      // Advance through all retry delays
      await vi.advanceTimersByTimeAsync(10000);

      const result = await resultPromise;

      // User-friendly message for timeout errors (M-ERR-03)
      expect(result.content).toContain("taking longer than expected");
      expect(result.confidence).toBe(0);
    });

    it("handles rate limit (429) response", async () => {
      const request: GenerationRequest = {
        blockType: "pain_amplifier",
        intent: "create",
        prospect: { id: "prospect-1" },
        language: "lt",
      };

      // Simulate 429 rate limit error - fail all retries
      const rateLimitError = new Error("Rate limit exceeded");
      (rateLimitError as Error & { status: number }).status = 429;
      mockGenerateText
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError);

      const resultPromise = generateBlockContent(request);

      // Advance through all retry delays
      await vi.advanceTimersByTimeAsync(10000);

      const result = await resultPromise;

      // User-friendly message for rate limit errors (M-ERR-03)
      expect(result.content).toContain("AI service is currently busy");
      expect(result.confidence).toBe(0);
      expect(result.usage).toBeUndefined();
      expect(result.cost).toBeUndefined();
    });

    it("tracks token usage and calculates cost", async () => {
      const request: GenerationRequest = {
        blockType: "offer_stack",
        intent: "create",
        prospect: { id: "prospect-1", domain: "shop.lt" },
        language: "lt",
      };

      mockGenerateText.mockResolvedValueOnce({
        text: "Paketas apima pilną SEO auditą...",
        usage: {
          inputTokens: 500,
          outputTokens: 150,
          totalTokens: 650,
        },
      });

      const result = await generateBlockContent(request);

      // Verify usage is tracked
      expect(result.usage).toBeDefined();
      expect(result.usage?.promptTokens).toBe(500);
      expect(result.usage?.completionTokens).toBe(150);
      expect(result.usage?.totalTokens).toBe(650);

      // Verify cost calculation: 650 tokens * $1.25/1M = $0.0008125
      expect(result.cost).toBeDefined();
      expect(result.cost).toBeCloseTo(0.0008125, 6);
    });

    it("handles missing usage data gracefully", async () => {
      const request: GenerationRequest = {
        blockType: "cta",
        intent: "create",
        prospect: { id: "prospect-1" },
        language: "en",
      };

      // Response without usage data
      mockGenerateText.mockResolvedValueOnce({
        text: "Contact us today for a free consultation!",
      });

      const result = await generateBlockContent(request);

      expect(result.content).toBe("Contact us today for a free consultation!");
      expect(result.usage).toBeDefined();
      expect(result.usage?.promptTokens).toBe(0);
      expect(result.usage?.completionTokens).toBe(0);
      expect(result.usage?.totalTokens).toBe(0);
      expect(result.cost).toBe(0);
    });

    it("handles network errors", async () => {
      const request: GenerationRequest = {
        blockType: "social_proof",
        intent: "create",
        prospect: { id: "prospect-1" },
        language: "en",
      };

      // Simulate network error
      const networkError = new Error("Network request failed");
      networkError.name = "FetchError";
      mockGenerateText.mockRejectedValueOnce(networkError);

      const result = await generateBlockContent(request);

      expect(result.content).toContain("Unable to generate content");
      expect(result.confidence).toBe(0);
    });

    it("handles service unavailable errors", async () => {
      const request: GenerationRequest = {
        blockType: "urgency",
        intent: "create",
        prospect: { id: "prospect-1" },
        language: "lt",
      };

      // Simulate 503 Service Unavailable - fail all retries
      const serviceError = new Error("Service temporarily unavailable");
      (serviceError as Error & { status: number }).status = 503;
      mockGenerateText
        .mockRejectedValueOnce(serviceError)
        .mockRejectedValueOnce(serviceError)
        .mockRejectedValueOnce(serviceError)
        .mockRejectedValueOnce(serviceError);

      const resultPromise = generateBlockContent(request);

      // Advance through all retry delays
      await vi.advanceTimersByTimeAsync(10000);

      const result = await resultPromise;

      // User-friendly message for service unavailable errors (M-ERR-03)
      expect(result.content).toContain("AI service is temporarily unavailable");
      expect(result.confidence).toBe(0);
    });

    it("returns fallback for missing blockType", async () => {
      // Test defensive coding - missing blockType should be handled
      const request = {
        blockType: "" as unknown as undefined,
        intent: "create",
        prospect: { id: "prospect-1" },
        language: "en",
      } as unknown as GenerationRequest;

      const result = await generateBlockContent(request);

      expect(result.content).toContain("Unable to generate content");
      expect(result.confidence).toBe(0);
    });

    it("calculates confidence score based on content quality", async () => {
      const request: GenerationRequest = {
        blockType: "villain_story",
        intent: "create",
        prospect: { id: "prospect-1" },
        language: "lt",
      };

      // Short response should have lower confidence
      mockGenerateText.mockResolvedValueOnce({
        text: "Short.",
        usage: { inputTokens: 100, outputTokens: 5, totalTokens: 105 },
      });

      const shortResult = await generateBlockContent(request);
      const shortConfidence = shortResult.confidence;

      // Longer, structured response should have higher confidence
      mockGenerateText.mockResolvedValueOnce({
        text: "Prieš penkerius metus jūsų konkurentai investavo į SEO.\nJie suprato, kad organinė paieška yra ateitis.\nDabar jie dominuoja pirmame Google puslapyje.\nO jūs vis dar mokate už kiekvieną paspaudimą.",
        usage: { inputTokens: 100, outputTokens: 80, totalTokens: 180 },
      });

      const longResult = await generateBlockContent(request);
      const longConfidence = longResult.confidence;

      // Longer, structured content should have higher confidence
      expect(longConfidence).toBeGreaterThan(shortConfidence);
    });

    it("handles Lithuanian language constraint", async () => {
      const request: GenerationRequest = {
        blockType: "offer_stack",
        intent: "create",
        prospect: {
          id: "prospect-1",
          domain: "parduotuve.lt",
        },
        language: "lt",
      };

      mockGenerateText.mockResolvedValueOnce({
        text: "Paketas apima...",
      });

      await generateBlockContent(request);

      const callArgs = mockGenerateText.mock.calls[0][0];
      expect(callArgs.prompt).toContain("Lithuanian");
    });

    it("handles English language constraint", async () => {
      const request: GenerationRequest = {
        blockType: "risk_reversal",
        intent: "create",
        prospect: { id: "prospect-1" },
        language: "en",
      };

      mockGenerateText.mockResolvedValueOnce({
        text: "We guarantee...",
      });

      await generateBlockContent(request);

      const callArgs = mockGenerateText.mock.calls[0][0];
      expect(callArgs.prompt).toContain("English");
    });
  });

  describe("buildPrompt", () => {
    it("includes block type in prompt", () => {
      const request: GenerationRequest = {
        blockType: "social_proof",
        intent: "create",
        prospect: { id: "p1" },
        language: "lt",
      };

      const prompt = buildPrompt(request);

      expect(prompt).toContain("social_proof");
      expect(prompt).toContain("Social Proof");
    });

    it("includes prospect context when available", () => {
      const request: GenerationRequest = {
        blockType: "pain_amplifier",
        intent: "create",
        prospect: {
          id: "p1",
          domain: "myshop.lt",
          niche: "fashion retail",
          painPoints: ["low conversion rate", "high bounce rate"],
        },
        language: "lt",
      };

      const prompt = buildPrompt(request);

      expect(prompt).toContain("myshop.lt");
      expect(prompt).toContain("fashion retail");
      expect(prompt).toContain("low conversion rate");
      expect(prompt).toContain("high bounce rate");
    });

    it("includes style references when provided", () => {
      const request: GenerationRequest = {
        blockType: "credibility",
        intent: "create",
        prospect: { id: "p1" },
        styleReferences: [
          {
            id: "ref-1",
            type: "text",
            content: "Professional, confident, data-driven tone",
          },
        ],
        language: "en",
      };

      const prompt = buildPrompt(request);

      expect(prompt).toContain("Professional, confident, data-driven tone");
    });

    it("includes existing content for improve intent", () => {
      const request: GenerationRequest = {
        blockType: "cta",
        intent: "improve",
        prospect: { id: "p1" },
        existingContent: "Contact us today!",
        language: "en",
      };

      const prompt = buildPrompt(request);

      expect(prompt).toContain("Contact us today!");
      expect(prompt).toContain("Improve");
    });

    it("includes framework context when provided", () => {
      const request: GenerationRequest = {
        blockType: "villain_story",
        intent: "create",
        prospect: { id: "p1" },
        framework: "russell_brunson",
        language: "lt",
      };

      const prompt = buildPrompt(request);

      expect(prompt).toContain("russell_brunson");
    });

    it("includes preceding blocks context when provided", () => {
      const request: GenerationRequest = {
        blockType: "credibility",
        intent: "create",
        prospect: { id: "p1" },
        precedingBlocks: [
          "Your current SEO costs you money",
          "Other agencies fail to deliver",
        ],
        language: "lt",
      };

      const prompt = buildPrompt(request);

      expect(prompt).toContain("Your current SEO costs you money");
      expect(prompt).toContain("Other agencies fail to deliver");
    });

    it("includes max length constraint when provided", () => {
      const request: GenerationRequest = {
        blockType: "urgency",
        intent: "create",
        prospect: { id: "p1" },
        maxLength: 150,
        language: "lt",
      };

      const prompt = buildPrompt(request);

      expect(prompt).toContain("150");
    });

    it("includes tone constraint when provided", () => {
      const request: GenerationRequest = {
        blockType: "offer_stack",
        intent: "create",
        prospect: { id: "p1" },
        tone: "urgent",
        language: "en",
      };

      const prompt = buildPrompt(request);

      expect(prompt).toContain("urgent");
    });
  });

  describe("classifyError", () => {
    it("should classify AbortError as timeout", () => {
      const error = new Error("Operation aborted");
      error.name = "AbortError";

      const result = classifyError(error);

      expect(result.type).toBe("timeout");
      expect(result.status).toBeUndefined();
    });

    it("should classify 429 status as rate_limit", () => {
      const error = new Error("Too many requests");
      (error as Error & { status: number }).status = 429;

      const result = classifyError(error);

      expect(result.type).toBe("rate_limit");
      expect(result.status).toBe(429);
    });

    it("should classify rate limit message as rate_limit", () => {
      const error = new Error("Rate limit exceeded");

      const result = classifyError(error);

      expect(result.type).toBe("rate_limit");
      expect(result.status).toBe(429);
    });

    it("should classify resource exhausted as rate_limit", () => {
      const error = new Error("Resource exhausted: quota exceeded");

      const result = classifyError(error);

      expect(result.type).toBe("rate_limit");
      expect(result.status).toBe(429);
    });

    it("should classify 503 status as service_unavailable", () => {
      const error = new Error("Service temporarily unavailable");
      (error as Error & { status: number }).status = 503;

      const result = classifyError(error);

      expect(result.type).toBe("service_unavailable");
      expect(result.status).toBe(503);
    });

    it("should classify service unavailable message as service_unavailable", () => {
      const error = new Error("503 service unavailable");

      const result = classifyError(error);

      expect(result.type).toBe("service_unavailable");
      expect(result.status).toBe(503);
    });

    it("should classify overloaded message as service_unavailable", () => {
      const error = new Error("Server overloaded, try again later");

      const result = classifyError(error);

      expect(result.type).toBe("service_unavailable");
      expect(result.status).toBe(503);
    });

    it("should classify 502 status as service_unavailable", () => {
      const error = new Error("Bad gateway");
      (error as Error & { status: number }).status = 502;

      const result = classifyError(error);

      expect(result.type).toBe("service_unavailable");
      expect(result.status).toBe(502);
    });

    it("should classify 504 status as service_unavailable", () => {
      const error = new Error("Gateway timeout");
      (error as Error & { status: number }).status = 504;

      const result = classifyError(error);

      expect(result.type).toBe("service_unavailable");
      expect(result.status).toBe(504);
    });

    it("should classify gateway message as service_unavailable", () => {
      const error = new Error("Bad Gateway error occurred");

      const result = classifyError(error);

      expect(result.type).toBe("service_unavailable");
    });

    it("should classify statusCode property same as status", () => {
      const error = new Error("Rate limited");
      (error as Error & { statusCode: number }).statusCode = 429;

      const result = classifyError(error);

      expect(result.type).toBe("rate_limit");
      expect(result.status).toBe(429);
    });

    it("should classify unknown errors as non_retryable", () => {
      const error = new Error("Unknown error");

      const result = classifyError(error);

      expect(result.type).toBe("non_retryable");
    });

    it("should classify validation errors as non_retryable", () => {
      const error = new Error("Invalid request: missing required field");
      (error as Error & { status: number }).status = 400;

      const result = classifyError(error);

      expect(result.type).toBe("non_retryable");
      expect(result.status).toBe(400);
    });

    it("should classify auth errors as non_retryable", () => {
      const error = new Error("Unauthorized");
      (error as Error & { status: number }).status = 401;

      const result = classifyError(error);

      expect(result.type).toBe("non_retryable");
      expect(result.status).toBe(401);
    });

    it("should handle non-Error objects", () => {
      const result = classifyError("Rate limit exceeded");

      expect(result.type).toBe("rate_limit");
    });

    it("should handle null/undefined gracefully", () => {
      const result = classifyError(null);

      expect(result.type).toBe("non_retryable");
    });
  });

  describe("calculateRetryDelay", () => {
    it("should return base delay for attempt 0", () => {
      // Mock Math.random to return 0 (no jitter)
      vi.spyOn(Math, "random").mockReturnValue(0);

      const delay = calculateRetryDelay(0);

      // 1000 * 2^0 = 1000ms
      expect(delay).toBe(1000);
    });

    it("should double delay for each attempt (exponential backoff)", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);

      const delay0 = calculateRetryDelay(0);
      const delay1 = calculateRetryDelay(1);
      const delay2 = calculateRetryDelay(2);

      expect(delay0).toBe(1000);  // 1000 * 2^0 = 1000
      expect(delay1).toBe(2000);  // 1000 * 2^1 = 2000
      expect(delay2).toBe(4000);  // 1000 * 2^2 = 4000
    });

    it("should add jitter up to 25% of delay", () => {
      // Max jitter at random = 1
      vi.spyOn(Math, "random").mockReturnValue(1);

      const delay = calculateRetryDelay(0);

      // 1000 + (1000 * 1 * 0.25) = 1250
      expect(delay).toBe(1250);
    });

    it("should add partial jitter based on random value", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const delay = calculateRetryDelay(1);

      // 2000 + (2000 * 0.5 * 0.25) = 2250
      expect(delay).toBe(2250);
    });

    it("should handle large attempt numbers", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);

      const delay = calculateRetryDelay(5);

      // 1000 * 2^5 = 32000ms
      expect(delay).toBe(32000);
    });
  });

  describe("generateBlockContent retry behavior", () => {
    it("should retry on rate limit errors and succeed", async () => {
      const request: GenerationRequest = {
        blockType: "pain_amplifier",
        intent: "create",
        prospect: { id: "prospect-1" },
        language: "lt",
      };

      // First call fails with rate limit, second succeeds
      const rateLimitError = new Error("Rate limit exceeded");
      (rateLimitError as Error & { status: number }).status = 429;

      mockGenerateText
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({
          text: "Successfully generated content",
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        });

      // Start the promise
      const resultPromise = generateBlockContent(request);

      // Advance through the retry delay
      await vi.advanceTimersByTimeAsync(2000);

      const result = await resultPromise;

      expect(mockGenerateText).toHaveBeenCalledTimes(2);
      expect(result.content).toBe("Successfully generated content");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should retry on service unavailable (503) errors", async () => {
      const request: GenerationRequest = {
        blockType: "credibility",
        intent: "create",
        prospect: { id: "prospect-1" },
        language: "en",
      };

      const serviceError = new Error("Service unavailable");
      (serviceError as Error & { status: number }).status = 503;

      mockGenerateText
        .mockRejectedValueOnce(serviceError)
        .mockResolvedValueOnce({
          text: "Generated after retry",
        });

      const resultPromise = generateBlockContent(request);
      await vi.advanceTimersByTimeAsync(2000);

      const result = await resultPromise;

      expect(mockGenerateText).toHaveBeenCalledTimes(2);
      expect(result.content).toBe("Generated after retry");
    });

    it("should retry on timeout (AbortError)", async () => {
      const request: GenerationRequest = {
        blockType: "cta",
        intent: "create",
        prospect: { id: "prospect-1" },
        language: "lt",
      };

      const abortError = new Error("Aborted");
      abortError.name = "AbortError";

      mockGenerateText
        .mockRejectedValueOnce(abortError)
        .mockResolvedValueOnce({
          text: "Content after timeout retry",
        });

      const resultPromise = generateBlockContent(request);
      await vi.advanceTimersByTimeAsync(2000);

      const result = await resultPromise;

      expect(mockGenerateText).toHaveBeenCalledTimes(2);
      expect(result.content).toBe("Content after timeout retry");
    });

    it("should NOT retry on non-retryable errors (400)", async () => {
      const request: GenerationRequest = {
        blockType: "social_proof",
        intent: "create",
        prospect: { id: "prospect-1" },
        language: "en",
      };

      const validationError = new Error("Invalid request");
      (validationError as Error & { status: number }).status = 400;

      mockGenerateText.mockRejectedValueOnce(validationError);

      const result = await generateBlockContent(request);

      // Should only call once - no retry for 400 errors
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
      expect(result.content).toContain("Unable to generate content");
      expect(result.confidence).toBe(0);
    });

    it("should NOT retry on auth errors (401)", async () => {
      const request: GenerationRequest = {
        blockType: "urgency",
        intent: "create",
        prospect: { id: "prospect-1" },
        language: "lt",
      };

      const authError = new Error("Unauthorized");
      (authError as Error & { status: number }).status = 401;

      mockGenerateText.mockRejectedValueOnce(authError);

      const result = await generateBlockContent(request);

      expect(mockGenerateText).toHaveBeenCalledTimes(1);
      expect(result.content).toContain("Unable to generate content");
    });

    it("should fail after MAX_RETRIES (3) attempts for retryable errors", async () => {
      const request: GenerationRequest = {
        blockType: "offer_stack",
        intent: "create",
        prospect: { id: "prospect-1" },
        language: "lt",
      };

      const rateLimitError = new Error("Rate limit exceeded");
      (rateLimitError as Error & { status: number }).status = 429;

      // Fail all 4 attempts (initial + 3 retries)
      mockGenerateText
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError);

      const resultPromise = generateBlockContent(request);

      // Advance through all retry delays (1s + 2s + 4s = 7s plus some buffer)
      await vi.advanceTimersByTimeAsync(10000);

      const result = await resultPromise;

      // Should have tried 4 times total (initial + 3 retries)
      expect(mockGenerateText).toHaveBeenCalledTimes(4);
      // User-friendly message for rate limit errors (M-ERR-03)
      expect(result.content).toContain("AI service is currently busy");
      expect(result.confidence).toBe(0);
    });

    it("should succeed on third retry after two failures", async () => {
      const request: GenerationRequest = {
        blockType: "risk_reversal",
        intent: "create",
        prospect: { id: "prospect-1" },
        language: "en",
      };

      const serviceError = new Error("Service overloaded");
      (serviceError as Error & { status: number }).status = 503;

      mockGenerateText
        .mockRejectedValueOnce(serviceError)
        .mockRejectedValueOnce(serviceError)
        .mockResolvedValueOnce({
          text: "Third time is the charm",
          usage: { inputTokens: 200, outputTokens: 100, totalTokens: 300 },
        });

      const resultPromise = generateBlockContent(request);

      // Advance through retry delays
      await vi.advanceTimersByTimeAsync(5000);

      const result = await resultPromise;

      expect(mockGenerateText).toHaveBeenCalledTimes(3);
      expect(result.content).toBe("Third time is the charm");
      expect(result.usage?.totalTokens).toBe(300);
    });

    it("should use exponential backoff between retries", async () => {
      const request: GenerationRequest = {
        blockType: "villain_story",
        intent: "create",
        prospect: { id: "prospect-1" },
        language: "lt",
      };

      // Mock random to 0 for predictable delays
      vi.spyOn(Math, "random").mockReturnValue(0);

      const rateLimitError = new Error("Rate limit");
      (rateLimitError as Error & { status: number }).status = 429;

      mockGenerateText
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({ text: "Success" });

      const resultPromise = generateBlockContent(request);

      // First retry should happen after ~1s
      expect(mockGenerateText).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1000);
      expect(mockGenerateText).toHaveBeenCalledTimes(2);

      // Second retry should happen after ~2s more
      await vi.advanceTimersByTimeAsync(2000);
      expect(mockGenerateText).toHaveBeenCalledTimes(3);

      const result = await resultPromise;
      expect(result.content).toBe("Success");
    });
  });

  describe("timeout handling", () => {
    it("should abort request after timeout period", async () => {
      const request: GenerationRequest = {
        blockType: "pain_amplifier",
        intent: "create",
        prospect: { id: "prospect-1" },
        language: "lt",
      };

      // Simulate a very slow response that would trigger timeout
      let abortSignalReceived = false;
      mockGenerateText.mockImplementation(async (options: { abortSignal?: AbortSignal }) => {
        // Check if abort signal is passed
        if (options.abortSignal) {
          options.abortSignal.addEventListener("abort", () => {
            abortSignalReceived = true;
          });
        }
        // Simulate slow response - this will be aborted
        await new Promise((resolve) => setTimeout(resolve, 70000));
        return { text: "Should not reach here" };
      });

      const resultPromise = generateBlockContent(request);

      // Advance past the 60s timeout
      await vi.advanceTimersByTimeAsync(61000);

      // The abort signal should have been triggered
      expect(abortSignalReceived).toBe(true);
    });

    it("should pass AbortSignal to generateText", async () => {
      const request: GenerationRequest = {
        blockType: "credibility",
        intent: "create",
        prospect: { id: "prospect-1" },
        language: "en",
      };

      mockGenerateText.mockResolvedValueOnce({
        text: "Generated content",
      });

      await generateBlockContent(request);

      // Verify AbortSignal was passed
      const callArgs = mockGenerateText.mock.calls[0][0];
      expect(callArgs.abortSignal).toBeDefined();
      expect(callArgs.abortSignal).toBeInstanceOf(AbortSignal);
    });

    it("should clear timeout on successful response", async () => {
      const request: GenerationRequest = {
        blockType: "cta",
        intent: "create",
        prospect: { id: "prospect-1" },
        language: "lt",
      };

      mockGenerateText.mockResolvedValueOnce({
        text: "Quick response",
        usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
      });

      const result = await generateBlockContent(request);

      expect(result.content).toBe("Quick response");
      // No timeout should have fired
    });
  });
});
