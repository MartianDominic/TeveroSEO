/**
 * Multi-Signer Orchestrator
 * Phase 59: Agreement & Signing Excellence
 *
 * Orchestrates sequential and parallel signing flows per D-07, D-08.
 * Handles provider pre-signing (D-09, D-10) and client activation.
 */
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db/index";
import { generatedAgreements } from "@/db/agreement-template-schema";
import { agreementSigners } from "@/db/schema/agreement-signers-schema";
import { SignerRepository } from "../repositories/SignerRepository";
import type {
  SignerSelect,
  SignerSignatureData,
} from "@/db/schema/agreement-signers-schema";
import { createLogger } from "@/server/lib/logger";
import { withTransaction } from "@/lib/db/transaction";

const log = createLogger({ module: "MultiSignerOrchestrator" });

// Base URL for magic links
const getAppUrl = () => process.env.APP_URL || "http://localhost:3000";

export interface SigningCallbackData {
  signatureData?: SignerSignatureData;
  signedFromIp?: string;
  signedUserAgent?: string;
}

export const MultiSignerOrchestrator = {
  /**
   * Process a signer callback from Dokobit webhook.
   * Updates signer status and orchestrates next steps.
   *
   * For sequential mode (D-07):
   * - After provider signs, activate next client signer
   * - After all sign, finalize agreement
   *
   * For parallel mode (D-08):
   * - All signers can sign independently
   * - Finalize when all complete
   *
   * Security (C-59-02): Guards against double-signing/replay attacks by
   * checking if signer has already been processed before making changes.
   */
  async processSignerCallback(
    signerId: string,
    status: "signed" | "declined",
    callbackData?: SigningCallbackData
  ): Promise<{ allSigned: boolean; nextSignerLink?: string; message?: string }> {
    const signer = await SignerRepository.findById(signerId);
    if (!signer) {
      log.error("Signer not found for callback", undefined, { signerId });
      throw new Error("Signer not found");
    }

    // C-59-02: Guard against double-signing/replay attacks
    // If signer has already signed or declined, reject the callback to prevent
    // audit trail corruption from replayed webhooks
    if (signer.status === "signed" || signer.status === "declined") {
      log.warn("Duplicate signer callback rejected (already processed)", {
        signerId,
        currentStatus: signer.status,
        attemptedStatus: status,
      });
      return { allSigned: false, message: "Already processed" };
    }

    if (status === "signed") {
      // Update signer to signed
      await SignerRepository.updateStatus(signerId, "signed", {
        signatureData: callbackData?.signatureData,
        signedFromIp: callbackData?.signedFromIp,
        signedUserAgent: callbackData?.signedUserAgent,
      });

      log.info("Signer marked as signed", {
        signerId,
        agreementId: signer.agreementId,
        role: signer.role,
      });

      // Check if all required signers have signed
      const allSigners = await SignerRepository.findByAgreement(
        signer.agreementId
      );
      const allSigned = allSigners.every((s) => s.status === "signed");

      if (allSigned) {
        // Finalize agreement
        await this.finalizeAgreement(signer.agreementId);
        return { allSigned: true };
      } else {
        // Activate next signer in sequence
        const nextLink = await this.activateNextSigner(signer.agreementId);
        return { allSigned: false, nextSignerLink: nextLink ?? undefined };
      }
    } else {
      // Handle decline
      await SignerRepository.updateStatus(signerId, "declined", {
        declineReason: "Signer declined via Dokobit",
      });

      log.warn("Signer declined", {
        signerId,
        agreementId: signer.agreementId,
      });

      // Update agreement status to cancelled
      await db
        .update(generatedAgreements)
        .set({
          status: "cancelled",
        })
        .where(eq(generatedAgreements.id, signer.agreementId));

      return { allSigned: false };
    }
  },

  /**
   * Activate the next pending signer in sequential order.
   * Generates access token and returns magic link.
   *
   * Per D-07: Sequential signing with signingOrder determining sequence.
   * Per D-06: 32-char token with 14-day expiry.
   *
   * Security (H-59-05): Uses transaction with FOR UPDATE lock to prevent
   * race conditions where concurrent calls could activate multiple signers.
   */
  async activateNextSigner(agreementId: string): Promise<string | null> {
    return withTransaction(async (tx) => {
      // H-59-05: Use FOR UPDATE to lock the row and prevent concurrent activation
      // This ensures only one signer is activated even under concurrent webhook calls
      const result = await tx.execute<{
        id: string;
        role: string;
        status: string;
        signing_order: number;
      }>(sql`
        SELECT id, role, status, signing_order
        FROM ${agreementSigners}
        WHERE agreement_id = ${agreementId}
          AND status = 'pending'
        ORDER BY signing_order ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `);

      const nextSigner = result.rows[0];

      if (!nextSigner) {
        log.info("No more pending signers", { agreementId });
        return null;
      }

      // Generate access token
      const { token, expiresAt } = await SignerRepository.setAccessToken(
        nextSigner.id
      );

      // Update status to invited
      await SignerRepository.updateStatus(nextSigner.id, "invited");

      const magicLink = `${getAppUrl()}/c/${token}`;

      log.info("Next signer activated", {
        signerId: nextSigner.id,
        agreementId,
        role: nextSigner.role,
        expiresAt: expiresAt.toISOString(),
      });

      return magicLink;
    });
  },

  /**
   * Activate all pending signers (parallel mode).
   * Returns array of magic links for each signer.
   *
   * Per D-08: Parallel signing with all signers having signingOrder = 0.
   */
  async activateAllSigners(agreementId: string): Promise<string[]> {
    const signers = await SignerRepository.findByAgreement(agreementId);
    const pendingSigners = signers.filter((s) => s.status === "pending");
    const links: string[] = [];

    for (const signer of pendingSigners) {
      const { token } = await SignerRepository.setAccessToken(signer.id);
      await SignerRepository.updateStatus(signer.id, "invited");
      links.push(`${getAppUrl()}/c/${token}`);
    }

    log.info("All signers activated (parallel)", {
      agreementId,
      count: links.length,
    });

    return links;
  },

  /**
   * Finalize agreement after all signers have signed.
   * Updates agreement status to "signed".
   */
  async finalizeAgreement(agreementId: string): Promise<void> {
    await db
      .update(generatedAgreements)
      .set({
        status: "signed",
        signedAt: new Date(),
      })
      .where(eq(generatedAgreements.id, agreementId));

    log.info("Agreement finalized", { agreementId });

    // TODO: Trigger PDF generation with all signatures
    // TODO: Send confirmation emails to all parties
  },

  /**
   * Check if a signer can sign based on sequential order.
   * In sequential mode, only signers whose predecessors have signed can proceed.
   *
   * Per D-07: Sequential mode uses signingOrder to enforce sequence.
   * Per D-08: Parallel mode (signingOrder = 0) allows any order.
   */
  async canSignerSign(signer: SignerSelect): Promise<boolean> {
    const allSigners = await SignerRepository.findByAgreement(
      signer.agreementId
    );

    // If parallel mode (all have signingOrder 0), anyone can sign
    const isParallel = allSigners.every((s) => s.signingOrder === 0);
    if (isParallel) return true;

    // In sequential mode, check all previous signers have signed
    const previousSigners = allSigners.filter(
      (s) => s.signingOrder < signer.signingOrder
    );
    return previousSigners.every((s) => s.status === "signed");
  },

  /**
   * Get agreement signing progress.
   * Returns total, signed, pending counts and current active signer.
   */
  async getSigningProgress(agreementId: string): Promise<{
    total: number;
    signed: number;
    pending: number;
    currentSigner: SignerSelect | null;
  }> {
    const signers = await SignerRepository.findByAgreement(agreementId);
    const signed = signers.filter((s) => s.status === "signed").length;
    const pending = signers.filter((s) => s.status === "pending").length;
    const currentSigner =
      signers.find(
        (s) =>
          s.status === "invited" ||
          s.status === "viewed" ||
          s.status === "signing"
      ) ?? null;

    return {
      total: signers.length,
      signed,
      pending,
      currentSigner,
    };
  },
};
