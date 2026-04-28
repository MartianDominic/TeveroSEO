/**
 * Tests for storage.ts
 * Phase 16 Plan 03: File storage utilities for branding assets.
 *
 * TDD RED phase: Tests written before implementation.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, writeFile, unlink, stat, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// Use a temp directory for testing
const TEST_DIR = path.join(os.tmpdir(), "branding-test");

describe("storage", () => {
  beforeEach(async () => {
    // Set BRANDING_DIR to test directory
    process.env.BRANDING_DIR = TEST_DIR;
    // Create test directory
    await mkdir(TEST_DIR, { recursive: true });
    // Clear module cache to reload with new env
    vi.resetModules();
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await rm(TEST_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("BRANDING_DIR", () => {
    it("should default to /data/branding when env not set", async () => {
      delete process.env.BRANDING_DIR;
      vi.resetModules();
      const { BRANDING_DIR } = await import("./storage");
      expect(BRANDING_DIR).toBe("/data/branding");
    });

    it("should use BRANDING_DIR from environment", async () => {
      process.env.BRANDING_DIR = "/custom/path";
      vi.resetModules();
      const { BRANDING_DIR } = await import("./storage");
      expect(BRANDING_DIR).toBe("/custom/path");
    });
  });

  describe("saveBrandingLogo", () => {
    it("should save PNG file to correct directory", async () => {
      const { saveBrandingLogo } = await import("./storage");
      const clientId = "test-client-123";
      const file = Buffer.from("fake-png-data");
      const mimeType = "image/png";

      const result = await saveBrandingLogo(clientId, file, mimeType);

      expect(result.path).toBe(`/branding/${clientId}/logo.png`);
      expect(result.url).toContain(clientId);
      expect(result.url).toContain("logo.png");
    });

    it("should save JPG file with correct extension", async () => {
      const { saveBrandingLogo } = await import("./storage");
      const clientId = "test-client-456";
      const file = Buffer.from("fake-jpg-data");
      const mimeType = "image/jpeg";

      const result = await saveBrandingLogo(clientId, file, mimeType);

      expect(result.path).toBe(`/branding/${clientId}/logo.jpg`);
    });

    it("should save SVG file with correct extension", async () => {
      const { saveBrandingLogo } = await import("./storage");
      const clientId = "test-client-789";
      const file = Buffer.from("<svg></svg>");
      const mimeType = "image/svg+xml";

      const result = await saveBrandingLogo(clientId, file, mimeType);

      expect(result.path).toBe(`/branding/${clientId}/logo.svg`);
    });

    it("should reject files over 2MB", async () => {
      const { saveBrandingLogo } = await import("./storage");
      const clientId = "test-client-large";
      // Create a buffer larger than 2MB
      const file = Buffer.alloc(2 * 1024 * 1024 + 1);
      const mimeType = "image/png";

      await expect(saveBrandingLogo(clientId, file, mimeType)).rejects.toThrow(
        /too large/i,
      );
    });

    it("should reject invalid file types", async () => {
      const { saveBrandingLogo } = await import("./storage");
      const clientId = "test-client-invalid";
      const file = Buffer.from("fake-data");

      await expect(
        saveBrandingLogo(clientId, file, "image/gif"),
      ).rejects.toThrow(/invalid file type/i);

      await expect(
        saveBrandingLogo(clientId, file, "application/pdf"),
      ).rejects.toThrow(/invalid file type/i);
    });

    it("should create client directory if not exists", async () => {
      const { saveBrandingLogo } = await import("./storage");
      const clientId = "new-client-dir";
      const file = Buffer.from("fake-png-data");
      const mimeType = "image/png";

      await saveBrandingLogo(clientId, file, mimeType);

      const clientDir = path.join(TEST_DIR, clientId);
      const dirStat = await stat(clientDir);
      expect(dirStat.isDirectory()).toBe(true);
    });

    it("should replace old logo with different extension", async () => {
      const { saveBrandingLogo } = await import("./storage");
      const clientId = "replace-logo-client";

      // Save PNG first
      await saveBrandingLogo(
        clientId,
        Buffer.from("png-data"),
        "image/png",
      );

      // Save JPG (should replace PNG)
      await saveBrandingLogo(
        clientId,
        Buffer.from("jpg-data"),
        "image/jpeg",
      );

      // PNG should not exist
      const pngPath = path.join(TEST_DIR, clientId, "logo.png");
      await expect(stat(pngPath)).rejects.toThrow();

      // JPG should exist
      const jpgPath = path.join(TEST_DIR, clientId, "logo.jpg");
      const jpgStat = await stat(jpgPath);
      expect(jpgStat.isFile()).toBe(true);
    });
  });

  describe("deleteBrandingLogo", () => {
    it("should delete existing logo file", async () => {
      const { saveBrandingLogo, deleteBrandingLogo } = await import(
        "./storage"
      );
      const clientId = "delete-logo-client";

      // Save logo first
      await saveBrandingLogo(
        clientId,
        Buffer.from("png-data"),
        "image/png",
      );

      // Delete it
      await deleteBrandingLogo(clientId);

      // File should not exist
      const logoPath = path.join(TEST_DIR, clientId, "logo.png");
      await expect(stat(logoPath)).rejects.toThrow();
    });

    it("should not throw if logo does not exist", async () => {
      const { deleteBrandingLogo } = await import("./storage");
      const clientId = "nonexistent-client";

      // Should not throw
      await expect(deleteBrandingLogo(clientId)).resolves.toBeUndefined();
    });
  });

  describe("getBrandingLogoPath", () => {
    it("should return path to existing logo", async () => {
      const { saveBrandingLogo, getBrandingLogoPath } = await import(
        "./storage"
      );
      const clientId = "get-logo-client";

      // Save logo first
      await saveBrandingLogo(
        clientId,
        Buffer.from("png-data"),
        "image/png",
      );

      const logoPath = await getBrandingLogoPath(clientId);

      expect(logoPath).not.toBeNull();
      expect(logoPath).toContain(clientId);
      expect(logoPath).toContain("logo.png");
    });

    it("should return null if no logo exists", async () => {
      const { getBrandingLogoPath } = await import("./storage");
      const clientId = "no-logo-client";

      const logoPath = await getBrandingLogoPath(clientId);

      expect(logoPath).toBeNull();
    });
  });
});
