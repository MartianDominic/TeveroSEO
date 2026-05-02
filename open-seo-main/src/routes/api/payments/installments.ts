/**
 * Installments API Route
 * Phase 60-03: Agency Installment Tracking Dashboard
 *
 * GET /api/payments/installments - Get filtered, paginated installments
 *
 * Query params:
 * - status: Filter by installment status (pending, paid, overdue, failed)
 * - from: Start date filter (ISO string)
 * - to: End date filter (ISO string)
 * - clientId: Filter by client UUID
 * - limit: Page size (default 20, max 100)
 * - offset: Pagination offset (default 0)
 *
 * Response includes invoice and client data for display.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/db";
import {
  paymentSchedules,
  paymentInstallments,
  type InstallmentStatus,
  INSTALLMENT_STATUS,
} from "@/db/payment-schedule-schema";
import { invoices } from "@/db/invoice-schema";
import { clients } from "@/db/client-schema";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { createLogger } from "@/server/lib/logger";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";

const log = createLogger({ module: "InstallmentsAPI" });

/**
 * Query param validation schema
 */
const querySchema = z.object({
  status: z
    .enum(INSTALLMENT_STATUS)
    .optional()
    .nullable()
    .transform((v) => v ?? undefined),
  from: z.string().datetime().optional().nullable(),
  to: z.string().datetime().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  limit: z
    .string()
    .optional()
    .transform((v) => Math.min(100, Math.max(1, parseInt(v ?? "20", 10)))),
  offset: z
    .string()
    .optional()
    .transform((v) => Math.max(0, parseInt(v ?? "0", 10))),
});

/**
 * Installment with joined invoice and client data for display
 */
interface InstallmentWithDetails {
  id: string;
  invoiceNumber: string;
  invoiceId: string;
  clientName: string;
  clientId: string;
  amountCents: number;
  currency: string;
  dueAt: string;
  status: InstallmentStatus;
  paidAt: string | null;
  installmentNumber: number;
  totalInstallments: number;
}

interface PaginatedResponse {
  data: InstallmentWithDetails[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export const Route = createFileRoute("/api/payments/installments")({
  server: {
    handlers: {
      /**
       * GET /api/payments/installments
       * Returns paginated installments with invoice and client details.
       *
       * Workspace-scoped via requireApiAuth.
       * Threat mitigation T-60-09: Only returns installments for the authenticated workspace.
       */
      GET: async ({ request }: { request: Request }) => {
        try {
          const auth = await requireApiAuth(request);

          // Parse and validate query params
          const url = new URL(request.url);
          const rawParams = Object.fromEntries(url.searchParams.entries());
          const parseResult = querySchema.safeParse(rawParams);

          if (!parseResult.success) {
            return Response.json(
              {
                success: false,
                error: "Invalid query parameters",
                details: parseResult.error.issues,
              },
              { status: 400 }
            );
          }

          const { status, from, to, clientId, limit, offset } = parseResult.data;

          // Build where conditions
          const conditions: ReturnType<typeof eq>[] = [
            eq(invoices.workspaceId, auth.organizationId),
          ];

          if (status) {
            conditions.push(eq(paymentInstallments.status, status));
          }

          if (from) {
            conditions.push(gte(paymentInstallments.dueAt, new Date(from)));
          }

          if (to) {
            conditions.push(lte(paymentInstallments.dueAt, new Date(to)));
          }

          if (clientId) {
            conditions.push(eq(invoices.clientId, clientId));
          }

          // Count total matching installments
          const countResult = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(paymentInstallments)
            .innerJoin(
              paymentSchedules,
              eq(paymentInstallments.scheduleId, paymentSchedules.id)
            )
            .innerJoin(invoices, eq(paymentSchedules.invoiceId, invoices.id))
            .where(and(...conditions));

          const total = countResult[0]?.count ?? 0;

          // Fetch installments with joins
          const rows = await db
            .select({
              id: paymentInstallments.id,
              installmentNumber: paymentInstallments.installmentNumber,
              amountCents: paymentInstallments.amountCents,
              dueAt: paymentInstallments.dueAt,
              status: paymentInstallments.status,
              paidAt: paymentInstallments.paidAt,
              invoiceId: invoices.id,
              invoiceNumber: invoices.invoiceNumber,
              currency: invoices.currency,
              totalInstallments: paymentSchedules.totalInstallments,
              clientId: clients.id,
              clientName: clients.name,
            })
            .from(paymentInstallments)
            .innerJoin(
              paymentSchedules,
              eq(paymentInstallments.scheduleId, paymentSchedules.id)
            )
            .innerJoin(invoices, eq(paymentSchedules.invoiceId, invoices.id))
            .innerJoin(clients, eq(invoices.clientId, clients.id))
            .where(and(...conditions))
            .orderBy(desc(paymentInstallments.dueAt))
            .limit(limit)
            .offset(offset);

          // Transform to response format
          const data: InstallmentWithDetails[] = rows.map((row) => ({
            id: row.id,
            invoiceNumber: row.invoiceNumber,
            invoiceId: row.invoiceId,
            clientName: row.clientName,
            clientId: row.clientId,
            amountCents: row.amountCents,
            currency: row.currency ?? "EUR",
            dueAt: row.dueAt.toISOString(),
            status: row.status as InstallmentStatus,
            paidAt: row.paidAt?.toISOString() ?? null,
            installmentNumber: row.installmentNumber,
            totalInstallments: row.totalInstallments,
          }));

          const response: PaginatedResponse = {
            data,
            pagination: { total, limit, offset },
          };

          return Response.json({ success: true, ...response });
        } catch (error) {
          if (error instanceof Error && error.message.includes("UNAUTHENTICATED")) {
            return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
          }

          log.error(
            "Failed to fetch installments",
            error instanceof Error ? error : new Error(String(error))
          );

          return Response.json(
            { success: false, message: "Failed to fetch installments" },
            { status: 500 }
          );
        }
      },
    },
  },
});
