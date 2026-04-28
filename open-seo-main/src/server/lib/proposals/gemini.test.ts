/**
 * Tests for Gemini AI client and Lithuanian proposal generation.
 * Phase 30-02: AI Lithuanian Generation
 *
 * TDD: Tests written FIRST before implementation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the Google Generative AI SDK
const mockGenerateContent = vi.fn();
const mockGetGenerativeModel = vi.fn(() => ({
  generateContent: mockGenerateContent,
}));

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

// Mock logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock redis for rate limiting
const mockRedisGet = vi.fn();
const mockRedisSetex = vi.fn();
const mockRedisIncr = vi.fn();
const mockRedisExpire = vi.fn();

vi.mock("@/server/lib/redis", () => ({
  redis: {
    get: mockRedisGet,
    setex: mockRedisSetex,
    incr: mockRedisIncr,
    expire: mockRedisExpire,
  },
}));

describe("Gemini Client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment
    process.env.GOOGLE_API_KEY = "test-api-key";
    // Default: allow rate limit
    mockRedisGet.mockResolvedValue("10"); // 10 requests this minute
    mockRedisIncr.mockResolvedValue(11);
  });

  afterEach(() => {
    delete process.env.GOOGLE_API_KEY;
  });

  describe("getGeminiClient", () => {
    it("should create a Gemini client singleton", async () => {
      const { getGeminiClient } = await import("./gemini");

      const client = getGeminiClient();

      expect(client).toBeDefined();
    });

    it("should throw if GOOGLE_API_KEY is not set", async () => {
      delete process.env.GOOGLE_API_KEY;

      // Reset module to pick up env change
      vi.resetModules();
      const { getGeminiClient } = await import("./gemini");

      expect(() => getGeminiClient()).toThrow(/GOOGLE_API_KEY/);
    });

    it("should return the same instance on repeated calls", async () => {
      const { getGeminiClient } = await import("./gemini");

      const client1 = getGeminiClient();
      const client2 = getGeminiClient();

      expect(client1).toBe(client2);
    });
  });

  describe("Rate Limiting", () => {
    it("should enforce 60 RPM rate limit", async () => {
      mockRedisGet.mockResolvedValue("60"); // At limit
      mockRedisIncr.mockResolvedValue(61);

      const { checkRateLimit } = await import("./gemini");

      await expect(checkRateLimit()).rejects.toThrow(/rate limit/i);
    });

    it("should allow requests under rate limit", async () => {
      mockRedisGet.mockResolvedValue("30"); // Under limit
      mockRedisIncr.mockResolvedValue(31);

      const { checkRateLimit } = await import("./gemini");

      await expect(checkRateLimit()).resolves.not.toThrow();
    });

    it("should track request counts in Redis", async () => {
      mockRedisGet.mockResolvedValue(null); // First request
      mockRedisIncr.mockResolvedValue(1);

      const { checkRateLimit } = await import("./gemini");
      await checkRateLimit();

      expect(mockRedisIncr).toHaveBeenCalledWith(
        expect.stringContaining("gemini:ratelimit:"),
      );
    });
  });
});

describe("Lithuanian Brand Voice", () => {
  describe("LITHUANIAN_TERMINOLOGY", () => {
    it("should have translations for common SEO terms", async () => {
      const { LITHUANIAN_TERMINOLOGY } = await import("./gemini");

      expect(LITHUANIAN_TERMINOLOGY.keywords).toBe("raktazodziai");
      expect(LITHUANIAN_TERMINOLOGY.organic_traffic).toBe("organinis srautas");
      expect(LITHUANIAN_TERMINOLOGY.conversion_rate).toBe("konversijos rodiklis");
      expect(LITHUANIAN_TERMINOLOGY.domain_authority).toBe("domeno autoritetas");
      expect(LITHUANIAN_TERMINOLOGY.backlinks).toBe("nuorodos");
      expect(LITHUANIAN_TERMINOLOGY.search_volume).toBe("paiesku skaicius");
    });

    it("should keep certain terms in English", async () => {
      const { TERMS_KEEP_ENGLISH } = await import("./gemini");

      expect(TERMS_KEEP_ENGLISH).toContain("SEO");
      expect(TERMS_KEEP_ENGLISH).toContain("ROI");
      expect(TERMS_KEEP_ENGLISH).toContain("CPC");
      expect(TERMS_KEEP_ENGLISH).toContain("Google Search Console");
    });
  });

  describe("FORBIDDEN_PHRASES", () => {
    it("should include forbidden marketing phrases", async () => {
      const { FORBIDDEN_PHRASES } = await import("./gemini");

      expect(FORBIDDEN_PHRASES).toContain("Garantuojame rezultatus");
      expect(FORBIDDEN_PHRASES).toContain("Geriausi specialistai");
      expect(FORBIDDEN_PHRASES).toContain("Unikalus sprendimai");
    });
  });

  describe("TONE_GUIDELINES", () => {
    it("should define formal Jus form as default", async () => {
      const { DEFAULT_TONE_GUIDELINES } = await import("./gemini");

      expect(DEFAULT_TONE_GUIDELINES.formality).toBe("formal");
      expect(DEFAULT_TONE_GUIDELINES.useJusForm).toBe(true);
    });

    it("should define enthusiasm levels", async () => {
      const { ENTHUSIASM_LEVELS } = await import("./gemini");

      expect(ENTHUSIASM_LEVELS).toContain("confident");
      expect(ENTHUSIASM_LEVELS).toContain("enthusiastic");
      expect(ENTHUSIASM_LEVELS).toContain("understated");
    });
  });
});

describe("BrandVoiceConfig", () => {
  it("should validate brand voice config", async () => {
    const { validateBrandVoiceConfig } = await import("./gemini");

    const validConfig = {
      agencyId: "agency-123",
      formality: "formal" as const,
      enthusiasm: "confident" as const,
      customTerminology: {},
      forbiddenPhrases: [],
      customInstructions: "",
    };

    expect(() => validateBrandVoiceConfig(validConfig)).not.toThrow();
  });

  it("should reject invalid formality level", async () => {
    const { validateBrandVoiceConfig } = await import("./gemini");

    const invalidConfig = {
      agencyId: "agency-123",
      formality: "casual" as const, // Not allowed - always formal Jus
      enthusiasm: "confident" as const,
      customTerminology: {},
      forbiddenPhrases: [],
      customInstructions: "",
    };

    expect(() => validateBrandVoiceConfig(invalidConfig as any)).toThrow(
      /formality/i,
    );
  });

  it("should merge custom terminology with defaults", async () => {
    const { buildSystemPrompt } = await import("./gemini");

    const config = {
      agencyId: "agency-123",
      formality: "formal" as const,
      enthusiasm: "confident" as const,
      customTerminology: {
        landing_page: "nukreipimo puslapis",
      },
      forbiddenPhrases: ["Custom forbidden"],
      customInstructions: "Extra agency instructions",
    };

    const prompt = buildSystemPrompt(config);

    expect(prompt).toContain("nukreipimo puslapis");
    expect(prompt).toContain("Custom forbidden");
    expect(prompt).toContain("Extra agency instructions");
  });
});

describe("Segment Prompts", () => {
  const mockProspectData = {
    domain: "example.lt",
    companyName: "Example UAB",
    traffic: 500,
    keywords: 100,
    currentValue: 1500,
    trafficValue: 5000,
    opportunities: [
      {
        keyword: "seo paslaugos",
        searchVolume: 2400,
        difficulty: 45,
        cpc: 3.5,
        opportunityScore: 75,
      },
      {
        keyword: "svetaines optimizavimas",
        searchVolume: 1800,
        difficulty: 35,
        cpc: 2.8,
        opportunityScore: 80,
      },
      {
        keyword: "google reklama",
        searchVolume: 1200,
        difficulty: 55,
        cpc: 4.2,
        opportunityScore: 65,
      },
    ],
    projectedTrafficGain: 1000,
    monthlyFee: 1500,
    setupFee: 2500,
    inclusions: [
      "Techninis SEO auditas",
      "Turinio optimizavimas",
      "Menesiniai reportai",
    ],
  };

  describe("buildHeroPrompt", () => {
    it("should include domain and traffic value", async () => {
      const { buildHeroPrompt } = await import("./gemini");

      const prompt = buildHeroPrompt(mockProspectData);

      expect(prompt).toContain("example.lt");
      expect(prompt).toContain("5000");
      expect(prompt).toContain("JSON");
    });

    it("should request headline and subheadline format", async () => {
      const { buildHeroPrompt } = await import("./gemini");

      const prompt = buildHeroPrompt(mockProspectData);

      expect(prompt).toContain("headline");
      expect(prompt).toContain("subheadline");
    });
  });

  describe("buildCurrentStatePrompt", () => {
    it("should include current metrics", async () => {
      const { buildCurrentStatePrompt } = await import("./gemini");

      const prompt = buildCurrentStatePrompt(mockProspectData);

      expect(prompt).toContain("500"); // traffic
      expect(prompt).toContain("100"); // keywords
      expect(prompt).toContain("1500"); // currentValue
    });
  });

  describe("buildOpportunitiesPrompt", () => {
    it("should include opportunity count and top keywords", async () => {
      const { buildOpportunitiesPrompt } = await import("./gemini");

      const prompt = buildOpportunitiesPrompt(mockProspectData);

      expect(prompt).toContain("3"); // opportunities count
      expect(prompt).toContain("seo paslaugos");
      expect(prompt).toContain("5000"); // trafficValue
    });
  });

  describe("buildRoiPrompt", () => {
    it("should include projected gains and fees", async () => {
      const { buildRoiPrompt } = await import("./gemini");

      const prompt = buildRoiPrompt(mockProspectData);

      expect(prompt).toContain("1000"); // projectedTrafficGain
      expect(prompt).toContain("5000"); // trafficValue
      expect(prompt).toContain("1500"); // monthlyFee
    });
  });

  describe("buildInvestmentPrompt", () => {
    it("should include fees and inclusions", async () => {
      const { buildInvestmentPrompt } = await import("./gemini");

      const prompt = buildInvestmentPrompt(mockProspectData);

      expect(prompt).toContain("2500"); // setupFee
      expect(prompt).toContain("1500"); // monthlyFee
      expect(prompt).toContain("Techninis SEO auditas");
      expect(prompt).toContain("JSON");
    });
  });

  describe("buildNextStepsPrompt", () => {
    it("should request 3 action items as JSON array", async () => {
      const { buildNextStepsPrompt } = await import("./gemini");

      const prompt = buildNextStepsPrompt(mockProspectData);

      expect(prompt).toContain("3");
      expect(prompt).toContain("JSON");
    });
  });
});

describe("Generation Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_API_KEY = "test-api-key";
    mockRedisGet.mockResolvedValue("10");
    mockRedisIncr.mockResolvedValue(11);
  });

  const mockProspectData = {
    domain: "example.lt",
    companyName: "Example UAB",
    traffic: 500,
    keywords: 100,
    currentValue: 1500,
    trafficValue: 5000,
    opportunities: [
      {
        keyword: "seo paslaugos",
        searchVolume: 2400,
        difficulty: 45,
        cpc: 3.5,
        opportunityScore: 75,
      },
    ],
    projectedTrafficGain: 1000,
    monthlyFee: 1500,
    setupFee: 2500,
    inclusions: ["Techninis SEO auditas"],
  };

  describe("generateProposalSegment", () => {
    it("should generate hero segment in Lithuanian", async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              headline: "Jusu svetaine turi 5000 EUR/men. potenciala",
              subheadline: "Radome 3 raktazodzius, kuriais galetumete pritraukti klientu",
            }),
        },
      });

      const { generateProposalSegment } = await import("./gemini");

      const result = await generateProposalSegment("hero", mockProspectData);

      expect(result).toBeDefined();
      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gemini-1.5-pro",
        }),
      );
    });

    it("should generate current_state segment as plain text", async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            "Jusu svetaine siuo metu pritraukia 500 lankytoju per menesi.",
        },
      });

      const { generateProposalSegment } = await import("./gemini");

      const result = await generateProposalSegment("current_state", mockProspectData);

      expect(typeof result).toBe("string");
    });

    it("should apply brand voice config to generation", async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => "Test response",
        },
      });

      const { generateProposalSegment } = await import("./gemini");

      const brandVoice = {
        agencyId: "agency-123",
        formality: "formal" as const,
        enthusiasm: "enthusiastic" as const,
        customTerminology: {},
        forbiddenPhrases: [],
        customInstructions: "Be extra friendly",
      };

      await generateProposalSegment("current_state", mockProspectData, brandVoice);

      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({
          systemInstruction: expect.stringContaining("Be extra friendly"),
        }),
      );
    });

    it("should handle API errors gracefully", async () => {
      mockGenerateContent.mockRejectedValue(new Error("API Error"));

      const { generateProposalSegment } = await import("./gemini");

      await expect(
        generateProposalSegment("hero", mockProspectData),
      ).rejects.toThrow(/generation failed/i);
    });

    it("should retry on transient failures", async () => {
      mockGenerateContent
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({
          response: { text: () => "Success after retry" },
        });

      const { generateProposalSegment } = await import("./gemini");

      const result = await generateProposalSegment("current_state", mockProspectData);

      expect(result).toBe("Success after retry");
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    });
  });

  describe("generateFullProposal", () => {
    beforeEach(() => {
      // Setup mock responses for all segments
      let callCount = 0;
      mockGenerateContent.mockImplementation(() => {
        const responses = [
          JSON.stringify({
            headline: "Test Headline",
            subheadline: "Test Subheadline",
          }),
          "Current state description.",
          "Opportunities description.",
          "ROI description.",
          JSON.stringify({
            description: "Investment description",
            value_proposition: "Value prop",
          }),
          JSON.stringify([
            "Step 1",
            "Step 2",
            "Step 3",
          ]),
        ];
        return Promise.resolve({
          response: { text: () => responses[callCount++] ?? "" },
        });
      });
    });

    it("should generate all 6 segments", async () => {
      const { generateFullProposal } = await import("./gemini");

      const result = await generateFullProposal(mockProspectData);

      expect(result.hero).toBeDefined();
      expect(result.current_state).toBeDefined();
      expect(result.opportunities).toBeDefined();
      expect(result.roi).toBeDefined();
      expect(result.investment).toBeDefined();
      expect(result.next_steps).toBeDefined();
    });

    it("should parse JSON segments correctly", async () => {
      const { generateFullProposal } = await import("./gemini");

      const result = await generateFullProposal(mockProspectData);

      expect(result.hero.headline).toBe("Test Headline");
      expect(result.hero.subheadline).toBe("Test Subheadline");
      expect(Array.isArray(result.next_steps)).toBe(true);
    });

    it("should keep text segments as strings", async () => {
      const { generateFullProposal } = await import("./gemini");

      const result = await generateFullProposal(mockProspectData);

      expect(typeof result.current_state).toBe("string");
      expect(typeof result.opportunities).toBe("string");
      expect(typeof result.roi).toBe("string");
    });

    it("should fail if any segment fails", async () => {
      mockGenerateContent
        .mockResolvedValueOnce({
          response: { text: () => JSON.stringify({ headline: "OK", subheadline: "OK" }) },
        })
        .mockRejectedValueOnce(new Error("Segment failed"));

      const { generateFullProposal } = await import("./gemini");

      await expect(generateFullProposal(mockProspectData)).rejects.toThrow();
    });
  });
});

describe("ProspectData Transformation", () => {
  it("should transform ProspectWithAnalyses to generation data", async () => {
    const { transformProspectToGenerationData } = await import("./gemini");

    const prospect = {
      id: "prospect-123",
      domain: "example.lt",
      companyName: "Example UAB",
      workspaceId: "ws-123",
      analyses: [
        {
          id: "analysis-123",
          domainMetrics: {
            organicTraffic: 500,
            organicKeywords: 100,
          },
          opportunityKeywords: [
            {
              keyword: "seo paslaugos",
              searchVolume: 2400,
              difficulty: 45,
              cpc: 3.5,
              opportunityScore: 75,
              category: "service",
              source: "ai_generated",
            },
          ],
        },
      ],
    };

    const pricingConfig = {
      setupFee: 2500,
      monthlyFee: 1500,
      inclusions: ["Techninis auditas"],
    };

    const result = transformProspectToGenerationData(prospect as any, pricingConfig);

    expect(result.domain).toBe("example.lt");
    expect(result.companyName).toBe("Example UAB");
    expect(result.traffic).toBe(500);
    expect(result.keywords).toBe(100);
    expect(result.opportunities.length).toBe(1);
    expect(result.setupFee).toBe(2500);
  });

  it("should handle missing analysis data gracefully", async () => {
    const { transformProspectToGenerationData } = await import("./gemini");

    const prospect = {
      id: "prospect-123",
      domain: "example.lt",
      companyName: null,
      workspaceId: "ws-123",
      analyses: [],
    };

    const pricingConfig = {
      setupFee: 2500,
      monthlyFee: 1500,
      inclusions: [],
    };

    const result = transformProspectToGenerationData(prospect as any, pricingConfig);

    expect(result.domain).toBe("example.lt");
    expect(result.companyName).toBe("example.lt"); // Fallback to domain
    expect(result.traffic).toBe(0);
    expect(result.opportunities).toEqual([]);
  });
});

describe("Integration with ProposalService", () => {
  it("should expose method to generate and store proposal content", async () => {
    mockGenerateContent.mockImplementation(() =>
      Promise.resolve({
        response: { text: () => "Generated text" },
      }),
    );

    const { generateProposalContent } = await import("./gemini");

    expect(generateProposalContent).toBeDefined();
    expect(typeof generateProposalContent).toBe("function");
  });
});
