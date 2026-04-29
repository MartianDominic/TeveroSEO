/**
 * File storage utilities for branding assets and reports.
 * Phase 16 Plan 03: White-label branding for reports.
 *
 * Handles logo file upload, validation, and storage at /data/branding/{clientId}/
 * Also provides shared constants for report storage paths.
 */
import { mkdir, writeFile, unlink, stat, rename, readdir } from "node:fs/promises";
import path from "node:path";
import { createLogger } from "./logger";

const log = createLogger({ module: "storage" });

/**
 * Base directory for branding assets.
 * Defaults to {cwd}/data/branding (relative fallback instead of absolute /data/branding).
 * Can be overridden via BRANDING_DIR env var.
 */
export const BRANDING_DIR = process.env.BRANDING_DIR ?? path.join(process.cwd(), "data", "branding");

/**
 * Ensures the branding directory exists.
 * Called on first use to create the directory if needed.
 */
let brandingDirInitialized = false;
export async function ensureBrandingDir(): Promise<void> {
  if (brandingDirInitialized) return;
  await mkdir(BRANDING_DIR, { recursive: true });
  brandingDirInitialized = true;
  log.info("Branding directory initialized", { path: BRANDING_DIR });
}

/**
 * Ensures the reports directory exists.
 * Called on first use to create the directory if needed.
 */
let reportsDirInitialized = false;
export async function ensureReportsDir(): Promise<void> {
  if (reportsDirInitialized) return;
  await mkdir(REPORTS_DIR, { recursive: true });
  reportsDirInitialized = true;
  log.info("Reports directory initialized", { path: REPORTS_DIR });
}

/**
 * Validates storage directories at startup.
 * Should be called during application initialization.
 */
export async function validateStorageDirs(): Promise<void> {
  await ensureBrandingDir();
  await ensureReportsDir();
  log.info("Storage directories validated", {
    branding: BRANDING_DIR,
    reports: REPORTS_DIR
  });
}

/**
 * Base directory for report PDF files.
 * Unified constant to prevent path mismatch between report generation and downloads.
 * Defaults to {cwd}/data/reports, can be overridden via REPORTS_DIR env var.
 */
export const REPORTS_DIR = process.env.REPORTS_DIR ?? path.join(process.cwd(), "data", "reports");

/**
 * Sanitize a path component (e.g., clientId) to prevent path traversal attacks.
 * Only allows alphanumeric characters and hyphens.
 *
 * @param component - The path component to sanitize
 * @returns The sanitized component
 * @throws Error if the component contains invalid characters or path traversal sequences
 */
export function sanitizePathComponent(component: string): string {
  // Only allow alphanumeric and hyphens
  const sanitized = component.replace(/[^a-zA-Z0-9-]/g, "");
  if (sanitized !== component || component.includes("..")) {
    throw new Error(`Invalid path component: ${component}`);
  }
  return sanitized;
}

/**
 * Maximum logo file size: 2MB per CONTEXT.md spec.
 */
const MAX_LOGO_SIZE = 2 * 1024 * 1024;

/**
 * Allowed MIME types for logo uploads.
 */
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/svg+xml"];

/**
 * Maps MIME types to file extensions.
 */
const EXTENSION_MAP: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/svg+xml": ".svg",
};

/**
 * Result of saving a branding logo.
 */
export interface SaveLogoResult {
  /** Relative path for API response: /branding/{clientId}/logo.{ext} */
  path: string;
  /** Full filesystem path: /data/branding/{clientId}/logo.{ext} */
  url: string;
}

/**
 * Saves a branding logo for a client.
 *
 * @param clientId - UUID of the client
 * @param file - Logo file buffer
 * @param mimeType - MIME type of the file (image/png, image/jpeg, image/svg+xml)
 * @returns Object with relative path and full URL
 * @throws Error if file type is invalid or file is too large
 *
 * @example
 * const result = await saveBrandingLogo(
 *   "client-uuid",
 *   logoBuffer,
 *   "image/png"
 * );
 * // result.path = "/branding/client-uuid/logo.png"
 */
