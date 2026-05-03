/**
 * Webhook signature verification middleware.
 * Phase 40: Security hardening for incoming webhooks.
 *
 * Verifies HMAC signatures from external webhook providers to ensure
 * authenticity and prevent replay attacks.
 *
 * Supported providers:
 * - Stripe (uses Stripe SDK for verification)
 * - Clerk (Svix signatures)
 * - GitHub (HMAC-SHA256)
 * - Generic HMAC (custom webhooks)
 */
import { createHmac, timingSafeEqual } from "crypto";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "webhook-auth" });

/**
 * Configuration for a webhook provider.
 */
interface WebhookProviderConfig {
  /** Environment variable name for the webhook secret */
  secretEnvVar: string;
  /** HTTP header containing the signature */
  signatureHeader: string;
  /** HMAC algorithm to use */
  algorithm: "sha256" | "sha1";
  /** Optional timestamp header for replay protection */
  timestampHeader?: string;
  /** Maximum age in seconds for timestamp validation (default: 300) */
  maxTimestampAge?: number;
  /** Signature format/prefix handling */
  signatureFormat?: "hex" | "base64" | "stripe" | "svix";
}

/**
 * Registered webhook provider configurations.
 */
const WEBHOOK_PROVIDERS: Record<string, WebhookProviderConfig> = {
  stripe: {
    secretEnvVar: "STRIPE_WEBHOOK_SECRET",
    signatureHeader: "stripe-signature",
    algorithm: "sha256",
    signatureFormat: "stripe",
    timestampHeader: "stripe-signature", // Timestamp is in the signature header
    maxTimestampAge: 300,
  },
  clerk: {
    secretEnvVar: "CLERK_WEBHOOK_SECRET",
    signatureHeader: "svix-signature",
    algorithm: "sha256",
    signatureFormat: "svix",
    timestampHeader: "svix-timestamp",
    maxTimestampAge: 300,
  },
  github: {
    secretEnvVar: "GITHUB_WEBHOOK_SECRET",
    signatureHeader: "x-hub-signature-256",
    algorithm: "sha256",
    signatureFormat: "hex",
  },
  generic: {
    secretEnvVar: "WEBHOOK_SECRET",
    signatureHeader: "x-webhook-signature",
    algorithm: "sha256",
    signatureFormat: "hex",
  },
};

/**
 * Result of webhook signature verification.
 */
export interface WebhookVerificationResult {
  verified: boolean;
  /** Raw payload for processing (only present if verified) */
  payload?: string;
  /** Error message if verification failed */
  error?: string;
  /** Provider-specific parsed data */
  metadata?: Record<string, unknown>;
}

/**
 * Parse Stripe signature header format.
 * Format: t=timestamp,v1=signature,v1=signature2,...
 */
function parseStripeSignature(
  header: string,
): { timestamp: number; signatures: string[] } | null {
  const parts = header.split(",");
  let timestamp = 0;
  const signatures: string[] = [];

  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key === "t") {
      timestamp = parseInt(value, 10);
    } else if (key === "v1") {
      signatures.push(value);
    }
  }

  if (timestamp === 0 || signatures.length === 0) {
    return null;
  }

  return { timestamp, signatures };
}

/**
 * Parse Svix (Clerk) signature header format.
 * Format: v1,signature1 v1,signature2
 */
function parseSvixSignature(header: string): string[] {
  return header
    .split(" ")
    .filter((s) => s.startsWith("v1,"))
    .map((s) => s.substring(3));
}

/**
 * Compute HMAC signature for payload.
 */
function computeHmac(
  algorithm: "sha256" | "sha1",
  secret: string,
  payload: string,
): string {
  return createHmac(algorithm, secret).update(payload, "utf8").digest("hex");
}

/**
 * Timing-safe signature comparison.
 *
 * HIGH-07 FIX: Prevents timing attacks by ensuring constant-time comparison
 * even when lengths differ. We still perform a comparison operation when
 * lengths don't match to avoid leaking length information through timing.
 */
