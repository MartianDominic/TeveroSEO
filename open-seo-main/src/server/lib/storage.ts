/**
 * File storage utilities for branding assets.
 * Phase 16 Plan 03: White-label branding for reports.
 *
 * Handles logo file upload, validation, and storage at /data/branding/{clientId}/
 */
import { mkdir, writeFile, unlink, stat } from "node:fs/promises";
import path from "node:path";
import { createLogger } from "./logger";

const log = createLogger({ module: "storage" });

/**
 * Base directory for branding assets.
 * Defaults to /data/branding, can be overridden via BRANDING_DIR env var.
 */
export const BRANDING_DIR = process.env.BRANDING_DIR ?? "/data/branding";

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

  // T-16-18: Path traversal mitigation - sanitize clientId
  // Only allow alphanumeric and hyphens in clientId
  const sanitizedClientId = clientId.replace(/[^a-zA-Z0-9-]/g, "");
  if (sanitizedClientId !== clientId || sanitizedClientId.includes("..")) {
    throw new Error("Invalid client ID format");
  }

  const ext = EXTENSION_MAP[mimeType];
  const clientDir = path.join(BRANDING_DIR, clientId);
  const filename = `logo${ext}`;
  const fullPath = path.join(clientDir, filename);

  // Ensure directory exists
  await mkdir(clientDir, { recursive: true });

  // Delete old logo if exists (T-16-17: Disk exhaustion mitigation)
  await deleteBrandingLogo(clientId);

  // Write new file
  await writeFile(fullPath, file);
  log.info("Logo saved", { clientId, path: fullPath, size: file.length });

  const relativePath = `/branding/${clientId}/${filename}`;
  return {
    path: relativePath,
    url: fullPath,
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
  // SECURITY: Path traversal mitigation - sanitize clientId
  // Only allow alphanumeric and hyphens in clientId
  const sanitizedClientId = clientId.replace(/[^a-zA-Z0-9-]/g, "");
  if (sanitizedClientId !== clientId || sanitizedClientId.includes("..")) {
    throw new Error("Invalid client ID format");
  }

  const clientDir = path.join(BRANDING_DIR, sanitizedClientId);

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
  // SECURITY: Path traversal mitigation - sanitize clientId
  // Only allow alphanumeric and hyphens in clientId
  const sanitizedClientId = clientId.replace(/[^a-zA-Z0-9-]/g, "");
  if (sanitizedClientId !== clientId || sanitizedClientId.includes("..")) {
    throw new Error("Invalid client ID format");
  }

  const clientDir = path.join(BRANDING_DIR, sanitizedClientId);

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
