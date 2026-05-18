/**
 * ClientCreditRepository - Data access for client credits
 * Phase 101-02: Payment Reconciliation
 *
 * Handles CRUD for client_credits table, supporting:
 * - Overpayment credits (payment > invoice total)
 * - Prepayments
 * - Credit application to future invoices
 */
import { eq, and, gt, sql, isNull, or, gte } from "drizzle-orm";
import { db } from "@/db";
import {
  clientCredits,
  type ClientCreditSelect,
  type ClientCreditInsert,
  type CreditReason,
} from "@/db/payment-schema";
import { createId } from "@paralleldrive/cuid2";

export const ClientCreditRepository = {
  /**
   * Create a new client credit.
   */
  async create(
    data: Omit<ClientCreditInsert, "id">
  ): Promise<ClientCreditSelect> {
    const [credit] = await db
      .insert(clientCredits)
      .values({
        id: createId(),
        ...data,
      })
      .returning();
    return credit;
  },

  /**
   * Find credit by ID.
   */
  async findById(
    creditId: string,
    workspaceId: string
  ): Promise<ClientCreditSelect | null> {
    const [credit] = await db
      .select()
      .from(clientCredits)
      .where(
        and(
          eq(clientCredits.id, creditId),
          eq(clientCredits.workspaceId, workspaceId)
        )
      );
    return credit ?? null;
  },

  /**
   * Find all credits for a client with available balance.
   * Filters out expired and fully used credits.
   */
  async findAvailableByClientId(
    clientId: string,
    workspaceId: string
  ): Promise<ClientCreditSelect[]> {
    const now = new Date();
    return db
      .select()
      .from(clientCredits)
      .where(
        and(
          eq(clientCredits.clientId, clientId),
          eq(clientCredits.workspaceId, workspaceId),
          // Has remaining balance
          sql`${clientCredits.amountCents} > ${clientCredits.usedCents}`,
          // Not expired (expiresAt is null OR in the future)
          or(
            isNull(clientCredits.expiresAt),
            gte(clientCredits.expiresAt, now)
          )
        )
      );
  },

  /**
   * Get total available credit for a client (sum of unused amounts).
   */
  async getTotalAvailableForClient(
    clientId: string,
    workspaceId: string
  ): Promise<number> {
    const now = new Date();
    const [result] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${clientCredits.amountCents} - ${clientCredits.usedCents}), 0)`,
      })
      .from(clientCredits)
      .where(
        and(
          eq(clientCredits.clientId, clientId),
          eq(clientCredits.workspaceId, workspaceId),
          sql`${clientCredits.amountCents} > ${clientCredits.usedCents}`,
          or(
            isNull(clientCredits.expiresAt),
            gte(clientCredits.expiresAt, now)
          )
        )
      );
    return Number(result?.total ?? 0);
  },

  /**
   * Use credit (increment usedCents) with atomic balance check.
   *
   * CRITICAL: This method atomically verifies sufficient balance exists
   * before incrementing usedCents. The WHERE clause ensures that concurrent
   * requests cannot over-deplete credits (H-18 race condition fix).
   *
   * @returns Object with success flag and updated usedCents on success
   */
  async useCredit(
    creditId: string,
    workspaceId: string,
    amountCents: number
  ): Promise<{ success: boolean; newUsedCents?: number }> {
    // Atomic check-and-update: only succeeds if enough balance remains
    const [result] = await db
      .update(clientCredits)
      .set({
        usedCents: sql`${clientCredits.usedCents} + ${amountCents}`,
      })
      .where(
        and(
          eq(clientCredits.id, creditId),
          eq(clientCredits.workspaceId, workspaceId),
          // CRITICAL: Atomic balance check - prevents over-use (H-18)
          sql`${clientCredits.amountCents} - ${clientCredits.usedCents} >= ${amountCents}`,
          // Only use non-expired credits
          or(
            isNull(clientCredits.expiresAt),
            gt(clientCredits.expiresAt, sql`NOW()`)
          )
        )
      )
      .returning({ newUsedCents: clientCredits.usedCents });

    if (!result) {
      return { success: false };
    }

    return { success: true, newUsedCents: result.newUsedCents ?? undefined };
  },

  /**
   * Find all credits for a workspace.
   */
  async findByWorkspaceId(workspaceId: string): Promise<ClientCreditSelect[]> {
    return db
      .select()
      .from(clientCredits)
      .where(eq(clientCredits.workspaceId, workspaceId));
  },
};
