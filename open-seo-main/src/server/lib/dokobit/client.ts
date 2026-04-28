/**
 * Dokobit API client for Smart-ID and Mobile-ID signing.
 * Phase 30-05: E-Signature (Dokobit)
 *
 * Provides eIDAS qualified electronic signatures via:
 * - Smart-ID: App-based signing for Baltic countries
 * - Mobile-ID: SIM-based signing for all EU
 *
 * @see https://developers.dokobit.com/
 */

import type {
  DokobitClient,
  SmartIdSigningParams,
  MobileIdSigningParams,
  SigningSession,
  SigningStatus,
  SigningStatusValue,
} from "./types";

/**
 * Dokobit API base URL.
 * Production: https://api.dokobit.com
 */
const DOKOBIT_BASE_URL = "https://api.dokobit.com";

/** Timeout for signing operations (2 minutes - signing can take time) */
const DOKOBIT_SIGNING_TIMEOUT_MS = 120000;

/** Timeout for status checks (30 seconds) */
const DOKOBIT_STATUS_TIMEOUT_MS = 30000;

/**
 * Dokobit API response types (internal).
 */
interface DokobitSigningResponse {
  session_id: string;
  verification_code: string;
}

interface DokobitStatusResponse {
  status: SigningStatusValue;
  signed_document_url?: string;
  error_message?: string;
}

/**
 * Creates a Dokobit API client.
 *
 * Requires DOKOBIT_ACCESS_TOKEN environment variable.
 *
 * @throws Error if DOKOBIT_ACCESS_TOKEN is not configured
 * @returns DokobitClient instance
 *
 * @example
 * const client = createDokobitClient();
 * const session = await client.initiateSmartIdSigning({
 *   personalCode: "38501010001",
 *   country: "LT",
 *   documentHash: sha256Hash,
 *   documentName: "SEO Sutartis",
 * });
 */
export function createDokobitClient(): DokobitClient {
  const accessToken = process.env.DOKOBIT_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error("DOKOBIT_ACCESS_TOKEN not configured");
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  return {
    async initiateSmartIdSigning(params: SmartIdSigningParams): Promise<SigningSession> {
      const response = await fetch(`${DOKOBIT_BASE_URL}/signing/smartid/sign`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          // Format: PNOLT-38501010001 (Personal Number + Country + Code)
          pno: `PNO${params.country}-${params.personalCode}`,
          hash: params.documentHash,
          hash_type: "SHA256",
          message: `Pasirasyti: ${params.documentName}`,
        }),
        signal: AbortSignal.timeout(DOKOBIT_SIGNING_TIMEOUT_MS),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Dokobit error: ${errorText}`);
      }

      const data: DokobitSigningResponse = await response.json();
      return {
        sessionId: data.session_id,
        verificationCode: data.verification_code,
      };
    },

    async initiateMobileIdSigning(params: MobileIdSigningParams): Promise<SigningSession> {
      const response = await fetch(`${DOKOBIT_BASE_URL}/signing/mobileid/sign`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          phone: params.phoneNumber,
          pno: `PNO${params.country}-${params.personalCode}`,
          hash: params.documentHash,
          hash_type: "SHA256",
          message: `Pasirasyti: ${params.documentName}`,
        }),
        signal: AbortSignal.timeout(DOKOBIT_SIGNING_TIMEOUT_MS),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Dokobit error: ${errorText}`);
      }

      const data: DokobitSigningResponse = await response.json();
      return {
        sessionId: data.session_id,
        verificationCode: data.verification_code,
      };
    },

    async getSigningStatus(sessionId: string): Promise<SigningStatus> {
      const response = await fetch(
        `${DOKOBIT_BASE_URL}/signing/session/${sessionId}/status`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(DOKOBIT_STATUS_TIMEOUT_MS),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Dokobit error: ${errorText}`);
      }

      const data: DokobitStatusResponse = await response.json();
      return {
        status: data.status,
        signedDocumentUrl: data.signed_document_url,
        error: data.error_message,
      };
    },

    async downloadSignedDocument(sessionId: string): Promise<Buffer> {
      const response = await fetch(
        `${DOKOBIT_BASE_URL}/signing/session/${sessionId}/download`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(DOKOBIT_STATUS_TIMEOUT_MS),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Dokobit error: ${errorText}`);
      }

      return Buffer.from(await response.arrayBuffer());
    },

    async cancelSession(sessionId: string): Promise<void> {
      const response = await fetch(
        `${DOKOBIT_BASE_URL}/signing/session/${sessionId}/cancel`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(DOKOBIT_STATUS_TIMEOUT_MS),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Dokobit cancel error: ${errorText}`);
      }
    },
  };
}

export * from "./types";
