/**
 * Tests for IP extraction utility.
 * DUP-003 FIX: Consolidated IP extraction tests.
 */
import { describe, it, expect } from "vitest";
import { getClientIp, isIpInRange, isIpInAnyRange } from "./ip-extractor";

describe("getClientIp", () => {
  it("extracts IP from X-Forwarded-For header (single IP)", () => {
    const req = {
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "x-forwarded-for" ? "192.168.1.100" : null,
      },
    };
    expect(getClientIp(req)).toBe("192.168.1.100");
  });

  it("extracts first IP from X-Forwarded-For header (multiple IPs)", () => {
    const req = {
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "x-forwarded-for"
            ? "192.168.1.100, 10.0.0.1, 172.16.0.1"
            : null,
      },
    };
    expect(getClientIp(req)).toBe("192.168.1.100");
  });

  it("extracts IP from X-Real-IP header", () => {
    const req = {
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "x-real-ip" ? "10.0.0.50" : null,
      },
    };
    expect(getClientIp(req)).toBe("10.0.0.50");
  });

  it("extracts IP from CF-Connecting-IP header", () => {
    const req = {
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "cf-connecting-ip" ? "203.0.113.50" : null,
      },
    };
    expect(getClientIp(req)).toBe("203.0.113.50");
  });

  it("prefers X-Forwarded-For over X-Real-IP", () => {
    const req = {
      headers: {
        get: (name: string) => {
          if (name.toLowerCase() === "x-forwarded-for") return "192.168.1.100";
          if (name.toLowerCase() === "x-real-ip") return "10.0.0.50";
          return null;
        },
      },
    };
    expect(getClientIp(req)).toBe("192.168.1.100");
  });

  it("falls back to socket address", () => {
    const req = {
      headers: { get: () => null },
      socket: { remoteAddress: "127.0.0.1" },
    };
    expect(getClientIp(req)).toBe("127.0.0.1");
  });

  it("falls back to req.ip (Express-style)", () => {
    const req = {
      headers: { get: () => null },
      ip: "127.0.0.2",
    };
    expect(getClientIp(req)).toBe("127.0.0.2");
  });

  it('returns "unknown" when no IP found', () => {
    const req = {
      headers: { get: () => null },
    };
    expect(getClientIp(req)).toBe("unknown");
  });

  it("handles Express-style headers (object instead of get method)", () => {
    const req = {
      headers: {
        "x-forwarded-for": "192.168.1.100",
      },
    };
    expect(getClientIp(req)).toBe("192.168.1.100");
  });

  it("handles array headers (Express-style)", () => {
    const req = {
      headers: {
        "x-forwarded-for": ["192.168.1.100", "10.0.0.1"],
      },
    };
    expect(getClientIp(req)).toBe("192.168.1.100");
  });

  it("trims whitespace from IPs", () => {
    const req = {
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "x-forwarded-for"
            ? "  192.168.1.100  , 10.0.0.1"
            : null,
      },
    };
    expect(getClientIp(req)).toBe("192.168.1.100");
  });
});

describe("isIpInRange", () => {
  it("returns true for IP in /24 range", () => {
    expect(isIpInRange("192.168.1.100", "192.168.1.0/24")).toBe(true);
    expect(isIpInRange("192.168.1.1", "192.168.1.0/24")).toBe(true);
    expect(isIpInRange("192.168.1.254", "192.168.1.0/24")).toBe(true);
  });

  it("returns false for IP outside /24 range", () => {
    expect(isIpInRange("192.168.2.1", "192.168.1.0/24")).toBe(false);
    expect(isIpInRange("10.0.0.1", "192.168.1.0/24")).toBe(false);
  });

  it("returns true for IP in /16 range", () => {
    expect(isIpInRange("192.168.1.100", "192.168.0.0/16")).toBe(true);
    expect(isIpInRange("192.168.255.255", "192.168.0.0/16")).toBe(true);
  });

  it("returns false for IP outside /16 range", () => {
    expect(isIpInRange("192.169.1.1", "192.168.0.0/16")).toBe(false);
  });

  it("handles /32 (single IP)", () => {
    expect(isIpInRange("192.168.1.1", "192.168.1.1/32")).toBe(true);
    expect(isIpInRange("192.168.1.2", "192.168.1.1/32")).toBe(false);
  });

  it("handles /0 (all IPs)", () => {
    expect(isIpInRange("192.168.1.1", "0.0.0.0/0")).toBe(true);
    expect(isIpInRange("10.0.0.1", "0.0.0.0/0")).toBe(true);
  });

  it("returns false for invalid CIDR", () => {
    expect(isIpInRange("192.168.1.1", "invalid")).toBe(false);
    expect(isIpInRange("192.168.1.1", "192.168.1.0")).toBe(false); // Missing /bits
  });

  it("returns false for invalid IP", () => {
    expect(isIpInRange("invalid", "192.168.1.0/24")).toBe(false);
    expect(isIpInRange("192.168.1", "192.168.1.0/24")).toBe(false); // Incomplete IP
  });
});

describe("isIpInAnyRange", () => {
  const ranges = ["192.168.1.0/24", "10.0.0.0/8", "172.16.0.0/12"];

  it("returns true if IP is in any of the ranges", () => {
    expect(isIpInAnyRange("192.168.1.100", ranges)).toBe(true);
    expect(isIpInAnyRange("10.5.5.5", ranges)).toBe(true);
    expect(isIpInAnyRange("172.20.0.1", ranges)).toBe(true);
  });

  it("returns false if IP is not in any range", () => {
    expect(isIpInAnyRange("8.8.8.8", ranges)).toBe(false);
    expect(isIpInAnyRange("192.168.2.1", ranges)).toBe(false); // Just outside /24
  });

  it("returns false for empty ranges array", () => {
    expect(isIpInAnyRange("192.168.1.1", [])).toBe(false);
  });
});
