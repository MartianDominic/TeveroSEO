/**
 * Proposal signing service using Dokobit.
 * Phase 30-05: E-Signature (Dokobit)
 *
 * Handles the signing workflow:
 * 1. Generate contract PDF from proposal
 * 2. Initiate signing via Smart-ID or Mobile-ID
 * 3. Poll for completion
 * 4. Store signed PDF and update records
 */

import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/index";
import { proposalSignatures, proposals } from "@/db/proposal-schema";
import { createDokobitClient } from "@/server/lib/dokobit";
import type { SigningStatus } from "@/server/lib/dokobit";
import { ProposalService } from "../services/ProposalService";
import { generateContractPdf, calculateDocumentHash } from "./pdf";
import { putTextToR2 } from "@/server/lib/r2";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { getRequiredEnvValueSync } from "@/server/lib/runtime-env";
import { withTransaction, withIdempotency } from "@/lib/db/transaction";

const log = createLogger({ module: "SigningService" });

/**
 * Input parameters for initiating proposal signing.
 */
export interface InitiateSigningInput {
  proposalId: string;
  accessToken: string;
  method: "smart_id" | "mobile_id";
  personalCode: string;
  phoneNumber?: string;
  signerName: string;
  country?: "LT" | "EE" | "LV";
}

/**
 * Result of initiating a signing session.
 */
export interface InitiateSigningResult {
  sessionId: string;
  verificationCode: string;
  signatureId: string;
}

/**
 * Validates a Lithuanian personal code format.
 * Must be exactly 11 digits.
 *
 * @param personalCode - Personal identification code
 * @returns true if valid format
 */
export function validatePersonalCode(personalCode: string): boolean {
  if (!personalCode || personalCode.length !== 11) {
    return false;
  }
  return /^\d{11}$/.test(personalCode);
}

/**
 * Hashes personal code with salt for GDPR-compliant storage.
 * Uses SHA256 with application salt.
 *
 * @param personalCode - Raw personal identification code
 * @returns SHA256 hash as hex string
 */
export function hashPersonalCode(personalCode: string): string {
  const salt = getRequiredEnvValueSync("PERSONAL_CODE_SALT");
  return createHash("sha256")
    .update(personalCode + salt)
    .digest("hex");
}

/**
 * Initiates e-signature process for a proposal.
 *
 * Steps:
 * 1. Verify proposal exists and is in "accepted" status
 * 2. Generate contract PDF
 * 3. Calculate document hash for signing
 * 4. Initiate signing via Dokobit (Smart-ID or Mobile-ID)
 * 5. Store signature record in database
 *
 * @param input - Signing parameters
 * @returns Session info with verification code
 * @throws Error if proposal not found or not in accepted status
 *
 * @example
 * const result = await initiateProposalSigning({
 *   proposalId: "proposal-123",
 *   method: "smart_id",
 *   personalCode: "38501010001",
 *   signerName: "Jonas Jonaitis",
 * });
 * // result.verificationCode = "1234" (show to user)
 */
