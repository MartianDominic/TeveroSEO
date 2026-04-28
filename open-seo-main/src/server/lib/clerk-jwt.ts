import { createRemoteJWKSet, jwtVerify } from "jose";
import { AppError } from "./errors";

export interface ClerkJWTPayload {
  userId: string;
  email: string;
  name?: string;
}

// JWKS URL pattern: https://{instance}.clerk.accounts.dev/.well-known/jwks.json
// Instance extracted from CLERK_PUBLISHABLE_KEY (pk_test_xxxx or pk_live_xxxx)
// The base64-encoded part after pk_test_ or pk_live_ decodes to "{instance}.clerk.accounts.dev"

let jwksInstance: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS(): ReturnType<typeof createRemoteJWKSet> {
  if (jwksInstance) return jwksInstance;

  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY?.trim();
  if (!publishableKey) {
    throw new Error("CLERK_PUBLISHABLE_KEY is not configured");
  }

  // Extract the base64 portion after pk_test_ or pk_live_
  const match = publishableKey.match(/^pk_(test|live)_(.+)$/);
  if (!match) {
    throw new Error("Invalid CLERK_PUBLISHABLE_KEY format");
  }

  // Decode base64 to get instance URL (e.g., "your-instance.clerk.accounts.dev")
  const instanceUrl = Buffer.from(match[2], "base64").toString("utf-8");
  const jwksUrl = new URL(`https://${instanceUrl}/.well-known/jwks.json`);

  jwksInstance = createRemoteJWKSet(jwksUrl);
  return jwksInstance;
}

/**
 * Verify a Clerk JWT and return the decoded payload.
 *
 * @param token - The JWT string from the Authorization header
 * @returns ClerkJWTPayload with userId, email, and optional name
 * @throws AppError("UNAUTHENTICATED") if the token is invalid or expired
 * @throws Error if CLERK_PUBLISHABLE_KEY is not configured or invalid
 */
export async function verifyClerkJWT(token: string): Promise<ClerkJWTPayload> {
  // Get JWKS before try-catch so configuration errors propagate directly
  const jwks = getJWKS();

  try {
    const { payload } = await jwtVerify(token, jwks, {
      algorithms: ["RS256"],
    });

    // Clerk JWT claims: sub = user ID, email, name (optional)
    const userId = payload.sub;
    const email = payload.email as string | undefined;
    const name = payload.name as string | undefined;

    if (!userId || !email) {
      throw new AppError("UNAUTHENTICATED", "Invalid JWT claims");
    }

    return { userId, email, name };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("UNAUTHENTICATED", "Invalid or expired Clerk JWT");
  }
}

/**
 * Reset the cached JWKS instance.
 * Exported for testing purposes only.
 */
export function resetJWKSCache(): void {
  jwksInstance = null;
}
