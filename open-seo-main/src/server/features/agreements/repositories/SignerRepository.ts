/**
 * Signer Repository
 * Phase 59: Agreement & Signing Excellence
 *
 * CRUD operations for agreement signers with status transitions.
 * Implements D-05 (status state machine) and D-06 (token management).
 */
import { eq, and, gt, asc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { addDays } from "date-fns";
import { db } from "@/db/index";
import {
  agreementSigners,
  type SignerSelect,
  type SignerInsert,
  type SignerStatus,
  type SignerSignatureData,
} from "@/db/schema/agreement-signers-schema";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "SignerRepository" });

// Token length per D-06: 32-char nanoid (~10^57 entropy)
const TOKEN_LENGTH = 32;
// Token expiry per D-06: 14 days
const TOKEN_EXPIRY_DAYS = 14;

export const SignerRepository = {
  /**
   * Find a signer by ID.
   */
  async findById(id: string): Promise<SignerSelect | null> {
    const [signer] = await db
      .select()
      .from(agreementSigners)
      .where(eq(agreementSigners.id, id))
      .limit(1);
    return signer ?? null;
  },

  /**
   * Find all signers for an agreement, ordered by signing order.
   */
  async findByAgreement(agreementId: string): Promise<SignerSelect[]> {
    return db
      .select()
      .from(agreementSigners)
      .where(eq(agreementSigners.agreementId, agreementId))
      .orderBy(asc(agreementSigners.signingOrder));
  },

  /**
   * Find a signer by access token (validates expiry).
   * Returns null if token expired or not found.
   */
  async findByToken(token: string): Promise<SignerSelect | null> {
    const now = new Date();
    const [signer] = await db
      .select()
      .from(agreementSigners)
      .where(
        and(
          eq(agreementSigners.accessToken, token),
          gt(agreementSigners.tokenExpiresAt, now)
        )
      )
      .limit(1);
    return signer ?? null;
  },

  /**
   * Find a signer by Dokobit session ID.
   * Used for webhook processing.
   */
  async findByDokobitSession(sessionId: string): Promise<SignerSelect | null> {
    const [signer] = await db
      .select()
      .from(agreementSigners)
      .where(eq(agreementSigners.dokobitSessionId, sessionId))
      .limit(1);
    return signer ?? null;
  },

  /**
   * Find the next pending signer in signing order.
   * Used for sequential signing mode.
   */
  async findNextPending(agreementId: string): Promise<SignerSelect | null> {
    const [signer] = await db
      .select()
      .from(agreementSigners)
      .where(
        and(
          eq(agreementSigners.agreementId, agreementId),
          eq(agreementSigners.status, "pending")
        )
      )
      .orderBy(asc(agreementSigners.signingOrder))
      .limit(1);
    return signer ?? null;
  },

  /**
   * Create a new signer.
   */
  async create(data: SignerInsert): Promise<SignerSelect> {
    const [signer] = await db
      .insert(agreementSigners)
      .values({
        ...data,
        id: data.id || nanoid(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    log.info("Signer created", {
      signerId: signer.id,
      agreementId: data.agreementId,
      role: data.role,
    });
    return signer;
  },

  /**
   * Update signer status with appropriate timestamp.
   * Per D-05: pending -> invited -> viewed -> signing -> signed | declined
   */
  async updateStatus(
    signerId: string,
    status: SignerStatus,
    data?: Partial<{
      declineReason: string;
      signatureData: SignerSignatureData;
      signedFromIp: string;
      signedUserAgent: string;
    }>
  ): Promise<SignerSelect> {
    const timestampField = this.getTimestampField(status);
    const updateData: Record<string, unknown> = {
      status,
      updatedAt: new Date(),
      ...data,
    };

    if (timestampField) {
      updateData[timestampField] = new Date();
    }

    const [updated] = await db
      .update(agreementSigners)
      .set(updateData)
      .where(eq(agreementSigners.id, signerId))
      .returning();

    log.info("Signer status updated", { signerId, status });
    return updated;
  },

  /**
   * Generate and set an access token for a signer.
   * Per D-06: 32-char nanoid with 14-day expiry.
   */
  async setAccessToken(
    signerId: string
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = nanoid(TOKEN_LENGTH);
    const expiresAt = addDays(new Date(), TOKEN_EXPIRY_DAYS);

    await db
      .update(agreementSigners)
      .set({
        accessToken: token,
        tokenExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(agreementSigners.id, signerId));

    log.info("Access token set", {
      signerId,
      expiresAt: expiresAt.toISOString(),
    });
    return { token, expiresAt };
  },

  /**
   * Set Dokobit session ID for a signer.
   * Used when initiating signing via Dokobit.
   */
  async setDokobitSession(signerId: string, sessionId: string): Promise<void> {
    await db
      .update(agreementSigners)
      .set({
        dokobitSessionId: sessionId,
        updatedAt: new Date(),
      })
      .where(eq(agreementSigners.id, signerId));

    log.info("Dokobit session set", { signerId, sessionId });
  },

  /**
   * Get the timestamp field for a given status.
   * Per D-05 state machine.
   */
  getTimestampField(status: SignerStatus): string | null {
    const statusToField: Record<SignerStatus, string | null> = {
      pending: null,
      invited: "invitedAt",
      viewed: "viewedAt",
      signing: null,
      signed: "signedAt",
      declined: "declinedAt",
    };
    return statusToField[status];
  },
};
