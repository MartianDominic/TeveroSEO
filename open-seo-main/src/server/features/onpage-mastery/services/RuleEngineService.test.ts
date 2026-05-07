/**
 * RuleEngineService Tests
 * Phase 92-04: RuleEngineService
 *
 * Tests scorecard evaluation, rule hierarchy, and client overrides.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock db module BEFORE importing RuleEngineService
vi.mock("@/db", () => ({
  db: {},
  seoRuleWeights: {
    clientId: "client_id",
    ruleId: "rule_id",
    weight: "weight",
    enabled: "enabled",
    updatedAt: "updated_at",
  },
}));

import { RuleEngineService } from "./RuleEngineService";
import type { OnPageMasteryContext } from "../types";

/**
 * Create minimal valid HTML for testing.
 */
function createHealthcareHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Understanding Diabetes - Health Guide</title>
  <meta name="description" content="A comprehensive guide to understanding diabetes, its symptoms, and treatment options.">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="canonical" href="https://health.example.com/diabetes">
</head>
<body>
  <main>
    <h1>Understanding Diabetes: A Complete Guide</h1>
    <p class="byline">By <span class="author">Dr. Jane Smith, MD</span></p>
    <p class="review">Medically reviewed by Dr. John Doe, Endocrinologist</p>
    <time datetime="2024-01-15">Updated January 15, 2024</time>

    <h2>What is Diabetes?</h2>
    <p>Diabetes is a chronic health condition affecting how your body turns food into energy. ${Array(200).fill("content word").join(" ")}</p>

    <h2>Types of Diabetes</h2>
    <p>There are several types of diabetes, each with distinct causes. ${Array(200).fill("more content").join(" ")}</p>
    <ul>
      <li>Type 1 Diabetes</li>
      <li>Type 2 Diabetes</li>
      <li>Gestational Diabetes</li>
    </ul>

    <h2>Symptoms and Diagnosis</h2>
    <p>Common symptoms include increased thirst and frequent urination. ${Array(150).fill("symptom info").join(" ")}</p>

    <h2>Treatment Options</h2>
    <p>Treatment depends on the type and severity. ${Array(150).fill("treatment info").join(" ")}</p>
    <p>According to <a href="https://nih.gov/diabetes">NIH</a> and <a href="https://cdc.gov/diabetes">CDC</a>, early intervention is key.</p>

    <p><strong>Disclaimer:</strong> This content is for informational purposes only and is not intended to be a substitute for professional medical advice. Consult your healthcare provider.</p>

    <script type="application/ld+json">
    {"@type": "MedicalWebPage", "name": "Diabetes Guide"}
    </script>
  </main>
  <footer>
    <a href="/privacy">Privacy Policy</a>
    <a href="/contact">Contact Us</a>
  </footer>
</body>
</html>`;
}

function createEcommerceHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Premium Widget - Shop Now</title>
  <meta name="description" content="Buy the premium widget with free shipping.">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="canonical" href="https://shop.example.com/widget">
</head>
<body>
  <main>
    <h1>Premium Widget</h1>
    <p class="price">$49.99</p>
    <p class="description">${Array(100).fill("product description word").join(" ")}</p>

    <h2>Features</h2>
    <ul>
      <li>Feature 1</li>
      <li>Feature 2</li>
    </ul>

    <button class="add-to-cart">Add to Cart</button>

    <img src="/product.jpg" alt="Premium Widget product image" class="product-image">
    <img src="/product-2.jpg" alt="Widget side view" class="product-image">

    <div class="reviews">
      <span itemprop="aggregateRating">4.5 stars (120 reviews)</span>
    </div>

    <p class="shipping">Free shipping on orders over $50</p>

    <script type="application/ld+json">
    {"@type": "Product", "name": "Premium Widget", "offers": {"@type": "Offer", "price": "49.99", "availability": "InStock"}}
    </script>
  </main>
</body>
</html>`;
}

/**
 * Create test context from HTML.
 */
function createContext(
  html: string,
  overrides: Partial<OnPageMasteryContext> = {}
): OnPageMasteryContext {
  return {
    url: overrides.url ?? "https://example.com/test",
    html,
    vertical: overrides.vertical ?? "general",
    isYmyl: overrides.isYmyl ?? false,
    clientId: overrides.clientId ?? "test-client-123",
    pageId: overrides.pageId,
  };
}

/**
 * Create a mock DB with configurable overrides.
 */
