/**
 * Zod Schema Validation Tests for Document Builder
 * Phase 102: API Request/Response Schema Validation
 *
 * Tests Zod schemas used in document-builder API routes:
 * - analytics route: blockInteractionSchema, analyticsRequestSchema
 * - export route: variableContextSchema, exportRequestSchema
 * - generate route: prospectContextSchema, styleReferenceSchema, generationRequestSchema
 *
 * Test patterns: valid inputs, invalid inputs, edge cases, nested validation, optional vs required fields
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";

import { PERSUASION_BLOCK_TYPES_ARRAY } from "../types";

// =============================================================================
// Schema Definitions (replicated from API routes for isolated testing)
// =============================================================================

// Analytics route schemas
const blockInteractionSchema = z.object({
  type: z.enum(["block_view", "block_dwell", "scroll_depth", "cta_click"]),
  blockId: z.string().min(1),
  variantId: z.string().optional(),
  dwellMs: z.number().optional(),
  percent: z.number().optional(),
  timestamp: z.number().optional(),
});

const analyticsRequestSchema = z.object({
  sessionId: z.string().min(1),
  events: z.array(blockInteractionSchema).min(1).max(100),
});

// Export route schemas
const variableContextSchema = z.object({
  prospect: z.record(z.string(), z.string()).optional(),
  client: z.record(z.string(), z.string()).optional(),
  agency: z.record(z.string(), z.string()).optional(),
  custom: z.record(z.string(), z.string()).optional(),
});

const exportRequestSchema = z.object({
  proposalId: z.string().uuid(),
  variableContext: variableContextSchema.optional(),
  includeTheme: z.boolean().optional().default(true),
});

// Generate route schemas
const prospectContextSchema = z
  .object({
    id: z.string().min(1),
    domain: z.string().optional(),
    niche: z.string().optional(),
    painPoints: z.array(z.string()).optional(),
  })
  .passthrough();

const styleReferenceSchema = z.object({
  id: z.string(),
  type: z.enum(["pdf", "url", "text"]),
  url: z.string().optional(),
  content: z.string().optional(),
});

const generationRequestSchema = z.object({
  // PERSUASION_BLOCK_TYPES_ARRAY is a readonly tuple from `as const`, so use directly
  blockType: z.enum(PERSUASION_BLOCK_TYPES_ARRAY),
  intent: z.enum(["create", "fill_variables", "regenerate", "improve"]),
  prospect: prospectContextSchema,
  styleReferences: z.array(styleReferenceSchema).optional(),
  existingContent: z.string().max(10000).optional(),
  customPrompt: z.string().max(1000).optional(),
  maxLength: z.number().int().min(10).max(2000).optional(),
  tone: z.string().max(100).optional(),
  language: z.string().max(10).default("lt"),
  framework: z.string().max(100).optional(),
  precedingBlocks: z.array(z.string().max(2000)).max(10).optional(),
});

// =============================================================================
// Analytics Route Schema Tests
// =============================================================================

describe("Analytics Route Schemas", () => {
  describe("blockInteractionSchema", () => {
    const validBlockInteraction = {
      type: "block_view" as const,
      blockId: "block-123",
    };

    it("accepts valid block_view event", () => {
      const result = blockInteractionSchema.safeParse(validBlockInteraction);
      expect(result.success).toBe(true);
    });

    it("accepts valid block_dwell event with dwellMs", () => {
      const result = blockInteractionSchema.safeParse({
        type: "block_dwell",
        blockId: "block-456",
        dwellMs: 5000,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dwellMs).toBe(5000);
      }
    });

    it("accepts valid scroll_depth event with percent", () => {
      const result = blockInteractionSchema.safeParse({
        type: "scroll_depth",
        blockId: "block-789",
        percent: 75,
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid cta_click event", () => {
      const result = blockInteractionSchema.safeParse({
        type: "cta_click",
        blockId: "cta-block-1",
      });
      expect(result.success).toBe(true);
    });

    it("accepts optional variantId", () => {
      const result = blockInteractionSchema.safeParse({
        ...validBlockInteraction,
        variantId: "variant-a",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.variantId).toBe("variant-a");
      }
    });

    it("accepts optional timestamp", () => {
      const timestamp = Date.now();
      const result = blockInteractionSchema.safeParse({
        ...validBlockInteraction,
        timestamp,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timestamp).toBe(timestamp);
      }
    });

    it("rejects invalid event type", () => {
      const result = blockInteractionSchema.safeParse({
        type: "invalid_type",
        blockId: "block-123",
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing type", () => {
      const result = blockInteractionSchema.safeParse({
        blockId: "block-123",
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing blockId", () => {
      const result = blockInteractionSchema.safeParse({
        type: "block_view",
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty blockId", () => {
      const result = blockInteractionSchema.safeParse({
        type: "block_view",
        blockId: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects non-string blockId", () => {
      const result = blockInteractionSchema.safeParse({
        type: "block_view",
        blockId: 123,
      });
      expect(result.success).toBe(false);
    });

    it("rejects non-number dwellMs", () => {
      const result = blockInteractionSchema.safeParse({
        type: "block_dwell",
        blockId: "block-123",
        dwellMs: "5000",
      });
      expect(result.success).toBe(false);
    });

    it("handles unicode blockId", () => {
      const result = blockInteractionSchema.safeParse({
        type: "block_view",
        blockId: "block-中文-123",
      });
      expect(result.success).toBe(true);
    });

    it("handles special characters in blockId", () => {
      const result = blockInteractionSchema.safeParse({
        type: "block_view",
        blockId: "block_123-abc.def",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("analyticsRequestSchema", () => {
    const validEvent = {
      type: "block_view" as const,
      blockId: "block-123",
    };

    const validRequest = {
      sessionId: "session-abc-123",
      events: [validEvent],
    };

    it("accepts valid request with single event", () => {
      const result = analyticsRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it("accepts valid request with multiple events", () => {
      const result = analyticsRequestSchema.safeParse({
        sessionId: "session-xyz",
        events: [
          { type: "block_view", blockId: "block-1" },
          { type: "block_dwell", blockId: "block-1", dwellMs: 3000 },
          { type: "scroll_depth", blockId: "block-2", percent: 50 },
        ],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.events).toHaveLength(3);
      }
    });

    it("accepts maximum 100 events", () => {
      const events = Array.from({ length: 100 }, (_, i) => ({
        type: "block_view" as const,
        blockId: `block-${i}`,
      }));
      const result = analyticsRequestSchema.safeParse({
        sessionId: "session-max",
        events,
      });
      expect(result.success).toBe(true);
    });

    it("rejects more than 100 events", () => {
      const events = Array.from({ length: 101 }, (_, i) => ({
        type: "block_view" as const,
        blockId: `block-${i}`,
      }));
      const result = analyticsRequestSchema.safeParse({
        sessionId: "session-overflow",
        events,
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty events array", () => {
      const result = analyticsRequestSchema.safeParse({
        sessionId: "session-empty",
        events: [],
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing sessionId", () => {
      const result = analyticsRequestSchema.safeParse({
        events: [validEvent],
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty sessionId", () => {
      const result = analyticsRequestSchema.safeParse({
        sessionId: "",
        events: [validEvent],
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing events", () => {
      const result = analyticsRequestSchema.safeParse({
        sessionId: "session-no-events",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid event in array", () => {
      const result = analyticsRequestSchema.safeParse({
        sessionId: "session-bad-event",
        events: [validEvent, { type: "invalid", blockId: "block-bad" }],
      });
      expect(result.success).toBe(false);
    });

    it("handles uuid-style sessionId", () => {
      const result = analyticsRequestSchema.safeParse({
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        events: [validEvent],
      });
      expect(result.success).toBe(true);
    });
  });
});

// =============================================================================
// Export Route Schema Tests
// =============================================================================

describe("Export Route Schemas", () => {
  describe("variableContextSchema", () => {
    it("accepts empty object", () => {
      const result = variableContextSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("accepts all optional fields", () => {
      const result = variableContextSchema.safeParse({
        prospect: { name: "John Doe", company: "Acme Inc" },
        client: { industry: "Technology" },
        agency: { name: "SEO Agency" },
        custom: { specialField: "custom value" },
      });
      expect(result.success).toBe(true);
    });

    it("accepts partial fields", () => {
      const result = variableContextSchema.safeParse({
        prospect: { domain: "example.com" },
      });
      expect(result.success).toBe(true);
    });

    it("rejects non-string values in records", () => {
      const result = variableContextSchema.safeParse({
        prospect: { name: 123 },
      });
      expect(result.success).toBe(false);
    });

    it("rejects array values in records", () => {
      const result = variableContextSchema.safeParse({
        client: { tags: ["a", "b"] },
      });
      expect(result.success).toBe(false);
    });

    it("handles unicode keys and values", () => {
      const result = variableContextSchema.safeParse({
        prospect: { "名前": "山田太郎" },
      });
      expect(result.success).toBe(true);
    });

    it("handles empty string values", () => {
      const result = variableContextSchema.safeParse({
        prospect: { name: "" },
      });
      expect(result.success).toBe(true);
    });

    it("handles special characters in values", () => {
      const result = variableContextSchema.safeParse({
        prospect: { email: "test@example.com", url: "https://example.com/path?query=1" },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("exportRequestSchema", () => {
    const validUuid = "550e8400-e29b-41d4-a716-446655440000";

    it("accepts valid request with required fields only", () => {
      const result = exportRequestSchema.safeParse({
        proposalId: validUuid,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeTheme).toBe(true); // default
      }
    });

    it("accepts valid request with all fields", () => {
      const result = exportRequestSchema.safeParse({
        proposalId: validUuid,
        variableContext: {
          prospect: { name: "Test" },
        },
        includeTheme: false,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeTheme).toBe(false);
      }
    });

    it("defaults includeTheme to true", () => {
      const result = exportRequestSchema.safeParse({
        proposalId: validUuid,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeTheme).toBe(true);
      }
    });

    it("rejects missing proposalId", () => {
      const result = exportRequestSchema.safeParse({
        variableContext: {},
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid uuid format", () => {
      const result = exportRequestSchema.safeParse({
        proposalId: "not-a-uuid",
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty proposalId", () => {
      const result = exportRequestSchema.safeParse({
        proposalId: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects non-boolean includeTheme", () => {
      const result = exportRequestSchema.safeParse({
        proposalId: validUuid,
        includeTheme: "true",
      });
      expect(result.success).toBe(false);
    });

    it("accepts lowercase uuid", () => {
      const result = exportRequestSchema.safeParse({
        proposalId: "550e8400-e29b-41d4-a716-446655440000",
      });
      expect(result.success).toBe(true);
    });

    it("accepts uppercase uuid", () => {
      const result = exportRequestSchema.safeParse({
        proposalId: "550E8400-E29B-41D4-A716-446655440000",
      });
      expect(result.success).toBe(true);
    });
  });
});

// =============================================================================
// Generate Route Schema Tests
// =============================================================================

describe("Generate Route Schemas", () => {
  describe("prospectContextSchema", () => {
    const validProspect = {
      id: "prospect-123",
    };

    it("accepts minimal valid prospect", () => {
      const result = prospectContextSchema.safeParse(validProspect);
      expect(result.success).toBe(true);
    });

    it("accepts prospect with all fields", () => {
      const result = prospectContextSchema.safeParse({
        id: "prospect-456",
        domain: "example.com",
        niche: "e-commerce",
        painPoints: ["low traffic", "poor rankings"],
      });
      expect(result.success).toBe(true);
    });

    it("allows passthrough of extra fields", () => {
      const result = prospectContextSchema.safeParse({
        id: "prospect-789",
        domain: "test.com",
        customField: "custom value",
        anotherField: 123,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.customField).toBe("custom value");
      }
    });

    it("rejects missing id", () => {
      const result = prospectContextSchema.safeParse({
        domain: "example.com",
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty id", () => {
      const result = prospectContextSchema.safeParse({
        id: "",
      });
      expect(result.success).toBe(false);
    });

    it("accepts empty painPoints array", () => {
      const result = prospectContextSchema.safeParse({
        id: "prospect-empty-pain",
        painPoints: [],
      });
      expect(result.success).toBe(true);
    });

    it("rejects non-string painPoints items", () => {
      const result = prospectContextSchema.safeParse({
        id: "prospect-bad-pain",
        painPoints: [123, 456],
      });
      expect(result.success).toBe(false);
    });

    it("handles unicode in fields", () => {
      const result = prospectContextSchema.safeParse({
        id: "prospect-中文",
        domain: "例子.com",
        niche: "電商",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("styleReferenceSchema", () => {
    it("accepts valid pdf reference", () => {
      const result = styleReferenceSchema.safeParse({
        id: "ref-1",
        type: "pdf",
        url: "https://example.com/style.pdf",
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid url reference", () => {
      const result = styleReferenceSchema.safeParse({
        id: "ref-2",
        type: "url",
        url: "https://example.com/brand-guide",
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid text reference", () => {
      const result = styleReferenceSchema.safeParse({
        id: "ref-3",
        type: "text",
        content: "Use professional tone, avoid jargon.",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid type", () => {
      const result = styleReferenceSchema.safeParse({
        id: "ref-bad",
        type: "document",
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing id", () => {
      const result = styleReferenceSchema.safeParse({
        type: "text",
        content: "Test content",
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing type", () => {
      const result = styleReferenceSchema.safeParse({
        id: "ref-no-type",
      });
      expect(result.success).toBe(false);
    });

    it("accepts reference without url or content (both optional)", () => {
      const result = styleReferenceSchema.safeParse({
        id: "ref-minimal",
        type: "pdf",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("generationRequestSchema", () => {
    const validProspect = {
      id: "prospect-gen-123",
      domain: "example.com",
    };

    const validRequest = {
      blockType: "pain_amplifier" as const,
      intent: "create" as const,
      prospect: validProspect,
    };

    it("accepts minimal valid request", () => {
      const result = generationRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.language).toBe("lt"); // default
      }
    });

    it("accepts request with all block types", () => {
      for (const blockType of PERSUASION_BLOCK_TYPES_ARRAY) {
        const result = generationRequestSchema.safeParse({
          ...validRequest,
          blockType,
        });
        expect(result.success).toBe(true);
      }
    });

    it("accepts all intent types", () => {
      const intents = ["create", "fill_variables", "regenerate", "improve"];
      for (const intent of intents) {
        const result = generationRequestSchema.safeParse({
          ...validRequest,
          intent,
        });
        expect(result.success).toBe(true);
      }
    });

    it("accepts request with styleReferences", () => {
      const result = generationRequestSchema.safeParse({
        ...validRequest,
        styleReferences: [
          { id: "ref-1", type: "pdf", url: "https://example.com/style.pdf" },
          { id: "ref-2", type: "text", content: "Professional tone" },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("accepts request with existingContent", () => {
      const result = generationRequestSchema.safeParse({
        ...validRequest,
        existingContent: "Current block content to improve",
      });
      expect(result.success).toBe(true);
    });

    it("rejects existingContent over 10000 characters", () => {
      const result = generationRequestSchema.safeParse({
        ...validRequest,
        existingContent: "x".repeat(10001),
      });
      expect(result.success).toBe(false);
    });

    it("accepts existingContent at exactly 10000 characters", () => {
      const result = generationRequestSchema.safeParse({
        ...validRequest,
        existingContent: "x".repeat(10000),
      });
      expect(result.success).toBe(true);
    });

    it("accepts request with customPrompt", () => {
      const result = generationRequestSchema.safeParse({
        ...validRequest,
        customPrompt: "Make it more persuasive",
      });
      expect(result.success).toBe(true);
    });

    it("rejects customPrompt over 1000 characters", () => {
      const result = generationRequestSchema.safeParse({
        ...validRequest,
        customPrompt: "x".repeat(1001),
      });
      expect(result.success).toBe(false);
    });

    it("accepts maxLength within bounds", () => {
      const result = generationRequestSchema.safeParse({
        ...validRequest,
        maxLength: 500,
      });
      expect(result.success).toBe(true);
    });

    it("rejects maxLength below 10", () => {
      const result = generationRequestSchema.safeParse({
        ...validRequest,
        maxLength: 5,
      });
      expect(result.success).toBe(false);
    });

    it("rejects maxLength above 2000", () => {
      const result = generationRequestSchema.safeParse({
        ...validRequest,
        maxLength: 2001,
      });
      expect(result.success).toBe(false);
    });

    it("rejects non-integer maxLength", () => {
      const result = generationRequestSchema.safeParse({
        ...validRequest,
        maxLength: 500.5,
      });
      expect(result.success).toBe(false);
    });

    it("accepts tone within limit", () => {
      const result = generationRequestSchema.safeParse({
        ...validRequest,
        tone: "professional and authoritative",
      });
      expect(result.success).toBe(true);
    });

    it("rejects tone over 100 characters", () => {
      const result = generationRequestSchema.safeParse({
        ...validRequest,
        tone: "x".repeat(101),
      });
      expect(result.success).toBe(false);
    });

    it("defaults language to lt", () => {
      const result = generationRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.language).toBe("lt");
      }
    });

    it("accepts custom language", () => {
      const result = generationRequestSchema.safeParse({
        ...validRequest,
        language: "en",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.language).toBe("en");
      }
    });

    it("rejects language over 10 characters", () => {
      const result = generationRequestSchema.safeParse({
        ...validRequest,
        language: "very-long-lang",
      });
      expect(result.success).toBe(false);
    });

    it("accepts framework", () => {
      const result = generationRequestSchema.safeParse({
        ...validRequest,
        framework: "russell_brunson",
      });
      expect(result.success).toBe(true);
    });

    it("rejects framework over 100 characters", () => {
      const result = generationRequestSchema.safeParse({
        ...validRequest,
        framework: "x".repeat(101),
      });
      expect(result.success).toBe(false);
    });

    it("accepts precedingBlocks", () => {
      const result = generationRequestSchema.safeParse({
        ...validRequest,
        precedingBlocks: ["First block content", "Second block content"],
      });
      expect(result.success).toBe(true);
    });

    it("rejects precedingBlocks over 10 items", () => {
      const result = generationRequestSchema.safeParse({
        ...validRequest,
        precedingBlocks: Array.from({ length: 11 }, (_, i) => `Block ${i}`),
      });
      expect(result.success).toBe(false);
    });

    it("rejects precedingBlocks item over 2000 characters", () => {
      const result = generationRequestSchema.safeParse({
        ...validRequest,
        precedingBlocks: ["x".repeat(2001)],
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid blockType", () => {
      const result = generationRequestSchema.safeParse({
        ...validRequest,
        blockType: "invalid_type",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid intent", () => {
      const result = generationRequestSchema.safeParse({
        ...validRequest,
        intent: "invalid_intent",
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing blockType", () => {
      const result = generationRequestSchema.safeParse({
        intent: "create",
        prospect: validProspect,
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing intent", () => {
      const result = generationRequestSchema.safeParse({
        blockType: "pain_amplifier",
        prospect: validProspect,
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing prospect", () => {
      const result = generationRequestSchema.safeParse({
        blockType: "pain_amplifier",
        intent: "create",
      });
      expect(result.success).toBe(false);
    });
  });
});

// =============================================================================
// Edge Cases and Complex Scenarios
// =============================================================================

describe("Schema Edge Cases", () => {
  describe("Empty Objects and Arrays", () => {
    it("variableContextSchema accepts completely empty object", () => {
      const result = variableContextSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("analyticsRequestSchema rejects empty events array", () => {
      const result = analyticsRequestSchema.safeParse({
        sessionId: "session-1",
        events: [],
      });
      expect(result.success).toBe(false);
    });

    it("generationRequestSchema accepts empty styleReferences array", () => {
      const result = generationRequestSchema.safeParse({
        blockType: "pain_amplifier",
        intent: "create",
        prospect: { id: "p-1" },
        styleReferences: [],
      });
      expect(result.success).toBe(true);
    });
  });

  describe("Boundary Values", () => {
    it("maxLength at minimum boundary (10)", () => {
      const result = generationRequestSchema.safeParse({
        blockType: "cta",
        intent: "create",
        prospect: { id: "p-1" },
        maxLength: 10,
      });
      expect(result.success).toBe(true);
    });

    it("maxLength at maximum boundary (2000)", () => {
      const result = generationRequestSchema.safeParse({
        blockType: "cta",
        intent: "create",
        prospect: { id: "p-1" },
        maxLength: 2000,
      });
      expect(result.success).toBe(true);
    });

    it("events at maximum boundary (100)", () => {
      const events = Array.from({ length: 100 }, () => ({
        type: "block_view" as const,
        blockId: "block-1",
      }));
      const result = analyticsRequestSchema.safeParse({
        sessionId: "s-1",
        events,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("Unicode and Special Characters", () => {
    it("handles emoji in text fields", () => {
      const result = generationRequestSchema.safeParse({
        blockType: "social_proof",
        intent: "create",
        prospect: { id: "prospect-emoji" },
        customPrompt: "Add enthusiasm 🚀📊",
      });
      expect(result.success).toBe(true);
    });

    it("handles newlines in text fields", () => {
      const result = generationRequestSchema.safeParse({
        blockType: "pain_amplifier",
        intent: "create",
        prospect: { id: "p-newline" },
        existingContent: "Line 1\nLine 2\nLine 3",
      });
      expect(result.success).toBe(true);
    });

    it("handles tabs and special whitespace", () => {
      const result = generationRequestSchema.safeParse({
        blockType: "credibility",
        intent: "improve",
        prospect: { id: "p-whitespace" },
        existingContent: "Tab:\there\nCarriage return:\rtest",
      });
      expect(result.success).toBe(true);
    });

    it("handles HTML-like content in strings", () => {
      const result = generationRequestSchema.safeParse({
        blockType: "offer_stack",
        intent: "create",
        prospect: { id: "p-html" },
        existingContent: "<p>Some HTML content</p><script>alert('test')</script>",
      });
      expect(result.success).toBe(true); // Schema allows it, sanitization is separate
    });
  });

  describe("Null and Undefined Handling", () => {
    it("optional fields accept undefined", () => {
      const result = generationRequestSchema.safeParse({
        blockType: "urgency",
        intent: "create",
        prospect: { id: "p-undef" },
        existingContent: undefined,
        customPrompt: undefined,
      });
      expect(result.success).toBe(true);
    });

    it("rejects null for optional string fields", () => {
      const result = generationRequestSchema.safeParse({
        blockType: "urgency",
        intent: "create",
        prospect: { id: "p-null" },
        existingContent: null,
      });
      expect(result.success).toBe(false);
    });

    it("rejects null for required fields", () => {
      const result = generationRequestSchema.safeParse({
        blockType: null,
        intent: "create",
        prospect: { id: "p-1" },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("Type Coercion Behavior", () => {
    it("does not coerce string to number for maxLength", () => {
      const result = generationRequestSchema.safeParse({
        blockType: "cta",
        intent: "create",
        prospect: { id: "p-1" },
        maxLength: "100",
      });
      expect(result.success).toBe(false);
    });

    it("does not coerce number to string for blockId", () => {
      const result = blockInteractionSchema.safeParse({
        type: "block_view",
        blockId: 12345,
      });
      expect(result.success).toBe(false);
    });

    it("does not coerce string to boolean for includeTheme", () => {
      const result = exportRequestSchema.safeParse({
        proposalId: "550e8400-e29b-41d4-a716-446655440000",
        includeTheme: "true",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("Nested Schema Validation", () => {
    it("validates deeply nested structures", () => {
      const result = generationRequestSchema.safeParse({
        blockType: "pain_amplifier",
        intent: "create",
        prospect: {
          id: "p-deep",
          domain: "example.com",
          niche: "SaaS",
          painPoints: ["Issue 1", "Issue 2"],
        },
        styleReferences: [
          { id: "ref-1", type: "pdf", url: "https://example.com/1.pdf" },
          { id: "ref-2", type: "text", content: "Style guide text" },
        ],
        precedingBlocks: ["Block 1 content", "Block 2 content"],
      });
      expect(result.success).toBe(true);
    });

    it("fails on invalid nested field", () => {
      const result = generationRequestSchema.safeParse({
        blockType: "credibility",
        intent: "create",
        prospect: {
          id: "p-bad-nested",
          painPoints: ["valid", 123], // Invalid - should be all strings
        },
      });
      expect(result.success).toBe(false);
    });

    it("fails on invalid nested style reference", () => {
      const result = generationRequestSchema.safeParse({
        blockType: "social_proof",
        intent: "create",
        prospect: { id: "p-bad-ref" },
        styleReferences: [
          { id: "ref-1", type: "invalid_type" }, // Invalid type
        ],
      });
      expect(result.success).toBe(false);
    });
  });
});