function secureCompareSignatures(actual: string, expected: string): boolean {
  try {
    const actualBuffer = Buffer.from(actual, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");

    // HIGH-07 FIX: Always perform a timing-safe comparison to avoid
    // leaking length information through timing differences
    if (actualBuffer.length !== expectedBuffer.length) {
      // Still do a comparison against itself to maintain constant time
      // This prevents attackers from detecting length mismatches via timing
      timingSafeEqual(expectedBuffer, expectedBuffer);
      return false;
    }

    return timingSafeEqual(actualBuffer, expectedBuffer);
  } catch (error) {
    log.warn("Webhook signature comparison failed", {
      error: error instanceof Error ? error.message : "Unknown",
    });
    return false;
  }
}

/**
 * Verify a Stripe webhook signature.
 *
 * NOTE: For Stripe, prefer using the Stripe SDK's constructEvent() method
 * in the route handler (see /api/stripe/webhook). This function is provided
 * for reference and testing.
 */
function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
  maxAge: number,
): WebhookVerificationResult {
  const parsed = parseStripeSignature(signatureHeader);
  if (!parsed) {
    return { verified: false, error: "Invalid Stripe signature format" };
  }

  // Check timestamp age
  const now = Math.floor(Date.now() / 1000);
  if (now - parsed.timestamp > maxAge) {
    return { verified: false, error: "Webhook timestamp too old" };
  }

  // Compute expected signature
  const signedPayload = `${parsed.timestamp}.${payload}`;
  const expectedSig = computeHmac("sha256", secret, signedPayload);

  // Check if any signature matches
  const isValid = parsed.signatures.some((sig) =>
    secureCompareSignatures(sig, expectedSig),
  );

  if (!isValid) {
    return { verified: false, error: "Invalid Stripe signature" };
  }

  return {
    verified: true,
    payload,
    metadata: { timestamp: parsed.timestamp },
  };
}

/**
 * Verify a Svix (Clerk) webhook signature.
 */
function verifySvixSignature(
  payload: string,
  signatureHeader: string,
  timestampHeader: string | null,
  secret: string,
  maxAge: number,
): WebhookVerificationResult {
  if (!timestampHeader) {
    return { verified: false, error: "Missing svix-timestamp header" };
  }

  const timestamp = parseInt(timestampHeader, 10);
  const now = Math.floor(Date.now() / 1000);

  if (isNaN(timestamp) || now - timestamp > maxAge) {
    return { verified: false, error: "Webhook timestamp too old or invalid" };
  }

  // Svix uses whsec_ prefixed secrets - remove prefix if present
  const secretKey = secret.startsWith("whsec_")
    ? Buffer.from(secret.substring(6), "base64")
    : Buffer.from(secret, "base64");

  // Compute expected signature
  const signedPayload = `${timestampHeader}.${payload}`;
  const expectedSig = createHmac("sha256", secretKey)
    .update(signedPayload, "utf8")
    .digest("base64");

  // Parse and check signatures
  const signatures = parseSvixSignature(signatureHeader);
  const isValid = signatures.some((sig) => {
    try {
      const sigBuffer = Buffer.from(sig, "base64");
      const expectedBuffer = Buffer.from(expectedSig, "base64");
      return (
        sigBuffer.length === expectedBuffer.length &&
        timingSafeEqual(sigBuffer, expectedBuffer)
      );
    } catch (error) {
      log.warn("Svix signature verification failed", {
        error: error instanceof Error ? error.message : "Unknown",
      });
      return false;
    }
  });

  if (!isValid) {
    return { verified: false, error: "Invalid Svix signature" };
  }

  return {
    verified: true,
    payload,
    metadata: { timestamp },
  };
}

/**
 * Verify a standard HMAC signature (GitHub, generic).
 */
function verifyHmacSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
  algorithm: "sha256" | "sha1",
): WebhookVerificationResult {
  // Handle signatures with algorithm prefix (e.g., "sha256=abcd...")
  let actualSig = signatureHeader;
  if (signatureHeader.includes("=")) {
    const parts = signatureHeader.split("=");
    actualSig = parts[parts.length - 1];
  }

  const expectedSig = computeHmac(algorithm, secret, payload);

  if (!secureCompareSignatures(actualSig, expectedSig)) {
    return { verified: false, error: "Invalid HMAC signature" };
  }

  return { verified: true, payload };
}

/**
 * Verify webhook signature for a specific provider.
 *
 * @param provider - Webhook provider name (stripe, clerk, github, generic)
 * @param request - The incoming HTTP request
 * @returns Verification result with payload if successful
 *
 * @example
 * const result = await verifyWebhookSignature("clerk", request);
 * if (!result.verified) {
 *   return Response.json({ error: result.error }, { status: 401 });
 * }
 * const payload = JSON.parse(result.payload!);
 */
