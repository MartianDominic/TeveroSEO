/**
 * Connection Wizard API Client
 * Phase 66-04: Connection Wizard UI
 *
 * Client-side API functions for platform detection, guide fetching, and verification.
 */

// ============================================================================
// Types
// ============================================================================

export interface DetectionResult {
  platform: string;
  confidence: number;
  features: string[];
  paidPlanRequired: boolean;
  estimatedTime: string;
  hasGuide?: boolean;
}

export interface GuideStep {
  number: number;
  title: string;
  description: string;
  screenshot?: string;
  code?: string;
  helpLink?: string;
}

export interface GuideResponse {
  guide: {
    platform: string;
    name: string;
    steps: GuideStep[];
    estimatedTime: string;
    difficulty: "easy" | "medium" | "hard";
    paidPlanRequired: boolean;
    fallbackToGtm: boolean;
  };
  snippet: string;
}

export interface VerifyResponse {
  status: "pending" | "detected" | "verified" | "error";
  firstPing?: string;
  location?: string;
}

export interface InstallationCreateResponse {
  installationId: string;
  siteId: string;
  snippet: string;
}

// ============================================================================
// API Error
// ============================================================================

export class ConnectApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ConnectApiError";
    this.status = status;
    this.code = code;
  }
}

// ============================================================================
// API Client
// ============================================================================

export const connectApi = {
  /**
   * Detect CMS platform from URL.
   *
   * @param url - The website URL to detect
   * @returns Detection result with platform, confidence, and features
   */
  async detect(url: string): Promise<DetectionResult> {
    const response = await fetch("/api/connect/detect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ConnectApiError(
        error.message || "Detection failed",
        response.status,
        error.code
      );
    }

    return response.json();
  },

  /**
   * Get installation guide for a platform.
   *
   * @param platform - Platform key (e.g., 'shopify', 'wordpress_self_hosted')
   * @param siteId - Optional site ID for code interpolation
   * @returns Guide with steps and snippet
   */
  async getGuide(platform: string, siteId?: string): Promise<GuideResponse> {
    const params = new URLSearchParams();
    if (siteId) {
      params.set("siteId", siteId);
    }
    const queryString = params.toString();
    const url = `/api/connect/guide/${platform}${queryString ? `?${queryString}` : ""}`;

    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ConnectApiError(
        error.message || "Guide not found",
        response.status,
        error.code
      );
    }

    return response.json();
  },

  /**
   * Verify pixel installation.
   *
   * @param siteId - Site ID to verify
   * @returns Verification status
   */
  async verify(siteId: string): Promise<VerifyResponse> {
    const response = await fetch(`/api/connect/verify?siteId=${siteId}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ConnectApiError(
        error.message || "Verification failed",
        response.status,
        error.code
      );
    }

    return response.json();
  },

  /**
   * Create a new pixel installation.
   *
   * @param workspaceId - Workspace ID
   * @param domain - Website domain
   * @returns Installation data with siteId and snippet
   */
  async createInstallation(
    workspaceId: string,
    domain: string
  ): Promise<InstallationCreateResponse> {
    const response = await fetch("/api/pixel/installation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, domain }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ConnectApiError(
        error.message || "Installation creation failed",
        response.status,
        error.code
      );
    }

    return response.json();
  },

  /**
   * Send developer handoff email.
   *
   * @param siteId - Site ID
   * @param email - Developer email
   * @param message - Optional message
   * @returns Handoff ID
   */
  async sendHandoff(
    siteId: string,
    email: string,
    message?: string
  ): Promise<{ handoffId: string; magicLink: string }> {
    const response = await fetch("/api/connect/handoff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId, email, message }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ConnectApiError(
        error.message || "Handoff failed",
        response.status,
        error.code
      );
    }

    return response.json();
  },
};
