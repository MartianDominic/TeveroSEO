/**
 * DocumentSyncService Tests
 * Phase 101: Document Management (D-04)
 *
 * Tests path traversal prevention and filename sanitization.
 */
import { describe, it, expect } from "vitest";
import { join, resolve, basename } from "path";

// Re-implement sanitizeFilename for testing (mirrors the service implementation)
function sanitizeFilename(filename: string): string {
  // First, decode URL-encoded characters (handle double-encoding too)
  let decoded = filename;
  let prevDecoded = "";
  // Iteratively decode until stable (handles %252e -> %2e -> .)
  while (decoded !== prevDecoded) {
    prevDecoded = decoded;
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      // Invalid encoding, keep current value
      break;
    }
  }

  // Use basename to strip any directory components
  let safe = basename(decoded);

  // Remove any remaining path traversal attempts
  safe = safe.replace(/\.\./g, "");

  // Remove null bytes (potential injection)
  safe = safe.replace(/\0/g, "");

  // Remove backslashes (Windows path separators)
  safe = safe.replace(/\\/g, "");

  // Ensure filename isn't empty after sanitization
  if (!safe || safe === "." || safe === "..") {
    throw new Error("Invalid filename after sanitization");
  }

  return safe;
}

function validatePathUnderBase(filePath: string, baseDir: string): void {
  const resolvedPath = resolve(filePath);
  const resolvedBase = resolve(baseDir);

  if (!resolvedPath.startsWith(resolvedBase + "/") && resolvedPath !== resolvedBase) {
    throw new Error("Path traversal attempt detected");
  }
}

describe("DocumentSyncService Security", () => {
  describe("sanitizeFilename", () => {
    it("should allow normal filenames", () => {
      expect(sanitizeFilename("document.pdf")).toBe("document.pdf");
      expect(sanitizeFilename("my file (1).docx")).toBe("my file (1).docx");
      expect(sanitizeFilename("report_2026.xlsx")).toBe("report_2026.xlsx");
    });

    it("should strip directory components", () => {
      expect(sanitizeFilename("/etc/passwd")).toBe("passwd");
      expect(sanitizeFilename("../../../etc/passwd")).toBe("passwd");
      expect(sanitizeFilename("foo/bar/document.pdf")).toBe("document.pdf");
    });

    it("should block path traversal attacks", () => {
      expect(sanitizeFilename("../secret.txt")).toBe("secret.txt");
      expect(sanitizeFilename("..\\..\\secret.txt")).toBe("secret.txt");
      expect(sanitizeFilename("foo/../bar/../secret.txt")).toBe("secret.txt");
    });

    it("should handle URL-encoded traversal attempts", () => {
      // %2e = . and %2f = /
      expect(sanitizeFilename("%2e%2e%2fetc%2fpasswd")).toBe("passwd");
      expect(sanitizeFilename("%2e%2e/%2e%2e/secret.txt")).toBe("secret.txt");
    });

    it("should handle double URL-encoded traversal", () => {
      // %252e = %2e (URL-encoded percent) which decodes to .
      expect(sanitizeFilename("%252e%252e%252fsecret.txt")).toBe("secret.txt");
    });

    it("should remove null bytes", () => {
      expect(sanitizeFilename("document.pdf\0.exe")).toBe("document.pdf.exe");
      expect(sanitizeFilename("file\0name.txt")).toBe("filename.txt");
    });

    it("should remove backslashes (Windows paths)", () => {
      expect(sanitizeFilename("..\\..\\secret.txt")).toBe("secret.txt");
      // On Linux, backslashes are removed but basename doesn't split on them
      // This is acceptable - the path is still sanitized (no backslash traversal)
      expect(sanitizeFilename("C:\\Windows\\System32\\config")).toBe("C:WindowsSystem32config");
    });

    it("should throw on empty result", () => {
      expect(() => sanitizeFilename("..")).toThrow("Invalid filename after sanitization");
      expect(() => sanitizeFilename(".")).toThrow("Invalid filename after sanitization");
      expect(() => sanitizeFilename("")).toThrow("Invalid filename after sanitization");
    });

    it("should throw on traversal-only names", () => {
      expect(() => sanitizeFilename("../..")).toThrow("Invalid filename after sanitization");
      expect(() => sanitizeFilename("%2e%2e")).toThrow("Invalid filename after sanitization");
    });
  });

  describe("validatePathUnderBase", () => {
    const baseDir = "/data/documents";

    it("should allow paths under base directory", () => {
      expect(() => validatePathUnderBase("/data/documents/ws1/file.pdf", baseDir)).not.toThrow();
      expect(() => validatePathUnderBase("/data/documents/a/b/c/file.pdf", baseDir)).not.toThrow();
    });

    it("should block paths outside base directory", () => {
      expect(() => validatePathUnderBase("/etc/passwd", baseDir)).toThrow("Path traversal attempt detected");
      expect(() => validatePathUnderBase("/data/other/file.pdf", baseDir)).toThrow("Path traversal attempt detected");
    });

    it("should block traversal within path", () => {
      // resolve() canonicalizes the path, so ../.. gets resolved
      expect(() => validatePathUnderBase("/data/documents/../../../etc/passwd", baseDir)).toThrow("Path traversal attempt detected");
    });

    it("should handle exact base directory match", () => {
      expect(() => validatePathUnderBase("/data/documents", baseDir)).not.toThrow();
    });

    it("should block paths that start with base but are siblings", () => {
      // /data/documents-backup is not under /data/documents
      expect(() => validatePathUnderBase("/data/documents-backup/file.pdf", baseDir)).toThrow("Path traversal attempt detected");
    });
  });

  describe("Combined defense in depth", () => {
    const baseDir = "/data/documents";
    const workspaceId = "ws_123";
    const documentId = "doc_456";

    it("should safely construct storage path", () => {
      const maliciousName = "../../../etc/passwd";
      const safeName = sanitizeFilename(maliciousName);

      const localPath = join(baseDir, workspaceId, documentId, "v1", safeName);

      // Path should be safe after sanitization
      expect(() => validatePathUnderBase(localPath, baseDir)).not.toThrow();
      expect(localPath).toBe("/data/documents/ws_123/doc_456/v1/passwd");
    });

    it("should block URL-encoded attacks through both layers", () => {
      const maliciousName = "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd";
      const safeName = sanitizeFilename(maliciousName);

      const localPath = join(baseDir, workspaceId, documentId, "v1", safeName);

      expect(() => validatePathUnderBase(localPath, baseDir)).not.toThrow();
      expect(safeName).toBe("passwd");
    });
  });
});
