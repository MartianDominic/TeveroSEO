/**
 * Security Tests for VariableResolutionService
 * Phase 57 Security Fix: Variable Injection Prevention
 *
 * Tests for:
 * - Key pattern validation (P57-C2)
 * - HTML entity escaping in values
 * - Prototype pollution prevention
 */
import { describe, it, expect, vi } from "vitest";

// Mock the database and logger to avoid connection requirements
vi.mock("@/db/index", () => ({
  db: {},
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("@/db/variable-definitions-schema", () => ({
  variableDefinitions: {},
}));

vi.mock("@/db/proposal-schema", () => ({
  proposals: {},
}));

vi.mock("@/db/prospect-schema", () => ({
  prospects: {},
  prospectAnalyses: {},
}));

vi.mock("@/db/user-schema", () => ({
  organization: {},
}));

// Import after mocks are set up
import {
  isValidVariableKey,
  escapeHtmlEntities,
  VariableResolutionService,
  type ResolvedVariables,
} from "./VariableResolutionService";

describe("isValidVariableKey - Security Validation", () => {
  describe("Valid keys", () => {
    it("should accept simple alphanumeric keys", () => {
      expect(isValidVariableKey("client")).toBe(true);
      expect(isValidVariableKey("clientName")).toBe(true);
      expect(isValidVariableKey("Client123")).toBe(true);
    });

    it("should accept keys with underscores", () => {
      expect(isValidVariableKey("client_name")).toBe(true);
      expect(isValidVariableKey("client_company_name")).toBe(true);
    });

    it("should accept dotted keys", () => {
      expect(isValidVariableKey("client.name")).toBe(true);
      expect(isValidVariableKey("pricing.monthly.total")).toBe(true);
    });

    it("should accept keys starting with uppercase", () => {
      expect(isValidVariableKey("ClientName")).toBe(true);
      expect(isValidVariableKey("TOTAL")).toBe(true);
    });
  });

  describe("Invalid keys - Pattern violations", () => {
    it("should reject keys starting with numbers", () => {
      expect(isValidVariableKey("123abc")).toBe(false);
      expect(isValidVariableKey("1client")).toBe(false);
    });

    it("should reject keys with special characters", () => {
      expect(isValidVariableKey("client<script>")).toBe(false);
      expect(isValidVariableKey("client>name")).toBe(false);
      expect(isValidVariableKey("client&name")).toBe(false);
      expect(isValidVariableKey("client\"name")).toBe(false);
      expect(isValidVariableKey("client'name")).toBe(false);
      expect(isValidVariableKey("client=name")).toBe(false);
      expect(isValidVariableKey("client;name")).toBe(false);
    });

    it("should reject keys with spaces", () => {
      expect(isValidVariableKey("client name")).toBe(false);
      expect(isValidVariableKey(" client")).toBe(false);
      expect(isValidVariableKey("client ")).toBe(false);
    });

    it("should reject keys with hyphens", () => {
      expect(isValidVariableKey("client-name")).toBe(false);
    });

    it("should reject empty or null keys", () => {
      expect(isValidVariableKey("")).toBe(false);
      expect(isValidVariableKey(null as unknown as string)).toBe(false);
      expect(isValidVariableKey(undefined as unknown as string)).toBe(false);
    });

    it("should reject excessively long keys (DoS prevention)", () => {
      const longKey = "a".repeat(101);
      expect(isValidVariableKey(longKey)).toBe(false);

      const maxLengthKey = "a".repeat(100);
      expect(isValidVariableKey(maxLengthKey)).toBe(true);
    });
  });

  describe("Prototype pollution prevention", () => {
    it("should reject constructor key", () => {
      expect(isValidVariableKey("constructor")).toBe(false);
    });

    it("should reject __proto__ key", () => {
      expect(isValidVariableKey("__proto__")).toBe(false);
    });

    it("should reject prototype key", () => {
      expect(isValidVariableKey("prototype")).toBe(false);
    });

    it("should reject __defineGetter__ key", () => {
      expect(isValidVariableKey("__defineGetter__")).toBe(false);
    });

    it("should reject __defineSetter__ key", () => {
      expect(isValidVariableKey("__defineSetter__")).toBe(false);
    });

    it("should reject dangerous keys in dotted paths", () => {
      expect(isValidVariableKey("obj.constructor")).toBe(false);
      expect(isValidVariableKey("obj.constructor.name")).toBe(false);
      expect(isValidVariableKey("a.__proto__.b")).toBe(false);
      expect(isValidVariableKey("obj.prototype.method")).toBe(false);
    });

    it("should reject dangerous keys case-insensitively", () => {
      expect(isValidVariableKey("CONSTRUCTOR")).toBe(false);
      expect(isValidVariableKey("Constructor")).toBe(false);
      expect(isValidVariableKey("PROTOTYPE")).toBe(false);
    });

    it("should reject hasOwnProperty and similar", () => {
      expect(isValidVariableKey("hasOwnProperty")).toBe(false);
      expect(isValidVariableKey("isPrototypeOf")).toBe(false);
      expect(isValidVariableKey("propertyIsEnumerable")).toBe(false);
      expect(isValidVariableKey("toString")).toBe(false);
      expect(isValidVariableKey("valueOf")).toBe(false);
    });
  });
});

describe("escapeHtmlEntities - XSS Prevention", () => {
  it("should escape < and >", () => {
    expect(escapeHtmlEntities("<script>")).toBe("&lt;script&gt;");
    expect(escapeHtmlEntities("<img src=x>")).toBe("&lt;img src=x&gt;");
  });

  it("should escape &", () => {
    expect(escapeHtmlEntities("Tom & Jerry")).toBe("Tom &amp; Jerry");
    expect(escapeHtmlEntities("A&B&C")).toBe("A&amp;B&amp;C");
  });

  it("should escape double quotes", () => {
    expect(escapeHtmlEntities('"quoted"')).toBe("&quot;quoted&quot;");
  });

  it("should escape single quotes", () => {
    expect(escapeHtmlEntities("it's")).toBe("it&#x27;s");
  });

  it("should escape complex XSS payloads", () => {
    const payload = '<script>alert("xss")</script>';
    const escaped = escapeHtmlEntities(payload);
    expect(escaped).not.toContain("<");
    expect(escaped).not.toContain(">");
    expect(escaped).toBe("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
  });

  it("should escape img onerror payloads", () => {
    const payload = '<img src=x onerror="alert(1)">';
    const escaped = escapeHtmlEntities(payload);
    expect(escaped).not.toContain("<img");
    expect(escaped).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  });

  it("should handle empty string", () => {
    expect(escapeHtmlEntities("")).toBe("");
  });

  it("should handle null/undefined gracefully", () => {
    expect(escapeHtmlEntities(null as unknown as string)).toBe("");
    expect(escapeHtmlEntities(undefined as unknown as string)).toBe("");
  });

  it("should preserve normal text", () => {
    expect(escapeHtmlEntities("Hello World")).toBe("Hello World");
    expect(escapeHtmlEntities("Acme Corp")).toBe("Acme Corp");
  });

  it("should handle multiple special characters", () => {
    const input = '<a href="test">Tom & Jerry\'s</a>';
    const expected = "&lt;a href=&quot;test&quot;&gt;Tom &amp; Jerry&#x27;s&lt;/a&gt;";
    expect(escapeHtmlEntities(input)).toBe(expected);
  });
});

describe("VariableResolutionService.replaceInText - Integration", () => {
  // Create mock resolved variables for testing
  const createMockResolved = (
    overrides: Partial<Record<string, { key: string; value: string; category: string; label: string; isEmpty: boolean }>> = {}
  ): ResolvedVariables => ({
    "client.name": {
      key: "client.name",
      value: "Acme Corp",
      category: "client",
      label: "Client Name",
      isEmpty: false,
    },
    "client.email": {
      key: "client.email",
      value: "test@acme.com",
      category: "client",
      label: "Client Email",
      isEmpty: false,
    },
    "pricing.total": {
      key: "pricing.total",
      value: "1000",
      category: "pricing",
      label: "Total",
      isEmpty: false,
    },
    ...overrides,
  } as ResolvedVariables);

  describe("Key Validation in replaceInText", () => {
    it("should replace valid variable keys", () => {
      const resolved = createMockResolved();
      const text = "Hello {{client.name}}, your total is {{pricing.total}}";

      const result = VariableResolutionService.replaceInText(text, resolved);

      expect(result).toBe("Hello Acme Corp, your total is 1000");
    });

    it("should reject {{constructor}} key (prototype pollution)", () => {
      const resolved = createMockResolved({
        constructor: {
          key: "constructor",
          value: "malicious",
          category: "custom",
          label: "Constructor",
          isEmpty: false,
        },
      });
      const text = "Value: {{constructor}}";

      const result = VariableResolutionService.replaceInText(text, resolved);

      // Should keep original placeholder, not resolve
      expect(result).toBe("Value: {{constructor}}");
    });

    it("should reject {{__proto__}} key (prototype pollution)", () => {
      const resolved = createMockResolved({
        __proto__: {
          key: "__proto__",
          value: "malicious",
          category: "custom",
          label: "Proto",
          isEmpty: false,
        },
      });
      const text = "Value: {{__proto__}}";

      const result = VariableResolutionService.replaceInText(text, resolved);

      expect(result).toBe("Value: {{__proto__}}");
    });

    it("should reject dotted keys with dangerous segments", () => {
      const resolved = createMockResolved({
        "obj.constructor.name": {
          key: "obj.constructor.name",
          value: "malicious",
          category: "custom",
          label: "Constructor Name",
          isEmpty: false,
        },
      });
      const text = "Value: {{obj.constructor.name}}";

      const result = VariableResolutionService.replaceInText(text, resolved);

      expect(result).toBe("Value: {{obj.constructor.name}}");
    });

    it("should reject keys with special characters", () => {
      const resolved = createMockResolved({
        "client<script>": {
          key: "client<script>",
          value: "malicious",
          category: "custom",
          label: "Script",
          isEmpty: false,
        },
      });
      const text = "Value: {{client<script>}}";

      const result = VariableResolutionService.replaceInText(text, resolved);

      expect(result).toBe("Value: {{client<script>}}");
    });
  });

  describe("HTML Entity Escaping in replaceInText", () => {
    it("should escape < and > in values", () => {
      const resolved = createMockResolved({
        "client.name": {
          key: "client.name",
          value: "<script>alert('xss')</script>",
          category: "client",
          label: "Client Name",
          isEmpty: false,
        },
      });
      const text = "Hello {{client.name}}";

      const result = VariableResolutionService.replaceInText(text, resolved);

      expect(result).toBe("Hello &lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;");
      expect(result).not.toContain("<script>");
    });

    it("should escape & in values", () => {
      const resolved = createMockResolved({
        "client.name": {
          key: "client.name",
          value: "Tom & Jerry",
          category: "client",
          label: "Client Name",
          isEmpty: false,
        },
      });
      const text = "Hello {{client.name}}";

      const result = VariableResolutionService.replaceInText(text, resolved);

      expect(result).toBe("Hello Tom &amp; Jerry");
    });

    it("should allow disabling HTML escaping when explicitly requested", () => {
      const resolved = createMockResolved({
        "client.name": {
          key: "client.name",
          value: "<b>Bold Name</b>",
          category: "client",
          label: "Client Name",
          isEmpty: false,
        },
      });
      const text = "Hello {{client.name}}";

      const result = VariableResolutionService.replaceInText(text, resolved, {
        escapeHtml: false,
      });

      // When escaping is disabled, raw HTML passes through
      expect(result).toBe("Hello <b>Bold Name</b>");
    });
  });

  describe("Combined Security", () => {
    it("should handle multiple variables with mixed content", () => {
      const resolved = createMockResolved({
        "client.name": {
          key: "client.name",
          value: "Acme & Co <Ltd>",
          category: "client",
          label: "Client Name",
          isEmpty: false,
        },
        "pricing.total": {
          key: "pricing.total",
          value: "1000",
          category: "pricing",
          label: "Total",
          isEmpty: false,
        },
      });
      const text = "Client: {{client.name}}, Total: {{pricing.total}}, Evil: {{__proto__}}";

      const result = VariableResolutionService.replaceInText(text, resolved);

      expect(result).toBe("Client: Acme &amp; Co &lt;Ltd&gt;, Total: 1000, Evil: {{__proto__}}");
    });

    it("should preserve whitespace in keys (trimmed)", () => {
      const resolved = createMockResolved();
      // Keys with leading/trailing whitespace should be trimmed and validated
      const text = "Hello {{ client.name }}";

      const result = VariableResolutionService.replaceInText(text, resolved);

      expect(result).toBe("Hello Acme Corp");
    });
  });
});
