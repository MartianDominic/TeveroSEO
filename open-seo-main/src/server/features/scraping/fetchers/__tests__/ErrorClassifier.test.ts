/**
 * ErrorClassifier Unit Tests
 * Phase 95: P2.G14 Gap Closure - Shared Error Classification Utility
 */

import { describe, it, expect } from "vitest";
import {
  ErrorType,
  classifyStatusCode,
  classifyError,
  detectBotProtection,
  getBackoffMs,
  isRetryable,
  shouldEscalateTier,
  getEscalationReason,
  mapStatusCodeToEscalationReason,
  mapErrorToEscalationReason,
} from "../ErrorClassifier";

describe("ErrorClassifier", () => {
  describe("classifyStatusCode", () => {
    it("should return null for 2xx success codes", () => {
      expect(classifyStatusCode(200)).toBeNull();
      expect(classifyStatusCode(201)).toBeNull();
      expect(classifyStatusCode(204)).toBeNull();
    });

    it("should classify 429 as RATE_LIMITED", () => {
      const result = classifyStatusCode(429);
      expect(result).not.toBeNull();
      expect(result!.type).toBe(ErrorType.RATE_LIMITED);
      expect(result!.escalationReason).toBe("rate_limited");
      expect(result!.shouldRetry).toBe(true);
      expect(result!.shouldEscalate).toBe(true);
    });

    it("should classify 403 as BLOCKED", () => {
      const result = classifyStatusCode(403);
      expect(result).not.toBeNull();
      expect(result!.type).toBe(ErrorType.BLOCKED);
      expect(result!.escalationReason).toBe("ip_blocked");
      expect(result!.shouldRetry).toBe(false);
      expect(result!.shouldEscalate).toBe(true);
    });

    it("should classify 451 as BLOCKED (geo)", () => {
      const result = classifyStatusCode(451);
      expect(result).not.toBeNull();
      expect(result!.type).toBe(ErrorType.BLOCKED);
      expect(result!.escalationReason).toBe("geo_blocked");
    });

    it("should classify 503 as RETRYABLE with bot detection", () => {
      const result = classifyStatusCode(503);
      expect(result).not.toBeNull();
      expect(result!.type).toBe(ErrorType.RETRYABLE);
      expect(result!.escalationReason).toBe("bot_detected");
      expect(result!.shouldRetry).toBe(true);
      expect(result!.shouldEscalate).toBe(true);
    });

    it("should classify 5xx as RETRYABLE", () => {
      const result500 = classifyStatusCode(500);
      expect(result500!.type).toBe(ErrorType.RETRYABLE);
      expect(result500!.shouldRetry).toBe(true);

      const result502 = classifyStatusCode(502);
      expect(result502!.type).toBe(ErrorType.RETRYABLE);
    });

    it("should classify 4xx (except 429, 403) as PERMANENT", () => {
      const result404 = classifyStatusCode(404);
      expect(result404!.type).toBe(ErrorType.PERMANENT);
      expect(result404!.shouldRetry).toBe(false);
      expect(result404!.shouldEscalate).toBe(false);

      const result400 = classifyStatusCode(400);
      expect(result400!.type).toBe(ErrorType.PERMANENT);
    });
  });

  describe("classifyError", () => {
    it("should classify AbortError as timeout", () => {
      const error = new Error("Request aborted");
      error.name = "AbortError";
      const result = classifyError(error);
      expect(result.escalationReason).toBe("timeout");
      expect(result.type).toBe(ErrorType.RETRYABLE);
      expect(result.shouldRetry).toBe(true);
    });

    it("should classify timeout messages as timeout", () => {
      const result = classifyError(new Error("Request timeout"));
      expect(result.escalationReason).toBe("timeout");

      const result2 = classifyError(new Error("ETIMEDOUT"));
      expect(result2.escalationReason).toBe("timeout");
    });

    it("should classify connection refused as connection_reset", () => {
      const result = classifyError(new Error("ECONNREFUSED"));
      expect(result.escalationReason).toBe("connection_reset");
      expect(result.shouldRetry).toBe(true);
    });

    it("should classify connection reset as connection_reset", () => {
      const result = classifyError(new Error("ECONNRESET"));
      expect(result.escalationReason).toBe("connection_reset");
    });

    it("should classify DNS errors as dns_error", () => {
      const result = classifyError(new Error("ENOTFOUND"));
      expect(result.escalationReason).toBe("dns_error");
      expect(result.type).toBe(ErrorType.PERMANENT);
      expect(result.shouldRetry).toBe(false);
    });

    it("should classify SSL errors as ssl_error", () => {
      const result = classifyError(new Error("SSL certificate error"));
      expect(result.escalationReason).toBe("ssl_error");
      expect(result.type).toBe(ErrorType.PERMANENT);

      const result2 = classifyError(new Error("TLS handshake failed"));
      expect(result2.escalationReason).toBe("ssl_error");
    });

    it("should default to connection_reset for unknown errors", () => {
      const result = classifyError(new Error("Some unknown error"));
      expect(result.escalationReason).toBe("connection_reset");
      expect(result.type).toBe(ErrorType.RETRYABLE);
    });
  });

  describe("detectBotProtection", () => {
    it("should detect Cloudflare protection", () => {
      const html = "<html><body>Just a moment... Checking your browser</body></html>";
      const headers = new Headers({ "cf-ray": "abc123" });
      const result = detectBotProtection(html, headers);
      expect(result).not.toBeNull();
      expect(result!.escalationReason).toBe("dc_detected");
      expect(result!.type).toBe(ErrorType.BLOCKED);
    });

    it("should detect Cloudflare via header alone", () => {
      const html = "<html><body>Normal content</body></html>";
      const headers = new Headers({ "cf-mitigated": "challenge" });
      const result = detectBotProtection(html, headers);
      expect(result).not.toBeNull();
      expect(result!.escalationReason).toBe("dc_detected");
    });

    it("should detect reCAPTCHA", () => {
      const html = '<html><body><div class="g-recaptcha"></div></body></html>';
      const headers = new Headers();
      const result = detectBotProtection(html, headers);
      expect(result).not.toBeNull();
      expect(result!.escalationReason).toBe("captcha");
    });

    it("should detect hCaptcha", () => {
      const html = '<html><body><div id="hcaptcha"></div></body></html>';
      const headers = new Headers();
      const result = detectBotProtection(html, headers);
      expect(result).not.toBeNull();
      expect(result!.escalationReason).toBe("captcha");
    });

    it("should detect generic bot detection", () => {
      const html = "<html><body>Are you a robot?</body></html>";
      const headers = new Headers();
      const result = detectBotProtection(html, headers);
      expect(result).not.toBeNull();
      expect(result!.escalationReason).toBe("bot_detected");
    });

    it("should detect datacenter blocking", () => {
      const html = "<html><body>Datacenter IPs are not allowed</body></html>";
      const headers = new Headers();
      const result = detectBotProtection(html, headers);
      expect(result).not.toBeNull();
      expect(result!.escalationReason).toBe("dc_detected");
    });

    it("should return null for normal HTML", () => {
      const html = "<html><body><h1>Welcome to our site</h1><p>Normal content here</p></body></html>";
      const headers = new Headers();
      const result = detectBotProtection(html, headers);
      expect(result).toBeNull();
    });

    it("should work with Record<string, string> headers", () => {
      const html = "<html><body>Normal</body></html>";
      const headers: Record<string, string> = { "cf-ray": "abc123" };
      const result = detectBotProtection(html, headers);
      expect(result).not.toBeNull();
      expect(result!.escalationReason).toBe("dc_detected");
    });
  });

  describe("getBackoffMs", () => {
    it("should return 0 for BLOCKED errors", () => {
      const backoff = getBackoffMs(ErrorType.BLOCKED, 0);
      expect(backoff).toBe(0);
    });

    it("should return 0 for PERMANENT errors", () => {
      const backoff = getBackoffMs(ErrorType.PERMANENT, 0);
      expect(backoff).toBe(0);
    });

    it("should return exponential backoff for RETRYABLE errors", () => {
      const backoff0 = getBackoffMs(ErrorType.RETRYABLE, 0, { jitterFactor: 0 });
      const backoff1 = getBackoffMs(ErrorType.RETRYABLE, 1, { jitterFactor: 0 });
      const backoff2 = getBackoffMs(ErrorType.RETRYABLE, 2, { jitterFactor: 0 });

      expect(backoff0).toBe(1000); // 1000 * 2^0 = 1000
      expect(backoff1).toBe(2000); // 1000 * 2^1 = 2000
      expect(backoff2).toBe(4000); // 1000 * 2^2 = 4000
    });

    it("should use higher base delay for RATE_LIMITED", () => {
      const backoff = getBackoffMs(ErrorType.RATE_LIMITED, 0, { jitterFactor: 0 });
      expect(backoff).toBe(10000); // 10 seconds for rate limits
    });

    it("should cap backoff at maxDelayMs", () => {
      const backoff = getBackoffMs(ErrorType.RETRYABLE, 10, {
        maxDelayMs: 5000,
        jitterFactor: 0,
      });
      expect(backoff).toBe(5000);
    });

    it("should allow custom base delay", () => {
      const backoff = getBackoffMs(ErrorType.RETRYABLE, 0, {
        baseDelayMs: 500,
        jitterFactor: 0,
      });
      expect(backoff).toBe(500);
    });
  });

  describe("convenience functions", () => {
    describe("isRetryable", () => {
      it("should return true for retryable status codes", () => {
        expect(isRetryable(500)).toBe(true);
        expect(isRetryable(503)).toBe(true);
        expect(isRetryable(429)).toBe(true);
      });

      it("should return false for permanent status codes", () => {
        expect(isRetryable(404)).toBe(false);
        expect(isRetryable(403)).toBe(false);
      });

      it("should handle Error objects", () => {
        expect(isRetryable(new Error("ETIMEDOUT"))).toBe(true);
        expect(isRetryable(new Error("ENOTFOUND"))).toBe(false);
      });
    });

    describe("shouldEscalateTier", () => {
      it("should return true for blocking status codes", () => {
        expect(shouldEscalateTier(403)).toBe(true);
        expect(shouldEscalateTier(429)).toBe(true);
      });

      it("should return false for server errors", () => {
        expect(shouldEscalateTier(500)).toBe(false);
      });

      it("should handle Error objects", () => {
        const abortError = new Error("Aborted");
        abortError.name = "AbortError";
        expect(shouldEscalateTier(abortError)).toBe(true);
      });
    });

    describe("getEscalationReason", () => {
      it("should return correct reason for status codes", () => {
        expect(getEscalationReason(429)).toBe("rate_limited");
        expect(getEscalationReason(403)).toBe("ip_blocked");
        expect(getEscalationReason(200)).toBeUndefined();
      });

      it("should return correct reason for errors", () => {
        expect(getEscalationReason(new Error("ETIMEDOUT"))).toBe("timeout");
        expect(getEscalationReason(new Error("ENOTFOUND"))).toBe("dns_error");
      });
    });

    describe("mapStatusCodeToEscalationReason", () => {
      it("should map common status codes", () => {
        expect(mapStatusCodeToEscalationReason(429)).toBe("rate_limited");
        expect(mapStatusCodeToEscalationReason(403)).toBe("ip_blocked");
        expect(mapStatusCodeToEscalationReason(503)).toBe("bot_detected");
        expect(mapStatusCodeToEscalationReason(200)).toBeUndefined();
      });
    });

    describe("mapErrorToEscalationReason", () => {
      it("should map common errors", () => {
        expect(mapErrorToEscalationReason(new Error("timeout"))).toBe("timeout");
        expect(mapErrorToEscalationReason(new Error("ECONNRESET"))).toBe("connection_reset");
      });
    });
  });
});