function createMockDb(overrides: Array<{ ruleId: string; weight: number; enabled: boolean }> = []) {
  const mockWhere = vi.fn().mockResolvedValue(overrides);
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
  const mockOnConflictDoUpdate = vi.fn().mockResolvedValue({});
  const mockValues = vi.fn().mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
  const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

  return {
    select: mockSelect,
    from: mockFrom,
    where: mockWhere,
    insert: mockInsert,
    values: mockValues,
    onConflictDoUpdate: mockOnConflictDoUpdate,
  };
}

describe("RuleEngineService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("evaluateScorecard", () => {
    it("returns score 0-100 with passed/failed rules", async () => {
      const mockDb = createMockDb([]);
      const service = new RuleEngineService(mockDb as never);

      const html = createHealthcareHtml();
      const ctx = createContext(html, { vertical: "healthcare", isYmyl: true });

      const result = await service.evaluateScorecard(ctx);

      expect(result).toHaveProperty("score");
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result).toHaveProperty("passedRules");
      expect(result).toHaveProperty("failedRules");
      expect(Array.isArray(result.passedRules)).toBe(true);
      expect(Array.isArray(result.failedRules)).toBe(true);
    });

    it("applies YMYL threshold of 85 for healthcare vertical", async () => {
      const mockDb = createMockDb([]);
      const service = new RuleEngineService(mockDb as never);

      const html = createHealthcareHtml();
      const ctx = createContext(html, { vertical: "healthcare", isYmyl: true });

      const result = await service.evaluateScorecard(ctx);

      // Healthcare is YMYL, so threshold is 85
      expect(result.isYmyl).toBe(true);
      // If score >= 85, passed should be true; if < 85, passed should be false
      expect(result.passed).toBe(result.score >= 85);
    });

    it("applies non-YMYL threshold of 70 for ecommerce vertical", async () => {
      const mockDb = createMockDb([]);
      const service = new RuleEngineService(mockDb as never);

      const html = createEcommerceHtml();
      const ctx = createContext(html, { vertical: "ecommerce", isYmyl: false });

      const result = await service.evaluateScorecard(ctx);

      // Ecommerce is not YMYL, so threshold is 70
      expect(result.isYmyl).toBe(false);
      expect(result.passed).toBe(result.score >= 70);
    });

    it("includes vertical in result", async () => {
      const mockDb = createMockDb([]);
      const service = new RuleEngineService(mockDb as never);

      const html = createHealthcareHtml();
      const ctx = createContext(html, { vertical: "healthcare", isYmyl: true });

      const result = await service.evaluateScorecard(ctx);

      expect(result.vertical).toBe("healthcare");
    });

    it("calculates weighted score based on rule weights", async () => {
      const mockDb = createMockDb([]);
      const service = new RuleEngineService(mockDb as never);

      const html = createHealthcareHtml();
      const ctx = createContext(html, { vertical: "healthcare", isYmyl: true });

      const result = await service.evaluateScorecard(ctx);

      // Should have weight information
      expect(result).toHaveProperty("totalWeight");
      expect(result).toHaveProperty("achievedWeight");
      expect(result.totalWeight).toBeGreaterThan(0);
    });
  });

  describe("client overrides", () => {
    it("disables rule when enabled=false in client override", async () => {
      // Mock client override that disables R-01 (Single H1)
      const mockDb = createMockDb([
        { ruleId: "R-01", weight: 1.0, enabled: false },
      ]);
      const service = new RuleEngineService(mockDb as never);

      const html = `<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body>
        <h1>First</h1><h1>Second</h1><p>${Array(500).fill("word").join(" ")}</p>
      </body></html>`;
      const ctx = createContext(html, { vertical: "general", isYmyl: false });

      const result = await service.evaluateScorecard(ctx);

      // R-01 should not appear in either passed or failed since it's disabled
      const r01InPassed = result.passedRules.find((r) => r.id === "R-01");
      const r01InFailed = result.failedRules.find((r) => r.id === "R-01");
      expect(r01InPassed).toBeUndefined();
      expect(r01InFailed).toBeUndefined();
    });

    it("changes weight when weight != 1.0 in client override", async () => {
      // Mock client override that changes weight of R-01 to 3.0
      const mockDb = createMockDb([
        { ruleId: "R-01", weight: 3.0, enabled: true },
      ]);
      const service = new RuleEngineService(mockDb as never);

      const html = `<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body>
        <h1>Single H1</h1><p>${Array(500).fill("word").join(" ")}</p>
      </body></html>`;
      const ctx = createContext(html, { vertical: "general", isYmyl: false });

      const result = await service.evaluateScorecard(ctx);

      // Find R-01 in passed rules and verify weight is 3.0
      const r01 = result.passedRules.find((r) => r.id === "R-01");
      expect(r01).toBeDefined();
      expect(r01?.weight).toBe(3.0);
    });

    it("uses default weight when rule has no client override", async () => {
      // No client overrides
      const mockDb = createMockDb([]);
      const service = new RuleEngineService(mockDb as never);

      const html = createHealthcareHtml();
      const ctx = createContext(html, { vertical: "healthcare", isYmyl: true });

      const result = await service.evaluateScorecard(ctx);

      // R-01 should use default weight (1.5 from universal rules)
      const r01 =
        result.passedRules.find((r) => r.id === "R-01") ||
        result.failedRules.find((r) => r.id === "R-01");
      expect(r01).toBeDefined();
      expect(r01?.weight).toBe(1.5); // Default from universal.ts
    });
  });

  describe("merge hierarchy", () => {
    it("applies Universal < Vertical < Client order", async () => {
      // Healthcare has R-HC-01 with default weight 3.0
      // Client overrides R-HC-01 to weight 5.0
      const mockDb = createMockDb([
        { ruleId: "R-HC-01", weight: 5.0, enabled: true },
      ]);
      const service = new RuleEngineService(mockDb as never);

      const html = createHealthcareHtml();
      const ctx = createContext(html, { vertical: "healthcare", isYmyl: true });

      const result = await service.evaluateScorecard(ctx);

      // R-HC-01 should use client override weight of 5.0
      const rhc01 =
        result.passedRules.find((r) => r.id === "R-HC-01") ||
        result.failedRules.find((r) => r.id === "R-HC-01");
      expect(rhc01).toBeDefined();
      expect(rhc01?.weight).toBe(5.0);
    });

    it("includes both universal and vertical rules for YMYL vertical", async () => {
      const mockDb = createMockDb([]);
      const service = new RuleEngineService(mockDb as never);

      const html = createHealthcareHtml();
      const ctx = createContext(html, { vertical: "healthcare", isYmyl: true });

      const result = await service.evaluateScorecard(ctx);

      // Should have universal rules (R-01, R-09, etc.)
      const allRuleIds = [
        ...result.passedRules.map((r) => r.id),
        ...result.failedRules.map((r) => r.id),
      ];
      expect(allRuleIds).toContain("R-01"); // Universal
      expect(allRuleIds).toContain("R-09"); // Universal

      // Should have healthcare-specific rules (R-HC-01, etc.)
      expect(allRuleIds.some((id) => id.startsWith("R-HC"))).toBe(true);
    });
  });

  describe("getRulesForVertical", () => {
    it("returns rules with override status", async () => {
      const mockDb = createMockDb([
        { ruleId: "R-01", weight: 2.0, enabled: true },
      ]);
      const service = new RuleEngineService(mockDb as never);

      const rules = await service.getRulesForVertical("healthcare", "client-123");

      expect(Array.isArray(rules)).toBe(true);
      expect(rules.length).toBeGreaterThan(0);

      // Find R-01 and check it's marked as overridden
      const r01 = rules.find((r) => r.rule.id === "R-01");
      expect(r01).toBeDefined();
      expect(r01?.isOverridden).toBe(true);
      expect(r01?.weight).toBe(2.0);
    });

    it("returns rules without override when no clientId provided", async () => {
      const mockDb = createMockDb([]);
      const service = new RuleEngineService(mockDb as never);

      const rules = await service.getRulesForVertical("general");

      expect(Array.isArray(rules)).toBe(true);
      // All rules should have isOverridden = false
      for (const r of rules) {
        expect(r.isOverridden).toBe(false);
      }
    });
  });

  describe("setRuleOverride", () => {
    it("calls db insert with correct values", async () => {
      const mockDb = createMockDb([]);
      const service = new RuleEngineService(mockDb as never);

      await service.setRuleOverride("client-123", "R-01", 2.5, true);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: "client-123",
          ruleId: "R-01",
          weight: 2.5,
          enabled: true,
        })
      );
    });
  });

  describe("error handling", () => {
    it("handles rule evaluation errors gracefully", async () => {
      const mockDb = createMockDb([]);
      const service = new RuleEngineService(mockDb as never);

      // Create HTML that could cause issues
      const html = `<!DOCTYPE html><html><head></head><body>minimal</body></html>`;
      const ctx = createContext(html, { vertical: "general", isYmyl: false });

      // Should not throw
      const result = await service.evaluateScorecard(ctx);

      expect(result).toHaveProperty("score");
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });
});
