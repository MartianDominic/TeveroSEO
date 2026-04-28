/**
 * Tests for AI-powered business information extraction.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractBusinessInfo } from "./businessExtractor";
import type { PageAnalysis } from "@/server/lib/audit/types";

// Mock Anthropic SDK
const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn(() => ({
      messages: {
        create: mockCreate,
      },
    })),
  };
});

describe("extractBusinessInfo", () => {
  const mockPages: PageAnalysis[] = [
    {
      url: "https://example.com",
      statusCode: 200,
      redirectUrl: null,
      responseTimeMs: 150,
      title: "Best HVAC Services in Los Angeles - AC Repair & Installation",
      metaDescription:
        "Professional HVAC services for homes and businesses. 24/7 emergency repair, AC installation, heating systems. Serving LA County.",
      canonical: "https://example.com",
      robotsMeta: null,
      ogTitle: "Best HVAC Services in Los Angeles",
      ogDescription: "Professional heating and cooling solutions",
      ogImage: null,
      h1s: [
        "Professional HVAC Services",
        "Residential & Commercial Solutions",
      ],
      headingOrder: [1, 2, 3],
      wordCount: 450,
      images: [],
      internalLinks: ["/services", "/about", "/contact"],
      externalLinks: [],
      hasStructuredData: true,
      hreflangTags: [],
    },
    {
      url: "https://example.com/services",
      statusCode: 200,
      redirectUrl: null,
      responseTimeMs: 120,
      title: "Our HVAC Services - Carrier & Trane Systems",
      metaDescription:
        "AC repair, furnace installation, duct cleaning, maintenance plans for residential and commercial properties.",
      canonical: "https://example.com/services",
      robotsMeta: null,
      ogTitle: null,
      ogDescription: null,
      ogImage: null,
      h1s: ["Our Services", "Carrier Systems", "Trane Systems"],
      headingOrder: [1, 2, 2],
      wordCount: 320,
      images: [],
      internalLinks: ["/", "/contact"],
      externalLinks: [],
      hasStructuredData: false,
      hreflangTags: [],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Set API key for tests
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  it("should extract products array from scraped content", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            products: ["AC Units", "Furnaces", "Heat Pumps"],
            brands: ["Carrier", "Trane"],
            services: [
              "AC Repair",
              "Installation",
              "Duct Cleaning",
              "Maintenance",
            ],
            location: "Los Angeles County, CA",
            targetMarket: "both",
            summary:
              "Professional HVAC company offering AC and heating services for residential and commercial properties in Los Angeles.",
            confidence: 0.85,
          }),
        },
      ],
    });

    const result = await extractBusinessInfo(mockPages, "example.com");

    expect(result.products).toBeInstanceOf(Array);
    expect(result.products.length).toBeGreaterThan(0);
    expect(result.products).toContain("AC Units");
  });

  it("should identify brand names", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            products: ["AC Units"],
            brands: ["Carrier", "Trane"],
            services: ["AC Repair"],
            location: "Los Angeles, CA",
            targetMarket: "both",
            summary: "HVAC services with Carrier and Trane products.",
            confidence: 0.8,
          }),
        },
      ],
    });

    const result = await extractBusinessInfo(mockPages, "example.com");

    expect(result.brands).toBeInstanceOf(Array);
    expect(result.brands).toContain("Carrier");
    expect(result.brands).toContain("Trane");
  });

  it("should detect services offered", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            products: [],
            brands: [],
            services: [
              "AC Repair",
              "Installation",
              "Duct Cleaning",
              "Maintenance",
            ],
            location: "Los Angeles, CA",
            targetMarket: "residential",
            summary: "HVAC repair and installation services.",
            confidence: 0.75,
          }),
        },
      ],
    });

    const result = await extractBusinessInfo(mockPages, "example.com");

    expect(result.services).toBeInstanceOf(Array);
    expect(result.services.length).toBeGreaterThan(0);
    expect(result.services).toContain("AC Repair");
  });

  it("should extract location", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            products: [],
            brands: [],
            services: ["HVAC Services"],
            location: "Los Angeles County, CA",
            targetMarket: "both",
            summary: "Local HVAC company in LA County.",
            confidence: 0.9,
          }),
        },
      ],
    });

    const result = await extractBusinessInfo(mockPages, "example.com");

    expect(result.location).toBe("Los Angeles County, CA");
  });

  it("should handle empty content gracefully", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            products: [],
            brands: [],
            services: [],
            location: null,
            targetMarket: null,
            summary: "Unable to extract business information.",
            confidence: 0.1,
          }),
        },
      ],
    });

    const emptyPages: PageAnalysis[] = [
      {
        url: "https://example.com",
        statusCode: 200,
        redirectUrl: null,
        responseTimeMs: 100,
        title: "",
        metaDescription: "",
        canonical: null,
        robotsMeta: null,
        ogTitle: null,
        ogDescription: null,
        ogImage: null,
        h1s: [],
        headingOrder: [],
        wordCount: 0,
        images: [],
        internalLinks: [],
        externalLinks: [],
        hasStructuredData: false,
        hreflangTags: [],
      },
    ];

    const result = await extractBusinessInfo(emptyPages, "example.com");

    expect(result.products).toEqual([]);
    expect(result.brands).toEqual([]);
    expect(result.services).toEqual([]);
    expect(result.location).toBeNull();
    expect(result.confidence).toBeLessThan(0.5);
  });

  it("should return confidence score", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            products: ["AC Units"],
            brands: ["Carrier"],
            services: ["AC Repair"],
            location: "Los Angeles, CA",
            targetMarket: "residential",
            summary: "HVAC services.",
            confidence: 0.85,
          }),
        },
      ],
    });

    const result = await extractBusinessInfo(mockPages, "example.com");

    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(typeof result.confidence).toBe("number");
  });

  describe("error scenarios", () => {
    it("should return empty result with confidence=0 when ANTHROPIC_API_KEY is not set", async () => {
      // Remove API key
      delete process.env.ANTHROPIC_API_KEY;

      const result = await extractBusinessInfo(mockPages, "example.com");

      expect(result.products).toEqual([]);
      expect(result.brands).toEqual([]);
      expect(result.services).toEqual([]);
      expect(result.location).toBeNull();
      expect(result.targetMarket).toBeNull();
      expect(result.summary).toBe("API key not configured");
      expect(result.confidence).toBe(0);
      // Verify API was never called
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("should return empty result when Claude returns invalid JSON", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: "This is not valid JSON { broken",
          },
        ],
      });

      const result = await extractBusinessInfo(mockPages, "example.com");

      expect(result.products).toEqual([]);
      expect(result.brands).toEqual([]);
      expect(result.services).toEqual([]);
      expect(result.location).toBeNull();
      expect(result.targetMarket).toBeNull();
      expect(result.summary).toBe("Failed to extract business information");
      expect(result.confidence).toBe(0);
    });

    it("should return empty result when response fails Zod validation", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              products: ["AC Units"],
              brands: ["Carrier"],
              services: ["AC Repair"],
              location: "Los Angeles, CA",
              targetMarket: "residential",
              summary: "HVAC services.",
              confidence: 1.5, // Invalid: confidence must be 0-1
            }),
          },
        ],
      });

      const result = await extractBusinessInfo(mockPages, "example.com");

      expect(result.products).toEqual([]);
      expect(result.brands).toEqual([]);
      expect(result.services).toEqual([]);
      expect(result.location).toBeNull();
      expect(result.targetMarket).toBeNull();
      expect(result.summary).toBe("Failed to extract business information");
      expect(result.confidence).toBe(0);
    });

    it("should return empty result when response has missing required fields", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              // Missing products, brands, services, summary, confidence
              location: "Los Angeles, CA",
              targetMarket: "residential",
            }),
          },
        ],
      });

      const result = await extractBusinessInfo(mockPages, "example.com");

      expect(result.products).toEqual([]);
      expect(result.brands).toEqual([]);
      expect(result.services).toEqual([]);
      expect(result.summary).toBe("Failed to extract business information");
      expect(result.confidence).toBe(0);
    });
  });
});
