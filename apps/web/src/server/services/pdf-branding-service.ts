/**
 * PDF Branding Service
 * Phase 59-07: PDF generation with workspace branding
 *
 * Provides workspace-specific branding configuration for PDF generation.
 * Fetches branding data from open-seo-main API and converts colors to PDF format.
 */
import "server-only";
import { getOpenSeo } from "@/lib/server-fetch";

/**
 * Branding configuration for PDF generation
 */
export interface BrandingConfig {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  companyName: string;
  companyAddress: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  footerText: string | null;
}

/**
 * RGB color values normalized to 0-1 range for pdf-lib
 */
export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

/**
 * Default branding configuration when workspace data is unavailable
 */
const DEFAULT_BRANDING: BrandingConfig = {
  logoUrl: null,
  primaryColor: "#2563eb", // Blue-600
  secondaryColor: "#64748b", // Slate-500
  companyName: "TeveroSEO",
  companyAddress: null,
  companyEmail: null,
  companyPhone: null,
  footerText: null,
};

/**
 * Workspace data structure from open-seo-main API
 */
interface WorkspaceResponse {
  id: string;
  name: string;
  logo?: string | null;
  metadata?: string | null;
}

/**
 * Client branding data structure from open-seo-main API
 */
interface ClientBrandingResponse {
  logoUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  footerText?: string | null;
}

export class PdfBrandingService {
  /**
   * Get branding configuration for a workspace.
   * Falls back to default branding if workspace not found.
   *
   * @param workspaceId - The workspace (organization) ID
   * @returns BrandingConfig with all branding settings
   */
  async getBrandingConfig(workspaceId: string): Promise<BrandingConfig> {
    try {
      // Fetch workspace data from open-seo-main
      const workspace = await getOpenSeo<WorkspaceResponse>(
        `/api/organizations/${workspaceId}`
      );

      // Try to get client branding if available
      let branding: ClientBrandingResponse | null = null;
      try {
        branding = await getOpenSeo<ClientBrandingResponse>(
          `/api/organizations/${workspaceId}/branding`
        );
      } catch {
        // Branding not configured, use defaults
      }

      // Parse metadata if present (may contain contact info)
      let metadata: Record<string, unknown> = {};
      if (workspace.metadata) {
        try {
          metadata = JSON.parse(workspace.metadata);
        } catch {
          // Invalid JSON, ignore
        }
      }

      return {
        logoUrl: branding?.logoUrl ?? workspace.logo ?? null,
        primaryColor: branding?.primaryColor ?? DEFAULT_BRANDING.primaryColor,
        secondaryColor: branding?.secondaryColor ?? DEFAULT_BRANDING.secondaryColor,
        companyName: workspace.name ?? DEFAULT_BRANDING.companyName,
        companyAddress: (metadata.address as string) ?? null,
        companyEmail: (metadata.email as string) ?? null,
        companyPhone: (metadata.phone as string) ?? null,
        footerText: branding?.footerText ?? null,
      };
    } catch {
      // API error or workspace not found, return defaults
      return DEFAULT_BRANDING;
    }
  }

  /**
   * Convert hex color string to RGB values normalized to 0-1 range.
   * Required format for pdf-lib rgb() function.
   *
   * @param hex - Hex color string (e.g., "#2563eb" or "2563eb")
   * @returns RGB object with values between 0 and 1
   */
  hexToRgb(hex: string): RgbColor {
    // Remove # prefix if present
    const cleanHex = hex.replace(/^#/, "");

    // Parse hex values
    const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(cleanHex);

    if (!result) {
      // Return default blue if parsing fails
      return { r: 37 / 255, g: 99 / 255, b: 235 / 255 };
    }

    // Convert to 0-1 range for pdf-lib
    return {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255,
    };
  }

  /**
   * Fetch logo image as bytes for embedding in PDF.
   * Returns null if fetch fails or logo is not configured.
   *
   * @param logoUrl - URL of the logo image
   * @returns Uint8Array of image bytes or null
   */
  async fetchLogoBytes(logoUrl: string): Promise<Uint8Array | null> {
    try {
      const response = await fetch(logoUrl, {
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch {
      // Network error, timeout, or invalid URL
      return null;
    }
  }

  /**
   * Determine the image type from URL or content type.
   * Used to select the correct pdf-lib embed method.
   *
   * @param logoUrl - URL of the logo image
   * @returns "png" | "jpg" | "unknown"
   */
  getImageType(logoUrl: string): "png" | "jpg" | "unknown" {
    const lowerUrl = logoUrl.toLowerCase();

    if (lowerUrl.endsWith(".png")) {
      return "png";
    }

    if (lowerUrl.endsWith(".jpg") || lowerUrl.endsWith(".jpeg")) {
      return "jpg";
    }

    // Check common image hosting patterns
    if (lowerUrl.includes("format=png") || lowerUrl.includes("type=png")) {
      return "png";
    }

    if (lowerUrl.includes("format=jpg") || lowerUrl.includes("format=jpeg")) {
      return "jpg";
    }

    return "unknown";
  }
}

/**
 * Singleton instance for service reuse
 */
let _instance: PdfBrandingService | null = null;

export function getPdfBrandingService(): PdfBrandingService {
  if (!_instance) {
    _instance = new PdfBrandingService();
  }
  return _instance;
}
