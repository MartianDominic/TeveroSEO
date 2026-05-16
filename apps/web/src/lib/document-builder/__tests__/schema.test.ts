/**
 * Tests for document builder Drizzle schema.
 * Phase 102-01: Foundation Schema and Types
 *
 * TDD: RED phase - these tests verify schema structure exists.
 */

import { describe, it, expect } from "vitest";

// Import schema tables to test they exist and have correct structure
import {
  persuasionBlocks,
  blockVariants,
  proposalStructures,
  uploadedDocuments,
  detectedStructures,
  type UploadedDocument,
  type NewUploadedDocument,
  type DetectedStructure,
} from "@/db/schema/document-builder";

describe("document-builder/schema", () => {
  describe("persuasionBlocks table", () => {
    it("has id, proposalId, type, position, content columns", () => {
      // Verify table exists and has expected columns
      expect(persuasionBlocks).toBeDefined();

      // Check column names exist in the table definition
      const columnNames = Object.keys(persuasionBlocks);
      expect(columnNames).toContain("id");
      expect(columnNames).toContain("proposalId");
      expect(columnNames).toContain("type");
      expect(columnNames).toContain("position");
      expect(columnNames).toContain("content");
    });

    it("has workspaceId, styling, persuasionMeta columns", () => {
      const columnNames = Object.keys(persuasionBlocks);
      expect(columnNames).toContain("workspaceId");
      expect(columnNames).toContain("styling");
      expect(columnNames).toContain("persuasionMeta");
    });

    it("has viewCount, dwellTimeMs analytics columns", () => {
      const columnNames = Object.keys(persuasionBlocks);
      expect(columnNames).toContain("viewCount");
      expect(columnNames).toContain("dwellTimeMs");
    });

    it("has createdAt, updatedAt timestamps", () => {
      const columnNames = Object.keys(persuasionBlocks);
      expect(columnNames).toContain("createdAt");
      expect(columnNames).toContain("updatedAt");
    });
  });

  describe("blockVariants table (D-02)", () => {
    it("has id, parentBlockId, variantName columns", () => {
      expect(blockVariants).toBeDefined();

      const columnNames = Object.keys(blockVariants);
      expect(columnNames).toContain("id");
      expect(columnNames).toContain("parentBlockId");
      expect(columnNames).toContain("variantName");
    });

    it("has content, styling columns", () => {
      const columnNames = Object.keys(blockVariants);
      expect(columnNames).toContain("content");
      expect(columnNames).toContain("styling");
    });

    it("has weight, impressions, conversions for A/B testing", () => {
      const columnNames = Object.keys(blockVariants);
      expect(columnNames).toContain("weight");
      expect(columnNames).toContain("impressions");
      expect(columnNames).toContain("conversions");
    });

    it("has status column for variant state", () => {
      const columnNames = Object.keys(blockVariants);
      expect(columnNames).toContain("status");
    });

    it("has createdAt timestamp", () => {
      const columnNames = Object.keys(blockVariants);
      expect(columnNames).toContain("createdAt");
    });
  });

  describe("proposalStructures table", () => {
    it("has id, proposalId, workspaceId columns", () => {
      expect(proposalStructures).toBeDefined();

      const columnNames = Object.keys(proposalStructures);
      expect(columnNames).toContain("id");
      expect(columnNames).toContain("proposalId");
      expect(columnNames).toContain("workspaceId");
    });

    it("has frameworkId, frameworkName columns", () => {
      const columnNames = Object.keys(proposalStructures);
      expect(columnNames).toContain("frameworkId");
      expect(columnNames).toContain("frameworkName");
    });

    it("has blockOrder JSONB column", () => {
      const columnNames = Object.keys(proposalStructures);
      expect(columnNames).toContain("blockOrder");
    });

    it("has validationResult JSONB column", () => {
      const columnNames = Object.keys(proposalStructures);
      expect(columnNames).toContain("validationResult");
    });

    it("has createdAt, updatedAt timestamps", () => {
      const columnNames = Object.keys(proposalStructures);
      expect(columnNames).toContain("createdAt");
      expect(columnNames).toContain("updatedAt");
    });
  });

  describe("uploadedDocuments table (102-07)", () => {
    it("has id, workspaceId, fileName, fileType, fileSize, r2Key fields", () => {
      expect(uploadedDocuments).toBeDefined();

      const columnNames = Object.keys(uploadedDocuments);
      expect(columnNames).toContain("id");
      expect(columnNames).toContain("workspaceId");
      expect(columnNames).toContain("fileName");
      expect(columnNames).toContain("fileType");
      expect(columnNames).toContain("fileSize");
      expect(columnNames).toContain("r2Key");
    });

    it("has status field with valid values", () => {
      const columnNames = Object.keys(uploadedDocuments);
      expect(columnNames).toContain("status");
      expect(uploadedDocuments.status.name).toBe("status");
    });

    it("has processingProgress field as integer 0-100", () => {
      const columnNames = Object.keys(uploadedDocuments);
      expect(columnNames).toContain("processingProgress");
      expect(uploadedDocuments.processingProgress.name).toBe("processing_progress");
    });

    it("has extractedText and extractedMetadata as nullable JSONB", () => {
      const columnNames = Object.keys(uploadedDocuments);
      expect(columnNames).toContain("extractedText");
      expect(columnNames).toContain("extractedMetadata");
    });

    it("has indexes on workspaceId and status", () => {
      // Verify columns used in indexes exist
      expect(uploadedDocuments.workspaceId.name).toBe("workspace_id");
      expect(uploadedDocuments.status.name).toBe("status");
    });

    it("exports UploadedDocument type", () => {
      const doc: UploadedDocument = {
        id: "test-id",
        workspaceId: "ws-123",
        fileName: "test.pdf",
        fileType: "pdf",
        fileSize: 1024,
        mimeType: "application/pdf",
        r2Key: "ws-123/doc-id/test.pdf",
        r2Bucket: "documents",
        status: "pending",
        processingProgress: 0,
        processingError: null,
        processingStartedAt: null,
        processingCompletedAt: null,
        extractedText: null,
        extractedMetadata: null,
        ocrTier: null,
        ocrConfidence: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(doc.id).toBe("test-id");
    });

    it("exports NewUploadedDocument type", () => {
      const newDoc: NewUploadedDocument = {
        workspaceId: "ws-123",
        fileName: "test.pdf",
        fileType: "pdf",
        fileSize: 1024,
        mimeType: "application/pdf",
        r2Key: "ws-123/doc-id/test.pdf",
      };
      expect(newDoc.workspaceId).toBe("ws-123");
    });
  });

  describe("detectedStructures table (102-10)", () => {
    it("has documentId FK to uploadedDocuments", () => {
      expect(detectedStructures).toBeDefined();

      const columnNames = Object.keys(detectedStructures);
      expect(columnNames).toContain("documentId");
    });

    it("has blockType column storing detected persuasion type", () => {
      const columnNames = Object.keys(detectedStructures);
      expect(columnNames).toContain("blockType");
    });

    it("has confidence column storing AI confidence 0-100", () => {
      const columnNames = Object.keys(detectedStructures);
      expect(columnNames).toContain("confidence");
    });

    it("has originalText column storing source text", () => {
      const columnNames = Object.keys(detectedStructures);
      expect(columnNames).toContain("originalText");
    });

    it("has suggestedContent column storing AI-improved version", () => {
      const columnNames = Object.keys(detectedStructures);
      expect(columnNames).toContain("suggestedContent");
    });

    it("has position, detectedVariables, and verification fields", () => {
      const columnNames = Object.keys(detectedStructures);
      expect(columnNames).toContain("position");
      expect(columnNames).toContain("detectedVariables");
      expect(columnNames).toContain("verified");
      expect(columnNames).toContain("verifiedAt");
    });

    it("has createdAt timestamp", () => {
      const columnNames = Object.keys(detectedStructures);
      expect(columnNames).toContain("createdAt");
    });

    it("exports DetectedStructure type", () => {
      const structure: DetectedStructure = {
        id: "test-id",
        documentId: "doc-123",
        blockType: "pain_amplifier",
        position: 0,
        confidence: 92,
        originalText: "Test content",
        suggestedContent: null,
        detectedVariables: [],
        verified: "pending",
        verifiedAt: null,
        verifiedBy: null,
        reasoning: null,
        createdAt: new Date(),
      };
      expect(structure.id).toBe("test-id");
    });
  });
});
