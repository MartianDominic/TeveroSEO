/**
 * Integration Tests for Phase 92: On-Page SEO Mastery
 *
 * Tests the full pipeline: VerticalClassifier -> QualityGateService -> RuleEngineService
 * with mocked LLM/embedding responses for deterministic results.
 *
 * Requirements:
 * - OPM-20: All services have unit tests with 80%+ coverage
 * - Integration test validates full audit pipeline with Tier 5
 * - Test fixtures cover all 13 verticals
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock all external dependencies before imports

// Mock OpenAI SDK
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

// Mock EmbeddingService
vi.mock("@/server/features/keywords/services/EmbeddingService", () => ({
  getEmbeddingService: vi.fn().mockReturnValue({
    embedQuery: vi.fn().mockResolvedValue(new Float32Array(256).fill(0.5)),
    embedPassages: vi.fn().mockImplementation((texts: string[]) =>
      Promise.resolve(texts.map(() => new Float32Array(256).fill(0.5)))
    ),
  }),
  cosineSimilarity: vi.fn().mockReturnValue(0.65),
}));

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
  seoRuleWeights: {
    clientId: "client_id",
    ruleId: "rule_id",
    weight: "weight",
    enabled: "enabled",
    updatedAt: "updated_at",
  },
}));

// Mock logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  VerticalClassifier,
  resetVerticalClassifierService,
} from "./services/VerticalClassifier";
import {
  QualityGateService,
  resetQualityGateService,
} from "./services/QualityGateService";
import { RuleEngineService } from "./services/RuleEngineService";
import type { OnPageMasteryContext, Vertical } from "./types";

// ============================================================================
// Test HTML Fixtures
// ============================================================================

const HEALTHCARE_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Understanding Diabetes - Medical Guide</title>
  <meta name="description" content="Comprehensive guide to diabetes management">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "MedicalOrganization",
    "name": "Health Clinic"
  }
  </script>
</head>
<body>
  <main>
    <h1>Understanding Diabetes Treatment Options</h1>
    <p class="byline">By <span class="author">Dr. Jane Smith, MD</span></p>
    <time datetime="2026-01-15">January 15, 2026</time>

    <h2>Medication Options</h2>
    <p>According to the CDC, 37.3 million Americans have diabetes. The American Diabetes Association recommends regular monitoring and medication compliance. In a 2025 clinical trial of 5,000 patients, metformin reduced HbA1c by 1.2% on average. Dr. Robert Chen, endocrinologist at Mayo Clinic, confirms these findings.</p>
    <p>${Array(150).fill("Medical content about diabetes treatment options and research.").join(" ")}</p>

    <h2>Lifestyle Changes</h2>
    <p>Research from Harvard Medical School shows that diet modifications can reduce HbA1c by 1.5%. A 2024 study in the New England Journal of Medicine found that 30 minutes of daily exercise reduced complications by 40%.</p>
    <p>${Array(150).fill("Lifestyle modification guidance for diabetes patients.").join(" ")}</p>

    <p class="disclaimer"><strong>Disclaimer:</strong> This content is for informational purposes only and not a substitute for professional medical advice.</p>

    <p>Sources: <a href="https://cdc.gov/diabetes">CDC</a>, <a href="https://nih.gov/diabetes">NIH</a></p>
  </main>
</body>
</html>
`;

const ECOMMERCE_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Widget Pro - Professional Grade Tool</title>
  <meta name="description" content="Buy Widget Pro for $99.99 with free shipping">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Widget Pro",
    "offers": {"@type": "Offer", "price": "99.99", "availability": "InStock"}
  }
  </script>
</head>
<body>
  <main>
    <h1>Widget Pro - Professional Grade Tool</h1>
    <p class="price">$99.99</p>
    <button class="add-to-cart">Add to Cart</button>

    <h2>Product Features</h2>
    <ul>
      <li>Feature 1: 50% more durable than competitors</li>
      <li>Feature 2: 3-year warranty included</li>
      <li>Feature 3: Made from aircraft-grade aluminum</li>
    </ul>

    <h2>Customer Reviews</h2>
    <div class="reviews">
      <span itemprop="aggregateRating">4.8 stars from 1,247 verified reviews</span>
    </div>

    <img src="/product.jpg" alt="Widget Pro product image">
    <p class="shipping">Free shipping on orders over $50</p>
    <p>${Array(100).fill("Product description with features and specifications.").join(" ")}</p>
  </main>
</body>
</html>
`;

const THIN_CONTENT_HTML = `
<!DOCTYPE html>
<html lang="en">
<head><title>Short Article</title></head>
<body>
  <h1>Very Short Article</h1>
  <p>This is a very short article with minimal content that should fail thin content detection.</p>
</body>
</html>
`;

const SAAS_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <title>CloudSync - Enterprise File Sync Solution</title>
  <meta name="description" content="Sync files across your organization securely">
</head>
<body>
  <main>
    <h1>CloudSync: Enterprise File Synchronization</h1>

    <h2>Why CloudSync?</h2>
    <p>CloudSync reduced deployment time by 73% for Fortune 500 companies. In Q4 2025, we processed 2.3 billion file sync operations with 99.99% uptime. Our SOC 2 Type II certification ensures enterprise-grade security.</p>

    <h2>Features</h2>
    <ul>
      <li>Real-time sync across 10,000+ endpoints</li>
      <li>End-to-end encryption (AES-256)</li>
      <li>Integration with Slack, Teams, and 50+ tools</li>
    </ul>

    <h2>Pricing</h2>
    <p>Starter: $10/user/month. Professional: $25/user/month. Enterprise: Contact sales.</p>

    <p>${Array(200).fill("Enterprise software features and capabilities.").join(" ")}</p>
  </main>
</body>
</html>
`;

const LEGAL_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <title>Johnson & Associates - Personal Injury Attorneys</title>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "LegalService",
    "name": "Johnson & Associates"
  }
  </script>
</head>
<body>
  <main>
    <h1>Personal Injury Legal Services</h1>
    <p>Our attorneys have recovered over $50 million for clients since 2010.</p>

    <h2>Practice Areas</h2>
    <ul>
      <li>Car Accidents - 95% success rate</li>
      <li>Medical Malpractice</li>
      <li>Workplace Injuries</li>
    </ul>

    <h2>Our Team</h2>
    <p>Bar-certified attorneys with 20+ years combined experience.</p>

    <p><strong>Disclaimer:</strong> Past results do not guarantee future outcomes. Each case is unique.</p>

    <p>${Array(200).fill("Legal services and case information.").join(" ")}</p>
  </main>
</body>
</html>
`;

// ============================================================================
// Mock DB Helper
// ============================================================================

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

// ============================================================================
// Integration Tests
// ============================================================================

describe("On-Page Mastery Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetVerticalClassifierService();
    resetQualityGateService();
    process.env.XAI_API_KEY = "test-api-key";

    // Default LLM mock response
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              vertical: "saas",
              confidence: 0.88,
              reasoning: "SaaS product page detected",
              score: 75,
              passed: true,
            }),
          },
        },
      ],
    });
  });

  afterEach(() => {
    delete process.env.XAI_API_KEY;
  });

  describe("Full Pipeline", () => {
    it("classifies healthcare content, evaluates quality gates, and scores with rules", async () => {
      const classifier = new VerticalClassifier();
      const gateService = new QualityGateService(undefined, { tier: "basic" });
      const mockDb = createMockDb([]);
      const ruleEngine = new RuleEngineService(mockDb as never);

      // Step 1: Classify vertical (should use heuristics - MedicalOrganization schema)
      const classification = classifier.classifyHeuristic(HEALTHCARE_HTML, "/conditions/diabetes");

      expect(classification).not.toBeNull();
      expect(classification!.vertical).toBe("healthcare");
      expect(classification!.isYmyl).toBe(true);
      expect(classification!.method).toBe("schema");
      expect(classification!.confidence).toBe(0.95);

      // Step 2: Evaluate quality gates
      const gateResults = await gateService.evaluateAll(
        HEALTHCARE_HTML,
        classification!.vertical,
        []
      );

      expect(gateResults).toHaveProperty("overallScore");
      expect(gateResults).toHaveProperty("results");
      expect(gateResults.results).toHaveProperty("T5-04");
      expect(gateResults.results).toHaveProperty("T5-06");
      expect(gateResults.results).toHaveProperty("T5-07");

      // Step 3: Evaluate scorecard
      const ctx: OnPageMasteryContext = {
        url: "https://healthclinic.com/conditions/diabetes",
        html: HEALTHCARE_HTML,
        vertical: classification!.vertical,
        isYmyl: classification!.isYmyl,
        clientId: "client-1",
      };

      const scorecard = await ruleEngine.evaluateScorecard(ctx);

      expect(scorecard.score).toBeGreaterThanOrEqual(0);
      expect(scorecard.score).toBeLessThanOrEqual(100);
      expect(scorecard.vertical).toBe("healthcare");
      expect(scorecard.isYmyl).toBe(true);
      expect(Array.isArray(scorecard.passedRules)).toBe(true);
      expect(Array.isArray(scorecard.failedRules)).toBe(true);
    });

    it("detects thin content and includes it in blocking failures", async () => {
      const gateService = new QualityGateService(undefined, { tier: "basic" });

      const results = await gateService.evaluateAll(THIN_CONTENT_HTML, "general", []);

      expect(results.results["T5-06"].passed).toBe(false);
      expect(results.blockingFailures).toContain("T5-06");
      expect(results.passed).toBe(false);
    });

    it("processes ecommerce page with Product schema", async () => {
      const classifier = new VerticalClassifier();

      const classification = classifier.classifyHeuristic(ECOMMERCE_HTML, "/product/widget-pro");

      expect(classification).not.toBeNull();
      expect(classification!.vertical).toBe("ecommerce");
      expect(classification!.isYmyl).toBe(false);
      expect(classification!.method).toBe("schema");
    });

    it("processes legal page with LegalService schema", async () => {
      const classifier = new VerticalClassifier();

      const classification = classifier.classifyHeuristic(LEGAL_HTML, "/services");

      expect(classification).not.toBeNull();
      expect(classification!.vertical).toBe("legal");
      expect(classification!.isYmyl).toBe(true);
      expect(classification!.method).toBe("schema");
    });

    it("falls back to LLM for ambiguous content", async () => {
      const classifier = new VerticalClassifier();

      // SaaS page without schema - should fall back to LLM
      const heuristicResult = classifier.classifyHeuristic(SAAS_HTML, "/features");

      // Heuristics may detect via URL pattern or keywords, or return null
      // If null, LLM fallback would be used in full classify() call
      if (heuristicResult === null) {
        // Mock LLM response for SaaS
        mockCreate.mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  vertical: "saas",
                  confidence: 0.85,
                  reasoning: "Enterprise software page with pricing",
                }),
              },
            },
          ],
        });

        const llmResult = await classifier.classifyLLM(SAAS_HTML, "/features");
        expect(llmResult.vertical).toBe("saas");
        expect(llmResult.method).toBe("llm");
      }
    });
  });

  describe("Vertical Coverage", () => {
    const allVerticals: Vertical[] = [
      "healthcare",
      "legal",
      "financial",
      "ecommerce",
      "saas",
      "real_estate",
      "home_services",
      "hospitality",
      "education",
      "professional",
      "manufacturing",
      "nonprofit",
      "general",
    ];

    it.each(allVerticals)("handles %s vertical in quality gate evaluation", async (vertical) => {
      const gateService = new QualityGateService(undefined, { tier: "basic" });
      const content = "word ".repeat(500);

      const result = await gateService.evaluateAll(content, vertical, []);

      expect(result).toHaveProperty("overallScore");
      expect(result).toHaveProperty("results");
      expect(result).toHaveProperty("passed");
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
    });

    it.each(allVerticals)("handles %s vertical in rule engine evaluation", async (vertical) => {
      const mockDb = createMockDb([]);
      const ruleEngine = new RuleEngineService(mockDb as never);

      const isYmyl = ["healthcare", "legal", "financial"].includes(vertical);
      const html = `<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body>
        <h1>Test Heading</h1>
        <p>${Array(500).fill("Content word").join(" ")}</p>
      </body></html>`;

      const ctx: OnPageMasteryContext = {
        url: `https://example.com/${vertical}`,
        html,
        vertical,
        isYmyl,
        clientId: "test-client",
      };

      const result = await ruleEngine.evaluateScorecard(ctx);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.vertical).toBe(vertical);
    });
  });

  describe("YMYL Handling", () => {
    it("applies stricter thresholds for YMYL verticals", async () => {
      const mockDb = createMockDb([]);
      const ruleEngine = new RuleEngineService(mockDb as never);

      const healthcareCtx: OnPageMasteryContext = {
        url: "https://health.example.com/guide",
        html: HEALTHCARE_HTML,
        vertical: "healthcare",
        isYmyl: true,
        clientId: "client-1",
      };

      const ecommerceCtx: OnPageMasteryContext = {
        url: "https://shop.example.com/product",
        html: ECOMMERCE_HTML,
        vertical: "ecommerce",
        isYmyl: false,
        clientId: "client-1",
      };

      const healthcareResult = await ruleEngine.evaluateScorecard(healthcareCtx);
      const ecommerceResult = await ruleEngine.evaluateScorecard(ecommerceCtx);

      // Healthcare (YMYL) should use 85 threshold
      expect(healthcareResult.isYmyl).toBe(true);
      expect(healthcareResult.passed).toBe(healthcareResult.score >= 85);

      // Ecommerce (non-YMYL) should use 70 threshold
      expect(ecommerceResult.isYmyl).toBe(false);
      expect(ecommerceResult.passed).toBe(ecommerceResult.score >= 70);
    });

    it("applies higher word count threshold for YMYL in thin content check", async () => {
      const gateService = new QualityGateService(undefined, { tier: "basic" });
      const content500Words = "word ".repeat(500);

      const healthcareResult = await gateService.evaluateAll(content500Words, "healthcare", []);
      const generalResult = await gateService.evaluateAll(content500Words, "general", []);

      // 500 words: passes general (400 min), fails healthcare (800 min)
      expect(healthcareResult.results["T5-06"].passed).toBe(false);
      expect(generalResult.results["T5-06"].passed).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("handles missing API key gracefully", () => {
      delete process.env.XAI_API_KEY;

      expect(() => new VerticalClassifier()).toThrow("XAI_API_KEY not configured");
      expect(() => new QualityGateService()).toThrow("XAI_API_KEY not configured");
    });

    it("handles malformed HTML without crashing", async () => {
      const mockDb = createMockDb([]);
      const ruleEngine = new RuleEngineService(mockDb as never);

      const malformedHtml = "<html><body><h1>Unclosed";

      const ctx: OnPageMasteryContext = {
        url: "https://example.com/test",
        html: malformedHtml,
        vertical: "general",
        isYmyl: false,
        clientId: "client-1",
      };

      // Should not throw
      const result = await ruleEngine.evaluateScorecard(ctx);
      expect(result).toHaveProperty("score");
    });

    it("handles empty content gracefully", async () => {
      const gateService = new QualityGateService(undefined, { tier: "basic" });

      const result = await gateService.evaluateAll("", "general", []);

      expect(result).toHaveProperty("overallScore");
      expect(result.results["T5-06"].passed).toBe(false);
    });
  });

  describe("Client Override Integration", () => {
    it("respects client rule overrides in full pipeline", async () => {
      // Client disables R-01 (Single H1 check)
      const mockDb = createMockDb([
        { ruleId: "R-01", weight: 1.0, enabled: false },
      ]);
      const ruleEngine = new RuleEngineService(mockDb as never);

      const htmlWithMultipleH1 = `<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body>
        <h1>First H1</h1>
        <h1>Second H1</h1>
        <p>${Array(500).fill("Content").join(" ")}</p>
      </body></html>`;

      const ctx: OnPageMasteryContext = {
        url: "https://example.com/test",
        html: htmlWithMultipleH1,
        vertical: "general",
        isYmyl: false,
        clientId: "client-with-override",
      };

      const result = await ruleEngine.evaluateScorecard(ctx);

      // R-01 should not appear since it's disabled
      const allRuleIds = [
        ...result.passedRules.map((r) => r.id),
        ...result.failedRules.map((r) => r.id),
      ];
      expect(allRuleIds).not.toContain("R-01");
    });

    it("applies custom weight in scoring", async () => {
      // Client sets R-01 weight to 5.0 (default is 1.5)
      const mockDb = createMockDb([
        { ruleId: "R-01", weight: 5.0, enabled: true },
      ]);
      const ruleEngine = new RuleEngineService(mockDb as never);

      const html = `<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body>
        <h1>Single H1</h1>
        <p>${Array(500).fill("Content").join(" ")}</p>
      </body></html>`;

      const ctx: OnPageMasteryContext = {
        url: "https://example.com/test",
        html,
        vertical: "general",
        isYmyl: false,
        clientId: "client-with-weight",
      };

      const result = await ruleEngine.evaluateScorecard(ctx);

      // R-01 should have weight 5.0
      const r01 = result.passedRules.find((r) => r.id === "R-01");
      expect(r01).toBeDefined();
      expect(r01?.weight).toBe(5.0);
    });
  });

  describe("Pipeline Performance", () => {
    it("completes full pipeline evaluation in reasonable time", async () => {
      const classifier = new VerticalClassifier();
      const gateService = new QualityGateService(undefined, { tier: "basic" });
      const mockDb = createMockDb([]);
      const ruleEngine = new RuleEngineService(mockDb as never);

      const start = performance.now();

      // Step 1: Classify
      const classification = classifier.classifyHeuristic(HEALTHCARE_HTML, "/guide");

      // Step 2: Quality gates
      await gateService.evaluateAll(HEALTHCARE_HTML, classification!.vertical, []);

      // Step 3: Scorecard
      const ctx: OnPageMasteryContext = {
        url: "https://example.com/guide",
        html: HEALTHCARE_HTML,
        vertical: classification!.vertical,
        isYmyl: classification!.isYmyl,
        clientId: "client-1",
      };
      await ruleEngine.evaluateScorecard(ctx);

      const duration = performance.now() - start;

      // Full pipeline should complete in under 500ms with mocked dependencies
      expect(duration).toBeLessThan(500);
    });
  });
});