export async function verifyWebhookSignature(
  provider: keyof typeof WEBHOOK_PROVIDERS | string,
  request: Request,
): Promise<WebhookVerificationResult> {
  const config = WEBHOOK_PROVIDERS[provider];
  if (!config) {
    return { verified: false, error: `Unknown webhook provider: ${provider}` };
  }

  const secret = process.env[config.secretEnvVar];
  if (!secret) {
    log.error(`Webhook secret not configured`, undefined, {
      provider,
      envVar: config.secretEnvVar,
    });
    return {
      verified: false,
      error: `Webhook secret not configured for ${provider}`,
    };
  }

  const signatureHeader = request.headers.get(config.signatureHeader);
  if (!signatureHeader) {
    log.warn("Missing webhook signature header", {
      provider,
      header: config.signatureHeader,
      path: new URL(request.url).pathname,
    });
    return { verified: false, error: "Missing webhook signature" };
  }

  // Get raw payload
  const payload = await request.text();
  if (!payload) {
    return { verified: false, error: "Empty webhook payload" };
  }

  const maxAge = config.maxTimestampAge ?? 300;

  try {
    let result: WebhookVerificationResult;

    switch (config.signatureFormat) {
      case "stripe":
        result = verifyStripeSignature(payload, signatureHeader, secret, maxAge);
        break;

      case "svix": {
        const timestampHeader = config.timestampHeader
          ? request.headers.get(config.timestampHeader)
          : null;
        result = verifySvixSignature(
          payload,
          signatureHeader,
          timestampHeader,
          secret,
          maxAge,
        );
        break;
      }

      case "hex":
      case "base64":
      default:
        result = verifyHmacSignature(
          payload,
          signatureHeader,
          secret,
          config.algorithm,
        );
    }

    if (result.verified) {
      log.info("Webhook signature verified", {
        provider,
        path: new URL(request.url).pathname,
      });
    } else {
      log.warn("Webhook signature verification failed", {
        provider,
        error: result.error,
        path: new URL(request.url).pathname,
      });
    }

    return result;
  } catch (error) {
    log.error(
      "Webhook verification error",
      error instanceof Error ? error : new Error(String(error)),
      { provider },
    );
    return {
      verified: false,
      error: `Signature verification failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Create a webhook auth middleware for a specific provider.
 *
 * @param provider - Webhook provider name
 * @returns Middleware function that verifies webhook and attaches payload
 *
 * @example
 * // In a TanStack Start route
 * const clerkWebhookAuth = createWebhookAuthMiddleware("clerk");
 *
 * export async function POST({ request }) {
 *   const authResult = await clerkWebhookAuth(request);
 *   if (authResult) return authResult; // Returns 401 response on failure
 *
 *   const payload = (request as any).webhookPayload;
 *   // Process webhook...
 * }
 */
export function createWebhookAuthMiddleware(
  provider: keyof typeof WEBHOOK_PROVIDERS | string,
) {
  return async (request: Request): Promise<Response | null> => {
    const result = await verifyWebhookSignature(provider, request);

    if (!result.verified) {
      return Response.json(
        { error: result.error ?? "Webhook verification failed" },
        { status: 401 },
      );
    }

    // Attach payload to request for handler
    (request as Request & { webhookPayload: string }).webhookPayload =
      result.payload!;

    return null; // Continue to handler
  };
}

/**
 * Register a custom webhook provider configuration.
 * Use this for webhooks from services not in the default list.
 *
 * @param name - Provider name
 * @param config - Provider configuration
 *
 * @example
 * registerWebhookProvider("custom-service", {
 *   secretEnvVar: "CUSTOM_WEBHOOK_SECRET",
 *   signatureHeader: "x-custom-signature",
 *   algorithm: "sha256",
 *   signatureFormat: "hex",
 * });
 */
export function registerWebhookProvider(
  name: string,
  config: WebhookProviderConfig,
): void {
  WEBHOOK_PROVIDERS[name] = config;
  log.info("Registered webhook provider", { name });
}

/**
 * Get list of registered webhook providers.
 */
export function getRegisteredWebhookProviders(): string[] {
  return Object.keys(WEBHOOK_PROVIDERS);
}
