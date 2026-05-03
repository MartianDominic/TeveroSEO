/**
 * Invoice API Response Schemas
 *
 * Zod schemas for validating responses from open-seo-main invoice API.
 *
 * FIX HIGH-API-01: Add response validation before forwarding to client.
 */

import { z } from "zod";

/**
 * Invoice payment details response schema.
 * Returned by GET /api/invoices/:id/pay
 */
export const invoicePaymentDetailsSchema = z.object({
  success: z.boolean(),
  data: z
    .object({
      invoiceId: z.string(),
      amount: z.number(),
      currency: z.string().length(3), // ISO 4217 currency code
      status: z.enum(["pending", "paid", "failed", "cancelled", "refunded"]),
      description: z.string().optional(),
      dueDate: z.string().datetime().optional(),
      paymentMethods: z
        .array(
          z.object({
            type: z.string(),
            enabled: z.boolean(),
          })
        )
        .optional(),
      clientName: z.string().optional(),
      clientEmail: z.string().email().optional(),
    })
    .optional(),
  error: z.string().optional(),
});

export type InvoicePaymentDetails = z.infer<typeof invoicePaymentDetailsSchema>;

/**
 * Invoice payment session response schema.
 * Returned by POST /api/invoices/:id/pay
 */
export const invoicePaymentSessionSchema = z.object({
  success: z.boolean(),
  data: z
    .object({
      sessionId: z.string(),
      sessionUrl: z.string().url(),
      expiresAt: z.string().datetime().optional(),
      paymentProvider: z.enum(["stripe", "paypal", "manual"]).optional(),
    })
    .optional(),
  error: z.string().optional(),
});

export type InvoicePaymentSession = z.infer<typeof invoicePaymentSessionSchema>;

/**
 * Invoice access verification response schema.
 * Returned by POST /api/invoices/:id/verify-access
 */
export const invoiceAccessVerificationSchema = z.object({
  hasAccess: z.boolean(),
  reason: z.string().optional(),
});

export type InvoiceAccessVerification = z.infer<
  typeof invoiceAccessVerificationSchema
>;

/**
 * Generic API error response schema.
 * Used when the API returns an error.
 */
export const apiErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
  details: z.unknown().optional(),
});

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;

/**
 * Validate invoice payment details response.
 * Returns validated data or null if validation fails.
 */
export function validateInvoicePaymentDetails(
  data: unknown
): InvoicePaymentDetails | null {
  const result = invoicePaymentDetailsSchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Validate invoice payment session response.
 * Returns validated data or null if validation fails.
 */
export function validateInvoicePaymentSession(
  data: unknown
): InvoicePaymentSession | null {
  const result = invoicePaymentSessionSchema.safeParse(data);
  return result.success ? result.data : null;
}
