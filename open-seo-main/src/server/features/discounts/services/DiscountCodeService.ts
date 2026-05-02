/**
 * Discount Code Service
 * Phase 60-04: Payment Flexibility - Discount Codes
 *
 * Handles discount code validation, calculation, and application.
 *
 * Features:
 * - Code validation (existence, active status, validity window, usage limits)
 * - Discount calculation (percentage and fixed)
 * - Usage tracking and limit enforcement
 * - Per-customer usage limits
 */
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  discountCodes,
  discountCodeUsages,
  type DiscountCodeSelect,
  type DiscountCodeInsert,
  type DiscountCodeUsageInsert,
  type DiscountType,
} from "@/db/discount-code-schema";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";
import { nanoid } from "nanoid";

const log = createLogger({ module: "DiscountCodeService" });

/**
 * Result of validating a discount code.
 */
export interface DiscountValidationResult {
  /** Whether the code is valid */
  valid: boolean;

  /** The discount code record (if valid) */
  discountCode?: DiscountCodeSelect;

  /** Error message (if invalid) */
  errorMessage?: string;

  /** Error code for programmatic handling */
  errorCode?:
    | "NOT_FOUND"
    | "INACTIVE"
    | "EXPIRED"
    | "NOT_YET_VALID"
    | "MAX_USES_REACHED"
    | "CUSTOMER_LIMIT_REACHED"
    | "MINIMUM_NOT_MET";
}

/**
 * Result of calculating a discount.
 */
export interface DiscountCalculationResult {
  /** Original amount in cents */
  originalAmountCents: number;

  /** Discount amount in cents */
  discountAmountCents: number;

  /** Final amount after discount in cents */
  finalAmountCents: number;

  /** Discount code applied */
  discountCode: string;

  /** Discount type */
  discountType: DiscountType;

  /** Human-readable discount description */
  discountDescription: string;
}

/**
 * Validate a discount code for use.
 *
 * @param code - The discount code to validate
 * @param workspaceId - Workspace context
 * @param amountCents - Order amount for minimum check (optional)
 * @param clientId - Client ID for per-customer limit check (optional)
 */