export async function saveBrandingLogo(
  clientId: string,
  file: Buffer,
  mimeType: string,
): Promise<SaveLogoResult> {
  // Validate file type (T-16-13: Tampering mitigation)
  if (!ALLOWED_TYPES.includes(mimeType)) {
    throw new Error(
      `Invalid file type: ${mimeType}. Allowed: PNG, JPG, SVG`,
    );
  }

  // Validate file size (T-16-16: DoS mitigation)
  if (file.length > MAX_LOGO_SIZE) {
    throw new Error(
      `File too large: ${file.length} bytes. Maximum allowed: 2MB`,
    );
  }

  // T-16-18: Path traversal mitigation - use shared sanitization
  const safeClientId = sanitizePathComponent(clientId);

  const ext = EXTENSION_MAP[mimeType];

  // Ensure base branding directory exists on first use
  await ensureBrandingDir();

  const clientDir = path.join(BRANDING_DIR, safeClientId);
  const filename = `logo${ext}`;
  const finalPath = path.join(clientDir, filename);
  const tempPath = path.join(clientDir, `logo.${Date.now()}.tmp`);

  // Ensure client-specific directory exists
  await mkdir(clientDir, { recursive: true });

  // Write to temp file first (atomic write pattern to handle race conditions)
  await writeFile(tempPath, file);

  // Atomic rename (handles race condition - rename is atomic on POSIX)
  await rename(tempPath, finalPath);

  // Clean up old logos with different extensions (T-16-17: Disk exhaustion mitigation)
  try {
    const files = await readdir(clientDir);
    for (const f of files) {
      if (f.startsWith("logo.") && f !== filename && !f.endsWith(".tmp")) {
        await unlink(path.join(clientDir, f)).catch(() => {
          // Ignore errors - file may have been deleted by concurrent request
        });
      }
    }
  } catch {
    // Directory read failed - non-critical, log and continue
    log.warn("Failed to clean up old logos", { clientId: safeClientId });
  }

  log.info("Logo saved", { clientId: safeClientId, path: finalPath, size: file.length });

  const relativePath = `/branding/${safeClientId}/${filename}`;
  return {
    path: relativePath,
    url: finalPath,
  };
}

/**
 * Deletes all logo files for a client.
 * Iterates through all possible extensions to ensure clean replacement.
 *
 * @param clientId - UUID of the client
 * @throws Error if clientId contains invalid characters (path traversal protection)
 */
export async function deleteBrandingLogo(clientId: string): Promise<void> {
  // SECURITY: Path traversal mitigation - use shared sanitization
  const safeClientId = sanitizePathComponent(clientId);

  const clientDir = path.join(BRANDING_DIR, safeClientId);

  for (const ext of Object.values(EXTENSION_MAP)) {
    const filePath = path.join(clientDir, `logo${ext}`);
    try {
      await unlink(filePath);
      log.info("Logo deleted", { path: filePath });
    } catch (err) {
      // File doesn't exist, ignore
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        throw err;
      }
    }
  }
}

/**
 * Gets the filesystem path to a client's logo if it exists.
 *
 * @param clientId - UUID of the client
 * @returns Full path to logo file, or null if no logo exists
 * @throws Error if clientId contains invalid characters (path traversal protection)
 */
export async function getBrandingLogoPath(
  clientId: string,
): Promise<string | null> {
  // SECURITY: Path traversal mitigation - use shared sanitization
  const safeClientId = sanitizePathComponent(clientId);

  const clientDir = path.join(BRANDING_DIR, safeClientId);

  for (const ext of Object.values(EXTENSION_MAP)) {
    const filePath = path.join(clientDir, `logo${ext}`);
    try {
      await stat(filePath);
      return filePath;
    } catch {
      // File doesn't exist, try next
    }
  }
  return null;
}
