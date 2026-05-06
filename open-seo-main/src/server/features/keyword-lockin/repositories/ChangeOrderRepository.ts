/**
 * Change Order Repository
 * Phase 89-04: Out-of-Scope Detection
 *
 * CRUD operations for change_orders table.
 */
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  changeOrders,
  type ChangeOrderInsert,
  type ChangeOrderSelect,
  type ChangeOrderStatus,
} from "@/db/keyword-lockin-schema";

/**
 * Insert a new change order.
 */
export async function insertChangeOrder(
  changeOrder: ChangeOrderInsert
): Promise<ChangeOrderSelect> {
  const [inserted] = await db
    .insert(changeOrders)
    .values(changeOrder)
    .returning();
  return inserted;
}

/**
 * Get change orders for a contract.
 */
export async function getChangeOrdersByContract(
  contractId: string,
  options?: {
    status?: ChangeOrderStatus;
    limit?: number;
  }
): Promise<ChangeOrderSelect[]> {
  const conditions = [eq(changeOrders.contractId, contractId)];

  if (options?.status) {
    conditions.push(eq(changeOrders.status, options.status));
  }

  return await db
    .select()
    .from(changeOrders)
    .where(and(...conditions))
    .orderBy(desc(changeOrders.createdAt))
    .limit(options?.limit ?? 50);
}

/**
 * Get change order by ID.
 */
export async function getChangeOrderById(
  changeOrderId: string
): Promise<ChangeOrderSelect | undefined> {
  const [changeOrder] = await db
    .select()
    .from(changeOrders)
    .where(eq(changeOrders.id, changeOrderId))
    .limit(1);
  return changeOrder;
}

/**
 * Update change order status to sent.
 */
export async function sendChangeOrder(
  changeOrderId: string
): Promise<ChangeOrderSelect | undefined> {
  const [updated] = await db
    .update(changeOrders)
    .set({ status: "sent" })
    .where(
      and(
        eq(changeOrders.id, changeOrderId),
        eq(changeOrders.status, "draft")
      )
    )
    .returning();
  return updated;
}

/**
 * Approve a change order.
 */
export async function approveChangeOrder(
  changeOrderId: string,
  approvedBy: string
): Promise<ChangeOrderSelect | undefined> {
  const [updated] = await db
    .update(changeOrders)
    .set({
      status: "approved",
      approvedAt: new Date(),
      approvedBy,
    })
    .where(
      and(
        eq(changeOrders.id, changeOrderId),
        eq(changeOrders.status, "sent")
      )
    )
    .returning();
  return updated;
}

/**
 * Reject a change order.
 */
export async function rejectChangeOrder(
  changeOrderId: string
): Promise<ChangeOrderSelect | undefined> {
  const [updated] = await db
    .update(changeOrders)
    .set({ status: "rejected" })
    .where(
      and(
        eq(changeOrders.id, changeOrderId),
        eq(changeOrders.status, "sent")
      )
    )
    .returning();
  return updated;
}

/**
 * Update change order content (draft only).
 */
export async function updateChangeOrder(
  changeOrderId: string,
  updates: Partial<Pick<ChangeOrderSelect, "description" | "keywordsAdded" | "keywordsRemoved" | "additionalFee" | "feeType">>
): Promise<ChangeOrderSelect | undefined> {
  const [updated] = await db
    .update(changeOrders)
    .set(updates)
    .where(
      and(
        eq(changeOrders.id, changeOrderId),
        eq(changeOrders.status, "draft")
      )
    )
    .returning();
  return updated;
}

export const ChangeOrderRepository = {
  insertChangeOrder,
  getChangeOrdersByContract,
  getChangeOrderById,
  sendChangeOrder,
  approveChangeOrder,
  rejectChangeOrder,
  updateChangeOrder,
};
