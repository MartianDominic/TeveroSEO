/**
 * Tests for VerticalClassifier service.
 * Phase 92-01: Database Schema + VerticalClassifier
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  VerticalClassifier,
  resetVerticalClassifierService,
} from "./VerticalClassifier";
import { CircuitOpenError } from "@/server/features/scraping/resilience/CircuitBreaker";

// Mock database
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve()),
    })),
  },
  verticalClassifications: {},
}));

// Mock OpenAI client
const mockCreate = vi.fn();
vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
    },
  };
});

// Test HTML fixtures
const createMedicalSchemaHtml = () => `
<!DOCTYPE html>
<html>
<head>
  <title>Dr. Smith Medical Clinic</title>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "MedicalOrganization",
    "name": "Dr. Smith Medical Clinic",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "123 Health St"
    }
  }
  </script>
</head>
<body>
  <h1>Welcome to Dr. Smith Medical Clinic</h1>
  <p>Providing quality healthcare services.</p>
</body>
</html>
`;

const createEcommerceUrlHtml = () => `
<!DOCTYPE html>
<html>
<head><title>Widget Store</title></head>
<body>
  <h1>Amazing Widget</h1>
  <p>Buy this great widget today!</p>
</body>
</html>
`;

const createFinancialKeywordHtml = () => `
<!DOCTYPE html>
<html>
<head><title>Investment Guide</title></head>
<body>
  <h1>How to Build Your Investment Portfolio</h1>
  <p>Learn about 401k retirement planning and building your investment portfolio.
  We provide financial advice on managing your debt and improving your credit score.</p>
</body>
</html>
`;

const createGenericHtml = () => `
<!DOCTYPE html>
<html>
<head><title>Random Page</title></head>
<body>
  <h1>Hello World</h1>
  <p>This is just some generic content about nothing specific.</p>
</body>
</html>
`;

const createLegalServiceSchemaHtml = () => `
<!DOCTYPE html>
<html>
<head>
  <title>Johnson & Associates Law Firm</title>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "LegalService",
    "name": "Johnson & Associates"
  }
  </script>
</head>
<body>
  <h1>Expert Legal Services</h1>
</body>
</html>
`;

const createProductSchemaHtml = () => `
<!DOCTYPE html>
<html>
<head>
  <title>Amazing Widget - Shop Now</title>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Amazing Widget",
    "offers": {
      "@type": "Offer",
      "price": "29.99"
    }
  }
  </script>
</head>
<body>
  <h1>Amazing Widget</h1>
</body>
</html>
`;

describe("VerticalClassifier", () => {
  let classifier: VerticalClassifier;

  beforeEach(() => {
    // Set up test API key
    process.env.XAI_API_KEY = "test-api-key";
    resetVerticalClassifierService();
    classifier = new VerticalClassifier();
    mockCreate.mockReset();
  });

  afterEach(() => {
    delete process.env.XAI_API_KEY;
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("throws error when XAI_API_KEY not configured", () => {
      delete process.env.XAI_API_KEY;
      expect(() => new VerticalClassifier()).toThrow("XAI_API_KEY not configured");
    });

    it("accepts custom API key in config", () => {
      delete process.env.XAI_API_KEY;
      const instance = new VerticalClassifier({ apiKey: "custom-key" });
      expect(instance).toBeDefined();
    });
  });

  describe("classifyHeuristic", () => {
    describe("Schema.org detection", () => {
      it("returns healthcare vertical for MedicalOrganization schema", () => {
        const result = classifier.classifyHeuristic(
          createMedicalSchemaHtml(),
          "/clinic"
        );

        expect(result).not.toBeNull();
        expect(result!.vertical).toBe("healthcare");
        expect(result!.confidence).toBe(0.95);
        expect(result!.isYmyl).toBe(true);
        expect(result!.method).toBe("schema");
      });

      it("returns legal vertical for LegalService schema", () => {
        const result = classifier.classifyHeuristic(
          createLegalServiceSchemaHtml(),
          "/law-firm"
        );

        expect(result).not.toBeNull();
        expect(result!.vertical).toBe("legal");
        expect(result!.confidence).toBe(0.95);
        expect(result!.isYmyl).toBe(true);
        expect(result!.method).toBe("schema");
      });

      it("returns ecommerce vertical for Product schema", () => {
        const result = classifier.classifyHeuristic(
          createProductSchemaHtml(),
          "/widget"
        );

        expect(result).not.toBeNull();
        expect(result!.vertical).toBe("ecommerce");
        expect(result!.confidence).toBe(0.95);
        expect(result!.isYmyl).toBe(false);
        expect(result!.method).toBe("schema");
      });
    });

    describe("URL pattern detection", () => {
      it("returns ecommerce vertical for /product/* URL", () => {
        const result = classifier.classifyHeuristic(
          createEcommerceUrlHtml(),
          "/products/widget-123"
        );

        expect(result).not.toBeNull();
        expect(result!.vertical).toBe("ecommerce");
        expect(result!.confidence).toBe(0.9);
        expect(result!.isYmyl).toBe(false);
        expect(result!.method).toBe("url-pattern");
      });

      it("returns saas vertical for /pricing URL", () => {
        const result = classifier.classifyHeuristic(createGenericHtml(), "/pricing");

        expect(result).not.toBeNull();
        expect(result!.vertical).toBe("saas");
        expect(result!.confidence).toBe(0.9);
        expect(result!.method).toBe("url-pattern");
      });

      it("returns healthcare vertical for /doctors URL", () => {
        const result = classifier.classifyHeuristic(createGenericHtml(), "/doctors/smith");

        expect(result).not.toBeNull();
        expect(result!.vertical).toBe("healthcare");
        expect(result!.method).toBe("url-pattern");
      });

      it("returns legal vertical for /attorneys URL", () => {
        const result = classifier.classifyHeuristic(createGenericHtml(), "/attorneys/jones");

        expect(result).not.toBeNull();
        expect(result!.vertical).toBe("legal");
        expect(result!.method).toBe("url-pattern");
      });
    });

    describe("YMYL keyword detection", () => {
      it("returns financial vertical for investment content", () => {
        const result = classifier.classifyHeuristic(
          createFinancialKeywordHtml(),
          "/guide"
        );

        expect(result).not.toBeNull();
        expect(result!.vertical).toBe("financial");
        expect(result!.confidence).toBe(0.7);
        expect(result!.isYmyl).toBe(true);
        expect(result!.method).toBe("keyword");
      });

      it("returns true for YMYL detection on healthcare/legal/financial verticals", () => {
        // Healthcare
        const healthcareResult = classifier.classifyHeuristic(
          createMedicalSchemaHtml(),
          "/clinic"
        );
        expect(healthcareResult!.isYmyl).toBe(true);

        // Legal
        const legalResult = classifier.classifyHeuristic(
          createLegalServiceSchemaHtml(),
          "/law-firm"
        );
        expect(legalResult!.isYmyl).toBe(true);

        // Financial (via keywords)
        const financialResult = classifier.classifyHeuristic(
          createFinancialKeywordHtml(),
          "/guide"
        );
        expect(financialResult!.isYmyl).toBe(true);
      });
    });

    it("returns null for generic content without signals", () => {
      const result = classifier.classifyHeuristic(createGenericHtml(), "/about");

      expect(result).toBeNull();
    });
  });

  describe("classifyLLM", () => {
    it("returns classification from LLM response", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                vertical: "healthcare",
                confidence: 0.85,
                reasoning: "Medical content detected",
              }),
            },
          },
        ],
      });

      const result = await classifier.classifyLLM(createGenericHtml(), "/about");

      expect(result.vertical).toBe("healthcare");
      expect(result.confidence).toBe(0.85);
      expect(result.isYmyl).toBe(true);
      expect(result.method).toBe("llm");
    });

    it("throws error on invalid JSON response", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: "not valid json",
            },
          },
        ],
      });

      await expect(classifier.classifyLLM(createGenericHtml(), "/about")).rejects.toThrow(
        "Invalid JSON response from Grok"
      );
    });

    it("throws error on invalid schema response", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                vertical: "invalid_vertical",
                confidence: 0.9,
              }),
            },
          },
        ],
      });

      await expect(classifier.classifyLLM(createGenericHtml(), "/about")).rejects.toThrow(
        /Invalid Grok response/
      );
    });
  });

  describe("circuit breaker", () => {
    it("opens circuit after 3 failures", async () => {
      // Cause 3 failures
      mockCreate.mockRejectedValue(new Error("API error"));

      for (let i = 0; i < 3; i++) {
        try {
          await classifier.classifyLLM(createGenericHtml(), "/test");
        } catch {
          // Expected
        }
      }

      expect(classifier.isCircuitOpen).toBe(true);
    });

    it("throws CircuitOpenError when circuit is open", async () => {
      // Cause 3 failures to open circuit
      mockCreate.mockRejectedValue(new Error("API error"));

      for (let i = 0; i < 3; i++) {
        try {
          await classifier.classifyLLM(createGenericHtml(), "/test");
        } catch {
          // Expected
        }
      }

      // Now circuit should be open
      await expect(classifier.classifyLLM(createGenericHtml(), "/test")).rejects.toThrow(
        CircuitOpenError
      );
    });

    it("resets circuit manually", async () => {
      // Cause 3 failures
      mockCreate.mockRejectedValue(new Error("API error"));

      for (let i = 0; i < 3; i++) {
        try {
          await classifier.classifyLLM(createGenericHtml(), "/test");
        } catch {
          // Expected
        }
      }

      expect(classifier.isCircuitOpen).toBe(true);

      classifier.resetCircuit();

      expect(classifier.isCircuitOpen).toBe(false);
    });
  });

  describe("extractPathPattern", () => {
    it("keeps simple paths unchanged", () => {
      expect(classifier.extractPathPattern("/about")).toBe("/about");
      expect(classifier.extractPathPattern("/contact")).toBe("/contact");
    });

    it("converts numeric IDs to wildcard", () => {
      expect(classifier.extractPathPattern("/product/123")).toBe("/product/*");
      expect(classifier.extractPathPattern("/blog/456/post")).toBe("/blog/*/post");
    });

    it("converts UUIDs to wildcard", () => {
      expect(
        classifier.extractPathPattern("/user/550e8400-e29b-41d4-a716-446655440000")
      ).toBe("/user/*");
    });

    it("converts year/month patterns to wildcard", () => {
      // Year/month/day patterns become wildcards, but named slugs are preserved
      expect(classifier.extractPathPattern("/blog/2024/01/my-post")).toBe("/blog/*/my-post");
      // Pure date paths collapse to wildcard
      expect(classifier.extractPathPattern("/archive/2024/01/15")).toBe("/archive/*");
    });

    it("handles root path", () => {
      expect(classifier.extractPathPattern("/")).toBe("/");
      expect(classifier.extractPathPattern("")).toBe("/");
    });

    it("removes trailing slashes", () => {
      expect(classifier.extractPathPattern("/products/")).toBe("/products");
    });

    it("collapses consecutive wildcards", () => {
      expect(classifier.extractPathPattern("/blog/2024/01/02")).toBe("/blog/*");
    });
  });

  describe("YMYL detection", () => {
    it("correctly identifies YMYL verticals", () => {
      // Healthcare YMYL
      const healthcareResult = classifier.classifyHeuristic(
        createMedicalSchemaHtml(),
        "/clinic"
      );
      expect(healthcareResult!.isYmyl).toBe(true);

      // Legal YMYL
      const legalResult = classifier.classifyHeuristic(
        createLegalServiceSchemaHtml(),
        "/law"
      );
      expect(legalResult!.isYmyl).toBe(true);

      // Ecommerce NOT YMYL
      const ecommerceResult = classifier.classifyHeuristic(
        createProductSchemaHtml(),
        "/product"
      );
      expect(ecommerceResult!.isYmyl).toBe(false);
    });
  });
});
