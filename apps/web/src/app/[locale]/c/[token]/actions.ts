"use server";

/**
 * Server actions for public contract page.
 * Phase 59: Agreement & Signing Excellence
 *
 * These actions fetch and modify contract data via the open-seo-main API.
 * No authentication required - token provides access per D-06.
 *
 * Security: Token validation (T-59-04-01), content from DB (T-59-04-02),
 * no auth bypass (T-59-04-03).
 */

export interface ContractSection {
  title: string;
  content: string;
}

export interface ContractData {
  signer: {
    id: string;
    name: string;
    email: string;
    role: string;
    signingOrder: number;
    status: string;
  };
  agreement: {
    id: string;
    title: string;
    status: string;
    signingMode: "sequential" | "parallel";
    totalSigners: number;
    signedCount: number;
  };
  content: {
    sections: ContractSection[];
    resolvedAt: string;
  };
  client: {
    name: string;
    logoUrl?: string;
  };
  canSign: boolean;
  signingMessage?: string;
}

const getOpenSeoUrl = () =>
  process.env.OPEN_SEO_API_URL || "http://localhost:3001";

/**
 * Fetch contract by public access token.
 * Validates token exists, not expired (tokenExpiresAt > now), and matches signer.
 *
 * Per T-59-04-01: Token validation prevents spoofing.
 * Per D-07: Sequential mode enforces signing order (signingOrder === signedCount + 1).
 * Per D-08: Parallel mode allows any signer to sign.
 */
export async function getContractByToken(
  token: string
): Promise<ContractData | { error: string }> {
  try {
    const response = await fetch(
      `${getOpenSeoUrl()}/api/contracts/public/${token}`,
      {
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      if (response.status === 410) {
        return { error: "expired" };
      }
      if (response.status === 404) {
        return { error: "not_found" };
      }
      return { error: data.error || "Failed to fetch contract" };
    }

    const result = await response.json();
    return result.data as ContractData;
  } catch {
    return { error: "network_error" };
  }
}

/**
 * Mark contract as viewed by signer.
 * Updates signer.viewedAt = now, status = "viewed" if was "notified".
 *
 * Fire-and-forget: errors are logged but not returned.
 */
export async function markContractViewed(
  token: string
): Promise<{ success: boolean }> {
  try {
    const response = await fetch(
      `${getOpenSeoUrl()}/api/contracts/public/${token}/viewed`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      // Log error but don't fail - marking viewed is not critical
      console.error("Failed to mark contract viewed:", await response.text());
      return { success: false };
    }

    return { success: true };
  } catch {
    return { success: false };
  }
}

/**
 * Initiate signing via Dokobit.
 * Per D-21: Supports Smart-ID, Mobile-ID, ID Card via Dokobit.
 *
 * 1. Validates token and canSign
 * 2. Calls Dokobit API to create signing session
 * 3. Stores dokobitSessionId on signer
 * 4. Returns Dokobit redirect URL
 */
export async function initiateSigning(
  token: string,
  method: "smart-id" | "mobile-id" | "id-card" = "smart-id"
): Promise<{ redirectUrl: string } | { error: string }> {
  try {
    const response = await fetch(
      `${getOpenSeoUrl()}/api/contracts/public/${token}/sign`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      if (response.status === 403) {
        return { error: "cannot_sign_yet" };
      }
      if (response.status === 410) {
        return { error: "token_expired" };
      }
      return { error: data.error || "Failed to initiate signing" };
    }

    const result = await response.json();
    return { redirectUrl: result.redirectUrl };
  } catch {
    return { error: "network_error" };
  }
}

/**
 * Check signing status for polling.
 * Returns current signer status and signedAt timestamp if signed.
 */
export async function checkSigningStatus(
  token: string
): Promise<{ status: string; signedAt?: string } | { error: string }> {
  try {
    const response = await fetch(
      `${getOpenSeoUrl()}/api/contracts/public/${token}/status`,
      {
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { error: data.error || "Failed to check status" };
    }

    const result = await response.json();
    return {
      status: result.status,
      signedAt: result.signedAt,
    };
  } catch {
    return { error: "network_error" };
  }
}
