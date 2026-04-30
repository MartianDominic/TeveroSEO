/**
 * Dokobit e-signature service.
 * Phase 48-01: Contract Generation - Task 3
 *
 * Integrates with Dokobit API for e-signature sessions and signed document retrieval.
 * Security: IP whitelisting on webhook endpoint (Dokobit does not provide HMAC signatures).
 */
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";

const log = createLogger({ module: "DokobitService" });

export interface DokobitSigningResponse {
  sessionId: string;
  signingUrl: string;
}

export interface DokobitSignedDocument {
  signedPdfBase64: string;
  signerName: string;
  signedAt: Date;
}

/**
 * Create a Dokobit signing session for a contract PDF.
 * Per D-03: Returns session ID and URL for client redirect.
 *
 * @throws AUTH_CONFIG_MISSING if DOKOBIT_ACCESS_TOKEN not configured
 * @throws DOKOBIT_API_ERROR if API request fails
 */
async function createSigningSession(
  contractId: string,
  pdfBuffer: Buffer,
  webhookUrl: string,
): Promise<DokobitSigningResponse> {
  const accessToken = await getOptionalEnvValue("DOKOBIT_ACCESS_TOKEN");
  if (!accessToken) {
    throw new AppError("AUTH_CONFIG_MISSING", "DOKOBIT_ACCESS_TOKEN not configured");
  }

  const apiUrl = (await getOptionalEnvValue("DOKOBIT_API_URL")) || "https://beta.dokobit.com";

  const payload = {
    access_token: accessToken,
    files: [
      {
        name: `contract-${contractId}.pdf`,
        content: pdfBuffer.toString("base64"),
      },
    ],
    signers: [
      {
        signing_purpose: "Client Agreement Signature",
      },
    ],
    postback_url: webhookUrl,
  };

  log.info("Creating Dokobit signing session", { contractId });

  try {
    const response = await fetch(`${apiUrl}/api/signing/create.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error("Dokobit API error", { status: response.status, error: errorText });
      throw new AppError("DOKOBIT_API_ERROR", `Dokobit API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.session_id || !data.url) {
      log.error("Dokobit response missing required fields", { data });
      throw new AppError("DOKOBIT_API_ERROR", "Invalid Dokobit response");
    }

    log.info("Dokobit session created", { contractId, sessionId: data.session_id });

    return {
      sessionId: data.session_id,
      signingUrl: data.url,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    log.error("Dokobit API request failed", { error });
    throw new AppError("EXTERNAL_SERVICE_ERROR", "Failed to create signing session");
  }
}

/**
 * Download signed document from Dokobit.
 * Called after webhook confirms signing complete.
 *
 * @throws AUTH_CONFIG_MISSING if DOKOBIT_ACCESS_TOKEN not configured
 * @throws DOKOBIT_API_ERROR if download fails
 */
async function downloadSignedDocument(
  sessionId: string,
): Promise<DokobitSignedDocument> {
  const accessToken = await getOptionalEnvValue("DOKOBIT_ACCESS_TOKEN");
  if (!accessToken) {
    throw new AppError("AUTH_CONFIG_MISSING", "DOKOBIT_ACCESS_TOKEN not configured");
  }

  const apiUrl = (await getOptionalEnvValue("DOKOBIT_API_URL")) || "https://beta.dokobit.com";

  try {
    const response = await fetch(
      `${apiUrl}/api/signing/${sessionId}/download.json?access_token=${accessToken}`,
      { method: "GET" }
    );

    if (!response.ok) {
      throw new AppError("DOKOBIT_API_ERROR", `Download failed: ${response.status}`);
    }

    const data = await response.json();

    return {
      signedPdfBase64: data.file_content,
      signerName: data.signer_name || "Unknown",
      signedAt: new Date(),
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("EXTERNAL_SERVICE_ERROR", "Failed to download signed document");
  }
}

export const DokobitService = {
  createSigningSession,
  downloadSignedDocument,
};
