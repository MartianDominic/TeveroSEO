/**
 * Dokobit e-signature service stub.
 * Phase 48-01: Contract Generation
 * Full implementation in Task 3.
 */

export interface DokobitSigningResponse {
  sessionId: string;
  signingUrl: string;
}

export interface DokobitSignedDocument {
  signedPdfBase64: string;
  signerName: string;
  signedAt: Date;
}

async function createSigningSession(
  contractId: string,
  pdfBuffer: Buffer,
  webhookUrl: string,
): Promise<DokobitSigningResponse> {
  throw new Error("Not implemented - Task 3");
}

async function downloadSignedDocument(
  sessionId: string,
): Promise<DokobitSignedDocument> {
  throw new Error("Not implemented - Task 3");
}

export const DokobitService = {
  createSigningSession,
  downloadSignedDocument,
};
