/**
 * Proxy route for invoice payment API.
 * Phase 54-05: Checkout Widget + E2E Testing
 *
 * Forwards requests to open-seo-main API.
 * Handles both GET (fetch details) and POST (create session).
 *
 * SECURITY: All requests require authentication and invoice ownership validation.
 *
 * FIX HIGH-API-01: Added Zod validation on responses before forwarding to client.
 * FIX HIGH-API-02: Added correlation ID propagation to downstream requests.
 * FIX MED-API-02: Extract and forward x-request-id from edge.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/api-auth";
import { validateCsrf } from "@/lib/api/security";
import { withRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { logger } from "@/lib/logger";
import {
  extractRequestContextFromRequest,
  buildTracingHeaders,
  addTracingHeadersToResponse,
  type RequestContext,
} from "@/lib/api/request-context";
import {
  invoicePaymentDetailsSchema,
  invoicePaymentSessionSchema,
  invoiceAccessVerificationSchema,
} from "@/lib/api/schemas/invoice-schemas";

const OPEN_SEO_API_URL = process.env.OPEN_SEO_API_URL || "http://localhost:3001";

/**
 * Verify that the authenticated user has access to the specified invoice.
 * The backend API performs the actual ownership check.
 *
 * FIX HIGH-API-01: Validate response with Zod schema.
 * FIX HIGH-API-02: Include correlation ID in request.
 */
async function verifyInvoiceOwnership(
  invoiceId: string,
  userId: string,
  orgId?: string,
  requestContext?: RequestContext
): Promise<{ hasAccess: boolean; error?: string }> {
  try {
    const tracingHeaders = requestContext
      ? buildTracingHeaders(requestContext)
      : {};

    const response = await fetch(
      `${OPEN_SEO_API_URL}/api/invoices/${invoiceId}/verify-access`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...tracingHeaders,
        },
        body: JSON.stringify({ userId, orgId }),
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return { hasAccess: false, error: "Invoice not found" };
      }
      return { hasAccess: false, error: "Access denied" };
    }

    const rawResult = await response.json();

    // HIGH-API-01: Validate response schema
    const validated = invoiceAccessVerificationSchema.safeParse(rawResult);
    if (!validated.success) {
      logger.warn("[invoice-proxy] Invalid access verification response", {
        invoiceId,
        validationError: validated.error.message,
        correlationId: requestContext?.correlationId,
      });
      return { hasAccess: false, error: "Invalid response from server" };
    }

    return { hasAccess: validated.data.hasAccess === true };
  } catch (err) {
    // Fail closed: if we can't verify, deny access
    logger.error("[invoice-proxy] Failed to verify invoice ownership", {
      invoiceId,
      userId,
      error: err instanceof Error ? err.message : String(err),
      correlationId: requestContext?.correlationId,
    });
    return { hasAccess: false, error: "Unable to verify access" };
  }
}

async function handleGet(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  // HIGH-API-02 & MED-API-02: Extract tracing context from incoming request
  const requestContext = extractRequestContextFromRequest(request);

  // Require authentication
  let authContext;
  try {
    authContext = await requireAuth();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  // Verify invoice ownership (with tracing context)
  const ownership = await verifyInvoiceOwnership(
    id,
    authContext.userId,
    authContext.orgId,
    requestContext
  );
  if (!ownership.hasAccess) {
    logger.warn("[invoice-proxy] Access denied", {
      invoiceId: id,
      userId: authContext.userId,
      reason: ownership.error,
      correlationId: requestContext.correlationId,
    });
    return NextResponse.json(
      { success: false, error: ownership.error || "Access denied" },
      { status: 403 }
    );
  }

  try {
    // HIGH-API-02: Include tracing headers in downstream request
    const tracingHeaders = buildTracingHeaders(requestContext);

    const res = await fetch(`${OPEN_SEO_API_URL}/api/invoices/${id}/pay`, {
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": authContext.userId,
        "X-Org-Id": authContext.orgId || "",
        ...tracingHeaders,
      },
    });

    const rawData = await res.json();

    // HIGH-API-01: Validate response before forwarding to client
    const validated = invoicePaymentDetailsSchema.safeParse(rawData);
    if (!validated.success) {
      logger.warn("[invoice-proxy] Invalid payment details response", {
        invoiceId: id,
        validationError: validated.error.message,
        correlationId: requestContext.correlationId,
      });
      // Return a safe error response instead of invalid data
      return NextResponse.json(
        { success: false, error: "Invalid response from payment service" },
        { status: 502 }
      );
    }

    // Add tracing headers to response
    const responseHeaders = new Headers();
    addTracingHeadersToResponse(responseHeaders, requestContext);

    return NextResponse.json(validated.data, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to connect to payment service" },
      { status: 502 }
    );
  }
}

async function handlePost(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  // HIGH-API-02 & MED-API-02: Extract tracing context from incoming request
  const requestContext = extractRequestContextFromRequest(request);

  // CSRF protection for state-changing request
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  // Require authentication
  let authContext;
  try {
    authContext = await requireAuth();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  // Verify invoice ownership (with tracing context)
  const ownership = await verifyInvoiceOwnership(
    id,
    authContext.userId,
    authContext.orgId,
    requestContext
  );
  if (!ownership.hasAccess) {
    logger.warn("[invoice-proxy] Access denied for payment", {
      invoiceId: id,
      userId: authContext.userId,
      reason: ownership.error,
      correlationId: requestContext.correlationId,
    });
    return NextResponse.json(
      { success: false, error: ownership.error || "Access denied" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();

    // HIGH-API-02: Include tracing headers in downstream request
    const tracingHeaders = buildTracingHeaders(requestContext);

    const res = await fetch(`${OPEN_SEO_API_URL}/api/invoices/${id}/pay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-Proto": request.headers.get("x-forwarded-proto") || "https",
        "X-User-Id": authContext.userId,
        "X-Org-Id": authContext.orgId || "",
        Host: request.headers.get("host") || "localhost:3000",
        ...tracingHeaders,
      },
      body: JSON.stringify(body),
    });

    const rawData = await res.json();

    // HIGH-API-01: Validate response before forwarding to client
    const validated = invoicePaymentSessionSchema.safeParse(rawData);
    if (!validated.success) {
      logger.warn("[invoice-proxy] Invalid payment session response", {
        invoiceId: id,
        validationError: validated.error.message,
        correlationId: requestContext.correlationId,
      });
      // Return a safe error response instead of invalid data
      return NextResponse.json(
        { success: false, error: "Invalid response from payment service" },
        { status: 502 }
      );
    }

    // Add tracing headers to response
    const responseHeaders = new Headers();
    addTracingHeadersToResponse(responseHeaders, requestContext);

    return NextResponse.json(validated.data, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to connect to payment service" },
      { status: 502 }
    );
  }
}

// Rate limit: Payment endpoints use stricter limits
export const GET = withRateLimit(
  (req: NextRequest) => {
    // Extract params from the URL path
    const pathParts = req.nextUrl.pathname.split("/");
    const idIndex = pathParts.findIndex((p) => p === "invoices") + 1;
    const id = pathParts[idIndex];
    return handleGet(req, { params: Promise.resolve({ id }) });
  },
  RATE_LIMITS.API
);

export const POST = withRateLimit(
  (req: NextRequest) => {
    const pathParts = req.nextUrl.pathname.split("/");
    const idIndex = pathParts.findIndex((p) => p === "invoices") + 1;
    const id = pathParts[idIndex];
    return handlePost(req, { params: Promise.resolve({ id }) });
  },
  RATE_LIMITS.HEAVY
);
