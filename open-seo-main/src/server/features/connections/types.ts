/**
 * Site Connection Types
 *
 * Type definitions for platform detection and site connections.
 * Used by PlatformDetector and CredentialEncryption services.
 */

// ============================================================================
// Platform Types
// ============================================================================

export const PLATFORM_TYPES = [
  "wordpress",
  "shopify",
  "wix",
  "squarespace",
  "webflow",
  "custom",
  "pixel",
] as const;

export type PlatformType = (typeof PLATFORM_TYPES)[number];

// ============================================================================
// Connection Status
// ============================================================================

export const CONNECTION_STATUS = [
  "pending",
  "active",
  "error",
  "disconnected",
] as const;

export type ConnectionStatus = (typeof CONNECTION_STATUS)[number];

// ============================================================================
// Detection Types
// ============================================================================

export interface DetectionSignal {
  type: "api" | "cdn" | "meta" | "header" | "cookie";
  platform: PlatformType;
  weight: number;
  found: string;
}

export interface DetectionResult {
  platform: PlatformType;
  confidence: "high" | "medium" | "low";
  signals: DetectionSignal[];
}
