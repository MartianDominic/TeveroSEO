import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/user-schema";
import { verifyClerkJWT } from "@/server/lib/clerk-jwt";
import { AppError } from "@/server/lib/errors";
import type { EnsuredUserContext } from "./types";

/**
 * Extract Bearer token from Authorization header.
 * Throws UNAUTHENTICATED if header is missing or malformed.
 */
function extractBearerToken(headers: Headers): string {
  const authHeader = headers.get("Authorization");
  if (!authHeader) {
    throw new AppError("UNAUTHENTICATED", "Missing Authorization header");
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    throw new AppError("UNAUTHENTICATED", "Invalid Authorization header format");
  }

  return parts[1];
}

/**
 * Find or create user by clerk_user_id.
 * On first login, creates a new user row from JWT claims.
 */
async function findOrCreateUserByClerkId(
  clerkUserId: string,
  email: string,
  name?: string,
): Promise<{ id: string; email: string }> {
  // Try to find existing user by clerk_user_id
  const existing = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.clerkUserId, clerkUserId))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  // User not found - create new user from Clerk claims
  const newUserId = crypto.randomUUID();
  await db.insert(user).values({
    id: newUserId,
    clerkUserId: clerkUserId,
    email: email,
    name: name ?? email.split("@")[0],
    emailVerified: true, // Clerk handles verification
  });

  return { id: newUserId, email };
}

/**
 * Resolve user context from Clerk JWT in Authorization header.
 * Returns EnsuredUserContext with userId, userEmail, organizationId.
 */
export async function resolveClerkContext(
  headers: Headers,
): Promise<EnsuredUserContext> {
  const token = extractBearerToken(headers);
  const { userId: clerkUserId, email, name } = await verifyClerkJWT(token);

  const dbUser = await findOrCreateUserByClerkId(clerkUserId, email, name);

  // For now, use a default organization ID. In future, this could be:
  // 1. Extracted from Clerk's org claims (if using Clerk Organizations)
  // 2. Looked up from the member table based on user
  // 3. Created on first login like the hosted resolver did
  const organizationId = dbUser.id; // Use user ID as default org for single-user case

  return {
    userId: dbUser.id,
    userEmail: dbUser.email,
    organizationId,
  };
}
