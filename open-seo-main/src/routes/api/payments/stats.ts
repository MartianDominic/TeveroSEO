/**
 * Payment Stats API Route
 * Phase 60-03: Agency Installment Tracking Dashboard
 *
 * GET /api/payments/stats - Get aggregated payment statistics
 *
 * Query params:
 * - from: Start date for "this month" calculation (defaults to start of current month)
 * - to: End date for "this month" calculation (defaults to end of current month)
 *
 * Returns:
 * - upcoming: Installments due in next 7 days (pending)
 * - overdue: Past due installments not yet paid
 * - thisMonth: Installments paid this month
 * - ytd: Total paid this year
 *
 * Threat mitigation T-60-11: Limits date range to 1 year max for DoS prevention.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { db } from "@/db";
import { paymentSchedules, paymentInstallments } from "@/db/payment-schedule-schema";
import { invoices } from "@/db/invoice-schema";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { createLogger } from "@/server/lib/logger";
import { eq, and, gte, lt, lte, sql } from "drizzle-orm";

const log = createLogger({ module: "PaymentStatsAPI" });

/**
 * Query param validation
 */
const querySchema = z.object({
  from: z.string().datetime().optional().nullable(),
  to: z.string().datetime().optional().nullable(),
});

/**
 * Aggregated stats response shape
 */
interface PaymentStats {
  upcoming: { count: number; amountCents: number };
  overdue: { count: number; amountCents: number };
  thisMonth: { count: number; amountCents: number };
  ytd: { count: number; amountCents: number };
}

/**
 * Get the start of a month
 */
function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

/**
 * Get the end of a month
 */
function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

/**
 * Get the start of a year
 */
function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1, 0, 0, 0, 0);
}

/**
 * Add days to a date
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export const Route = createFileRoute("/api/payments/stats")({
  server: {
    handlers: {
      /**
       * GET /api/payments/stats
       * Returns aggregated payment statistics for the dashboard.
       *
       * Uses efficient SQL aggregation for performance.
       * Workspace-scoped via requireApiAuth.
       */
      GET: async ({ request }: { request: Request }) => {
        try {
          const auth = await requireApiAuth(request);

          // Parse query params
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

          const now = new Date();

          // Calculate date ranges
          const monthStart = parseResult.data.from
            ? new Date(parseResult.data.from)
            : startOfMonth(now);
          const monthEnd = parseResult.data.to
            ? new Date(parseResult.data.to)
            : endOfMonth(now);
          const yearStart = startOfYear(now);
          const upcomingCutoff = addDays(now, 7);

          // T-60-11: Limit date range to 1 year max
          const oneYearAgo = new Date(now);
          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

          if (monthStart < oneYearAgo) {
            return Response.json(
              { success: false, error: "Date range cannot exceed 1 year" },
              { status: 400 }
            );
          }

          // Base condition: workspace scoped through invoices
          const workspaceCondition = eq(invoices.workspaceId, auth.organizationId);

          // Query 1: Upcoming installments (pending, due in next 7 days)
          const upcomingResult = await db
            .select({
              count: sql<number>`count(*)::int`,
              amountCents: sql<number>`coalesce(sum(${paymentInstallments.amountCents}), 0)::int`,
            })
            .from(paymentInstallments)
            .innerJoin(
              paymentSchedules,
              eq(paymentInstallments.scheduleId, paymentSchedules.id)
            )
            .innerJoin(invoices, eq(paymentSchedules.invoiceId, invoices.id))
            .where(
              and(
                workspaceCondition,
                eq(paymentInstallments.status, "pending"),
                gte(paymentInstallments.dueAt, now),
                lte(paymentInstallments.dueAt, upcomingCutoff)
              )
            );

          // Query 2: Overdue installments (pending or overdue, due before now)
          const overdueResult = await db
            .select({
              count: sql<number>`count(*)::int`,
              amountCents: sql<number>`coalesce(sum(${paymentInstallments.amountCents}), 0)::int`,
            })
            .from(paymentInstallments)
            .innerJoin(
              paymentSchedules,
              eq(paymentInstallments.scheduleId, paymentSchedules.id)
            )
            .innerJoin(invoices, eq(paymentSchedules.invoiceId, invoices.id))
            .where(
              and(
                workspaceCondition,
                sql`${paymentInstallments.status} IN ('pending', 'overdue')`,
                lt(paymentInstallments.dueAt, now)
              )
            );

          // Query 3: Paid this month
          const thisMonthResult = await db
            .select({
              count: sql<number>`count(*)::int`,
              amountCents: sql<number>`coalesce(sum(${paymentInstallments.amountCents}), 0)::int`,
            })
            .from(paymentInstallments)
            .innerJoin(
              paymentSchedules,
              eq(paymentInstallments.scheduleId, paymentSchedules.id)
            )
            .innerJoin(invoices, eq(paymentSchedules.invoiceId, invoices.id))
            .where(
              and(
                workspaceCondition,
                eq(paymentInstallments.status, "paid"),
                gte(paymentInstallments.paidAt, monthStart),
                lte(paymentInstallments.paidAt, monthEnd)
              )
            );

          // Query 4: YTD (paid this year)
          const ytdResult = await db
            .select({
              count: sql<number>`count(*)::int`,
              amountCents: sql<number>`coalesce(sum(${paymentInstallments.amountCents}), 0)::int`,
            })
            .from(paymentInstallments)
            .innerJoin(
              paymentSchedules,
              eq(paymentInstallments.scheduleId, paymentSchedules.id)
            )
            .innerJoin(invoices, eq(paymentSchedules.invoiceId, invoices.id))
            .where(
              and(
                workspaceCondition,
                eq(paymentInstallments.status, "paid"),
                gte(paymentInstallments.paidAt, yearStart)
              )
            );

          const stats: PaymentStats = {
            upcoming: {
              count: upcomingResult[0]?.count ?? 0,
              amountCents: upcomingResult[0]?.amountCents ?? 0,
            },
            overdue: {
              count: overdueResult[0]?.count ?? 0,
              amountCents: overdueResult[0]?.amountCents ?? 0,
            },
            thisMonth: {
              count: thisMonthResult[0]?.count ?? 0,
              amountCents: thisMonthResult[0]?.amountCents ?? 0,
            },
            ytd: {
              count: ytdResult[0]?.count ?? 0,
              amountCents: ytdResult[0]?.amountCents ?? 0,
            },
          };

          return Response.json({ success: true, data: stats });
        } catch (error) {
          if (error instanceof Error && error.message.includes("UNAUTHENTICATED")) {
            return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
          }

          log.error(
            "Failed to fetch payment stats",
            error instanceof Error ? error : new Error(String(error))
          );

          return Response.json(
            { success: false, message: "Failed to fetch payment stats" },
            { status: 500 }
          );
        }
      },
    },
  },
});
