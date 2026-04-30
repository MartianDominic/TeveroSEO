/**
 * Invoice validation schemas.
 * Phase 45: Data Foundation
 */
import { z } from "zod";
import { INVOICE_STATUS } from "@/db/invoice-schema";

const lineItemSchema = z.object({
  id: z.string().min(1, "Line item ID is required"),
  description: z.string().min(1, "Description is required"),
  quantity: z.number().int().positive("Quantity must be positive"),
  unitPriceCents: z.number().int().nonnegative("Price cannot be negative"),
  totalCents: z.number().int().nonnegative("Total cannot be negative"),
});

export const createInvoiceSchema = z.object({
  clientId: z.string().uuid("Invalid client ID"),
  contractId: z.string().optional(),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  lineItems: z.array(lineItemSchema).min(1, "At least one line item required"),
  subtotalCents: z.number().int().nonnegative(),
  taxCents: z.number().int().nonnegative().default(0),
  totalCents: z.number().int().nonnegative(),
  currency: z.string().length(3, "Currency must be 3 characters").default("EUR"),
  dueAt: z.string().datetime().optional(),
});

export const updateInvoiceStatusSchema = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required"),
  status: z.enum(INVOICE_STATUS, {
    errorMap: () => ({ message: "Invalid invoice status" }),
  }),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceStatusInput = z.infer<typeof updateInvoiceStatusSchema>;