export async function initiateProposalSigning(
  input: InitiateSigningInput
): Promise<InitiateSigningResult> {
  const { proposalId, accessToken, method, personalCode, phoneNumber, signerName, country = "LT" } = input;

  log.info("Initiating proposal signing", { proposalId, method });

  // 1. Verify proposal exists
  const proposal = await ProposalService.findById(proposalId);

  if (!proposal) {
    throw new AppError("NOT_FOUND", "Proposal not found");
  }

  // 2. Verify caller is authorized (token must match)
  if (proposal.token !== accessToken) {
    throw new AppError("FORBIDDEN", "Not authorized to sign this proposal");
  }

  // 3. Verify proposal is in accepted status
  if (proposal.status !== "accepted") {
    throw new AppError("VALIDATION_ERROR", "Proposal must be accepted before signing");
  }

  // 2. Generate contract PDF
  const pdfBuffer = await generateContractPdf(proposal);

  // 3. Calculate document hash
  const documentHash = calculateDocumentHash(pdfBuffer);

  // 4. Initiate signing via Dokobit
  const dokobit = createDokobitClient();
  const documentName = `SEO Sutartis - ${proposal.id}`;

  const session =
    method === "smart_id"
      ? await dokobit.initiateSmartIdSigning({
          personalCode,
          country,
          documentHash,
          documentName,
        })
      : await dokobit.initiateMobileIdSigning({
          personalCode,
          phoneNumber: phoneNumber!,
          country,
          documentHash,
          documentName,
        });

  // 5. Store signature record
  const signatureId = nanoid();
  const personalCodeHash = hashPersonalCode(personalCode);

  try {
    await db.insert(proposalSignatures).values({
      id: signatureId,
      proposalId,
      signerName,
      signerPersonalCodeHash: personalCodeHash,
      signingMethod: method,
      dokobitSessionId: session.sessionId,
    }).returning();
  } catch (dbError) {
    // Rollback: Cancel external Dokobit session if DB insert fails
    const dbErr = dbError instanceof Error ? dbError : new Error(String(dbError));
    log.error("Failed to store signature record, cancelling Dokobit session", dbErr, {
      proposalId,
      sessionId: session.sessionId,
    });

    try {
      await dokobit.cancelSession(session.sessionId);
    } catch (cancelError) {
      // Log but don't throw - the original error is more important
      const cancelErr = cancelError instanceof Error ? cancelError : new Error(String(cancelError));
      log.error("Failed to cancel Dokobit session after DB error", cancelErr, {
        sessionId: session.sessionId,
      });
    }

    throw dbError;
  }

  log.info("Signing session initiated", {
    proposalId,
    signatureId,
    sessionId: session.sessionId,
  });

  return {
    sessionId: session.sessionId,
    verificationCode: session.verificationCode,
    signatureId,
  };
}

/**
 * Checks the status of a signing session.
 *
 * When completed:
 * - Downloads signed PDF from Dokobit
 * - Uploads to R2 storage
 * - Updates signature record with PDF URL
 * - Updates proposal status to "signed"
 *
 * @param proposalId - Proposal ID
 * @param sessionId - Dokobit session ID
 * @returns Current signing status
 */
export async function checkSigningStatus(
  proposalId: string,
  sessionId: string
): Promise<SigningStatus> {
  const dokobit = createDokobitClient();
  const status = await dokobit.getSigningStatus(sessionId);

  log.info("Checking signing status", { proposalId, sessionId, status: status.status });

  if (status.status === "completed") {
    await handleSigningCompletion(proposalId, sessionId);
  }

  return status;
}

/**
 * Handles successful signing completion.
 * Downloads signed PDF, stores it, and updates records.
 *
 * Uses idempotency to prevent duplicate processing and
 * wraps database updates in a transaction for atomicity.
 */
async function handleSigningCompletion(
  proposalId: string,
  sessionId: string
): Promise<void> {
  // Use idempotency to prevent duplicate processing of the same signing completion
  const idempotencyKey = `signing:complete:${proposalId}:${sessionId}`;

  await withIdempotency(
    idempotencyKey,
    async () => {
      log.info("Handling signing completion", { proposalId, sessionId });

      const dokobit = createDokobitClient();

      // Download signed PDF (external operation, before transaction)
      const signedPdf = await dokobit.downloadSignedDocument(sessionId);

      // Upload to R2 storage (external operation, before transaction)
      const storageKey = `proposals/${proposalId}/signed-contract.pdf`;
      await putTextToR2(storageKey, signedPdf.toString("base64"));

      const signedPdfUrl = `/api/proposals/${proposalId}/signed-pdf`;
      const now = new Date();

      // Wrap all database updates in a single transaction
      await withTransaction(async (tx) => {
        // Update signature record
        await tx
          .update(proposalSignatures)
          .set({
            signedPdfUrl,
            signedAt: now,
          })
          .where(eq(proposalSignatures.dokobitSessionId, sessionId));

        // Update proposal status to signed
        await tx
          .update(proposals)
          .set({
            status: "signed",
            signedAt: now,
            updatedAt: now,
          })
          .where(eq(proposals.id, proposalId));
      });

      log.info("Signing completed and recorded", {
        proposalId,
        sessionId,
        signedPdfUrl,
      });

      return { success: true };
    },
    86400 // 24 hour TTL
  );
}
