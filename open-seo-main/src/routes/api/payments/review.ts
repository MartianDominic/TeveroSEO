/**
 * Payment Review Queue API Route
 * Phase 101-02: Payment Reconciliation
 *
 * GET /api/payments/review - Get payments in review queue
 * GET /api/payments/review?paymentId=X - Get single payment review details
 * POST /api/payments/review - Process review decision (accept/reject/manual)
 *
 * Returns payments with < 90% confidence that need manual review.
 * All operations are workspace-scoped via requireApiAuth.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PaymentReviewService } from "@/server/features/payments/services/PaymentReviewService";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { createLogger } from "@/server/lib/logger";
import {
  paymentReviewRateLimiter,
  rateLimitExceededResponse,
  addRateLimitHeaders,
} from "@/server/middleware/rate-limit";

const log = createLogger({ module: "PaymentReviewAPI" });

/**
 * Review decision schema for POST
 */
const ReviewDecisionSchema = z.object({
  paymentId: z.string().min(1, "paymentId is required"),
  action: z.enum(["accept", "reject", "manual"]),
  invoiceId: z.string().optional(),
  allocations: z
    .array(
      z.object({
        invoiceId: z.string(),
        amountCents: z.number().int().positive(),
      })
    )
    .optional(),
});

export const Route = createFileRoute("/api/payments/review")({
  server: {
    handlers: {
      /**
       * GET /api/payments/review
       * Returns payments in review queue with suggested matches.
       *
       * Query params:
       * - paymentId: (optional) Get single payment review details
       * - limit: (optional) Max items to return (default 50)
       */
      GET: async ({ request }: { request: Request }) => {
        try {
          const auth = await requireApiAuth(request);

          // M-SEC-01: Rate limit financial endpoints (10 req/min per user)
          const rateLimitResult = await paymentReviewRateLimiter(auth.userId);
          if (!rateLimitResult.allowed) {
            log.warn("Rate limit exceeded for payment review GET", {
              userId: auth.userId,
              current: rateLimitResult.current,
              limit: rateLimitResult.limit,
            });
            return rateLimitExceededResponse(rateLimitResult);
          }
          const url = new URL(request.url);
          const paymentId = url.searchParams.get("paymentId");
          const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);

          if (paymentId) {
            // Get single payment review details
            const reviewItem = await PaymentReviewService.getReviewItem(
              paymentId,
              auth.organizationId
            );

            if (!reviewItem) {
              return Response.json(
                { success: false, error: "Payment not found" },
                { status: 404 }
              );
            }

            return addRateLimitHeaders(
              Response.json({ success: true, data: reviewItem }),
              rateLimitResult
            );
          }

          // Get full review queue
          const queue = await PaymentReviewService.getReviewQueue(
            auth.organizationId,
            limit
          );

          // Get stats
          const stats = await PaymentReviewService.getReviewStats(auth.organizationId);

          return addRateLimitHeaders(
            Response.json({
              success: true,
              data: {
                items: queue,
                stats,
              },
            }),
            rateLimitResult
          );
        } catch (error) {
          if (error instanceof Error && error.message.includes("UNAUTHENTICATED")) {
            return Response.json(
              { success: false, error: "Unauthorized" },
              { status: 401 }
            );
          }

          log.error(
            "Failed to fetch review queue",
            error instanceof Error ? error : new Error(String(error))
          );

          return Response.json(
            { success: false, error: "Failed to fetch review queue" },
            { status: 500 }
          );
        }
      },

      /**
       * POST /api/payments/review
       * Process a review decision for a payment.
       *
       * Body:
       * - paymentId: Payment to process
       * - action: "accept" | "reject" | "manual"
       * - invoiceId: Required for "accept" and single-invoice "manual"
       * - allocations: For "manual" split payments
       */
      POST: async ({ request }: { request: Request }) => {
        try {
          const auth = await requireApiAuth(request);

          // M-SEC-01: Rate limit financial endpoints (10 req/min per user)
          const rateLimitResult = await paymentReviewRateLimiter(auth.userId);
          if (!rateLimitResult.allowed) {
            log.warn("Rate limit exceeded for payment review POST", {
              userId: auth.userId,
              current: rateLimitResult.current,
              limit: rateLimitResult.limit,
            });
            return rateLimitExceededResponse(rateLimitResult);
          }

          const body = (await request.json()) as Record<string, unknown>;

          const parsed = ReviewDecisionSchema.safeParse(body);
          if (!parsed.success) {
            return Response.json(
              {
                success: false,
                error: "Invalid input",
                details: parsed.error.issues.map((issue) => ({
                  path: issue.path,
                  message: issue.message,
                })),
              },
              { status: 422 }
            );
          }

          const { paymentId, action, invoiceId, allocations } = parsed.data;

          // Validate required fields based on action
          if (action === "accept" && !invoiceId) {
            return Response.json(
              { success: false, error: "invoiceId required for accept action" },
              { status: 422 }
            );
          }

          if (action === "manual" && !invoiceId && !allocations) {
            return Response.json(
              { success: false, error: "invoiceId or allocations required for manual action" },
              { status: 422 }
            );
          }

          const updatedPayment = await PaymentReviewService.processReviewDecision(
            paymentId,
            { action, invoiceId, allocations },
            auth.organizationId
          );

          log.info("Review decision processed", {
            paymentId,
            action,
            newStatus: updatedPayment.status,
          });

          return addRateLimitHeaders(
            Response.json({ success: true, data: updatedPayment }),
            rateLimitResult
          );
        } catch (error) {
          if (error instanceof Error && error.message.includes("UNAUTHENTICATED")) {
            return Response.json(
              { success: false, error: "Unauthorized" },
              { status: 401 }
            );
          }

          if (error instanceof Error && error.message.includes("not found")) {
            return Response.json(
              { success: false, error: error.message },
              { status: 404 }
            );
          }

          if (error instanceof Error && error.message.includes("not in review queue")) {
            return Response.json(
              { success: false, error: error.message },
              { status: 400 }
            );
          }

          log.error(
            "Failed to process review decision",
            error instanceof Error ? error : new Error(String(error))
          );

          return Response.json(
            { success: false, error: "Failed to process review decision" },
            { status: 500 }
          );
        }
      },
    },
  },
});