export async function validateCode(
  code: string,
  workspaceId: string,
  amountCents?: number,
  clientId?: string
): Promise<DiscountValidationResult> {
  // Normalize code (uppercase, trim)
  const normalizedCode = code.trim().toUpperCase();

  // Find the discount code
  const [discountCode] = await db
    .select()
    .from(discountCodes)
    .where(
      and(
        eq(discountCodes.workspaceId, workspaceId),
        sql`UPPER(${discountCodes.code}) = ${normalizedCode}`
      )
    )
    .limit(1);

  if (!discountCode) {
    return {
      valid: false,
      errorMessage: "Discount code not found",
      errorCode: "NOT_FOUND",
    };
  }

  // Check if active
  if (!discountCode.isActive) {
    return {
      valid: false,
      errorMessage: "Discount code is no longer active",
      errorCode: "INACTIVE",
    };
  }

  // Check validity window
  const now = new Date();

  if (discountCode.validFrom && now < discountCode.validFrom) {
    return {
      valid: false,
      errorMessage: "Discount code is not yet valid",
      errorCode: "NOT_YET_VALID",
    };
  }

  if (discountCode.validUntil && now > discountCode.validUntil) {
    return {
      valid: false,
      errorMessage: "Discount code has expired",
      errorCode: "EXPIRED",
    };
  }

  // Check global usage limit
  if (
    discountCode.maxUses !== null &&
    discountCode.usedCount >= discountCode.maxUses
  ) {
    return {
      valid: false,
      errorMessage: "Discount code has reached its usage limit",
      errorCode: "MAX_USES_REACHED",
    };
  }

  // Check per-customer usage limit
  if (discountCode.maxUsesPerCustomer !== null && clientId) {
    const [customerUsageResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(discountCodeUsages)
      .where(
        and(
          eq(discountCodeUsages.discountCodeId, discountCode.id),
          eq(discountCodeUsages.clientId, clientId)
        )
      );

    const customerUsageCount = customerUsageResult?.count ?? 0;

    if (customerUsageCount >= discountCode.maxUsesPerCustomer) {
      return {
        valid: false,
        errorMessage: "You have already used this discount code",
        errorCode: "CUSTOMER_LIMIT_REACHED",
      };
    }
  }

  // Check minimum order amount
  if (
    discountCode.minAmountCents !== null &&
    amountCents !== undefined &&
    amountCents < discountCode.minAmountCents
  ) {
    const minAmountFormatted = (discountCode.minAmountCents / 100).toFixed(2);
    return {
      valid: false,
      errorMessage: `Minimum order amount of ${minAmountFormatted} required`,
      errorCode: "MINIMUM_NOT_MET",
    };
  }

  return {
    valid: true,
    discountCode,
  };
}

/**
 * Calculate the discount amount for a given code and order amount.
 *
 * @param discountCode - The validated discount code
 * @param amountCents - The order amount in cents
 */
export function calculateDiscount(
  discountCode: DiscountCodeSelect,
  amountCents: number
): DiscountCalculationResult {
  let discountAmountCents: number;
  let discountDescription: string;

  if (discountCode.discountType === "percentage") {
    // discountValue is in basis points (e.g., 2000 = 20%)
    const percentageValue = discountCode.discountValue / 100;
    discountAmountCents = Math.floor((amountCents * discountCode.discountValue) / 10000);

    // Apply max discount cap if set
    if (
      discountCode.maxDiscountCents !== null &&
      discountAmountCents > discountCode.maxDiscountCents
    ) {
      discountAmountCents = discountCode.maxDiscountCents;
    }

    discountDescription = `${percentageValue}% off`;
  } else {
    // Fixed amount discount
    discountAmountCents = discountCode.discountValue;

    // Cannot discount more than the order total
    if (discountAmountCents > amountCents) {
      discountAmountCents = amountCents;
    }

    discountDescription = `${(discountCode.discountValue / 100).toFixed(2)} off`;
  }

  const finalAmountCents = amountCents - discountAmountCents;

  return {
    originalAmountCents: amountCents,
    discountAmountCents,
    finalAmountCents,
    discountCode: discountCode.code,
    discountType: discountCode.discountType as DiscountType,
    discountDescription,
  };
}

/**
 * Validate and calculate discount in one operation.
 * Convenience method for checkout flow.
 *
 * @param code - The discount code to apply
 * @param workspaceId - Workspace context
 * @param amountCents - Order amount in cents
 * @param clientId - Client ID for per-customer limits (optional)
 */
export async function validateAndCalculate(
  code: string,
  workspaceId: string,
  amountCents: number,
  clientId?: string
): Promise<DiscountValidationResult & { calculation?: DiscountCalculationResult }> {
  const validation = await validateCode(code, workspaceId, amountCents, clientId);

  if (!validation.valid || !validation.discountCode) {
    return validation;
  }

  const calculation = calculateDiscount(validation.discountCode, amountCents);

  return {
    ...validation,
    calculation,
  };
}

/**
 * Apply a discount code to an invoice.
 * Records usage and increments the usage counter.
 *
 * @param discountCodeId - The discount code ID
 * @param invoiceId - The invoice ID
 * @param discountAmountCents - The calculated discount amount
 * @param clientId - The client ID (optional)
 */
export async function applyToInvoice(
  discountCodeId: string,
  invoiceId: string,
  discountAmountCents: number,
  clientId?: string
): Promise<void> {
  // Record usage
  const usageInsert: DiscountCodeUsageInsert = {
    id: nanoid(),
    discountCodeId,
    invoiceId,
    clientId,
    discountAmountCents,
  };

  await db.insert(discountCodeUsages).values(usageInsert);

  // Increment usage counter
  await db
    .update(discountCodes)
    .set({
      usedCount: sql`${discountCodes.usedCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(discountCodes.id, discountCodeId));

  log.info("Discount code applied to invoice", {
    discountCodeId,
    invoiceId,
    discountAmountCents,
  });
}

/**
 * Create a new discount code.
 *
 * @param data - Discount code data
 */
export async function createDiscountCode(
  data: Omit<DiscountCodeInsert, "id" | "usedCount" | "createdAt" | "updatedAt">
): Promise<DiscountCodeSelect> {
  // Normalize code to uppercase
  const normalizedCode = data.code.trim().toUpperCase();

  // Check for duplicate code in workspace
  const [existing] = await db
    .select()
    .from(discountCodes)
    .where(
      and(
        eq(discountCodes.workspaceId, data.workspaceId),
        sql`UPPER(${discountCodes.code}) = ${normalizedCode}`
      )
    )
    .limit(1);

  if (existing) {
    throw new AppError("CONFLICT", `Discount code "${normalizedCode}" already exists`);
  }

  const insert: DiscountCodeInsert = {
    ...data,
    id: nanoid(),
    code: normalizedCode,
    usedCount: 0,
  };

  const [created] = await db.insert(discountCodes).values(insert).returning();

  log.info("Discount code created", {
    id: created.id,
    code: created.code,
    workspaceId: created.workspaceId,
  });

  return created;
}

/**
 * Get a discount code by ID.
 *
 * @param id - Discount code ID
 * @param workspaceId - Workspace context for authorization
 */
export async function getById(
  id: string,
  workspaceId: string
): Promise<DiscountCodeSelect | null> {
  const [discountCode] = await db
    .select()
    .from(discountCodes)
    .where(
      and(
        eq(discountCodes.id, id),
        eq(discountCodes.workspaceId, workspaceId)
      )
    )
    .limit(1);

  return discountCode ?? null;
}

/**
 * List all discount codes for a workspace.
 *
 * @param workspaceId - Workspace context
 * @param includeInactive - Include inactive codes (default: false)
 */
export async function listByWorkspace(
  workspaceId: string,
  includeInactive = false
): Promise<DiscountCodeSelect[]> {
  const conditions = [eq(discountCodes.workspaceId, workspaceId)];

  if (!includeInactive) {
    conditions.push(eq(discountCodes.isActive, true));
  }

  return db
    .select()
    .from(discountCodes)
    .where(and(...conditions))
    .orderBy(discountCodes.createdAt);
}

/**
 * Update a discount code.
 *
 * @param id - Discount code ID
 * @param workspaceId - Workspace context for authorization
 * @param updates - Fields to update
 */
export async function updateDiscountCode(
  id: string,
  workspaceId: string,
  updates: Partial<
    Pick<
      DiscountCodeInsert,
      | "description"
      | "maxUses"
      | "maxUsesPerCustomer"
      | "minAmountCents"
      | "maxDiscountCents"
      | "validFrom"
      | "validUntil"
      | "isActive"
    >
  >
): Promise<DiscountCodeSelect | null> {
  const [updated] = await db
    .update(discountCodes)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(discountCodes.id, id),
        eq(discountCodes.workspaceId, workspaceId)
      )
    )
    .returning();

  if (updated) {
    log.info("Discount code updated", { id, workspaceId });
  }

  return updated ?? null;
}

/**
 * Deactivate a discount code (soft delete).
 *
 * @param id - Discount code ID
 * @param workspaceId - Workspace context for authorization
 */
export async function deactivateCode(
  id: string,
  workspaceId: string
): Promise<boolean> {
  const result = await db
    .update(discountCodes)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(discountCodes.id, id),
        eq(discountCodes.workspaceId, workspaceId)
      )
    )
    .returning({ id: discountCodes.id });

  if (result.length > 0) {
    log.info("Discount code deactivated", { id, workspaceId });
    return true;
  }

  return false;
}

/**
 * Get usage statistics for a discount code.
 *
 * @param discountCodeId - Discount code ID
 */
export async function getUsageStats(discountCodeId: string): Promise<{
  totalUses: number;
  totalDiscountCents: number;
  uniqueCustomers: number;
}> {
  const [stats] = await db
    .select({
      totalUses: sql<number>`count(*)::int`,
      totalDiscountCents: sql<number>`COALESCE(sum(${discountCodeUsages.discountAmountCents}), 0)::int`,
      uniqueCustomers: sql<number>`count(DISTINCT ${discountCodeUsages.clientId})::int`,
    })
    .from(discountCodeUsages)
    .where(eq(discountCodeUsages.discountCodeId, discountCodeId));

  return {
    totalUses: stats?.totalUses ?? 0,
    totalDiscountCents: stats?.totalDiscountCents ?? 0,
    uniqueCustomers: stats?.uniqueCustomers ?? 0,
  };
}

export const DiscountCodeService = {
  validateCode,
  calculateDiscount,
  validateAndCalculate,
  applyToInvoice,
  createDiscountCode,
  getById,
  listByWorkspace,
  updateDiscountCode,
  deactivateCode,
  getUsageStats,
};
