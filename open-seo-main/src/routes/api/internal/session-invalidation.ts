/**
 * Session Invalidation Internal API
 * FIX H-AUTH-03: Endpoint to receive session invalidation notifications
 *
 * POST /api/internal/session-invalidation
 *
 * Called by apps/web when a user is deleted from Clerk.
 * Invalidates any cached sessions/tokens for the deleted user.
 *
 * Security: Requires internal API authentication (HMAC signature).
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createLogger } from "@/server/lib/logger";
import { requireInternalAuth } from "@/server/middleware/internal-auth";
import { redis } from "@/server/lib/redis";

const log = createLogger({ module: "api/internal/session-invalidation" });

/**
 * Schema for session invalidation request.
 */
const sessionInvalidationSchema = z.object({
  userId: z.string().min(1),
  reason: z.enum(["user_deleted", "password_changed", "security_event", "manual"]),
  timestamp: z.string(),
});

/**
 * Redis key patterns for session-related data.
 * These are the cache keys that need to be invalidated.
 */
const SESSION_KEY_PATTERNS = [
  "session:USER_ID",      // Session tokens
  "user:USER_ID:claims",  // Cached JWT claims
  "auth:USER_ID",         // Auth-related cache
  "ownership:USER_ID:*",  // Ownership cache
];

export const Route = createFileRoute("/api/internal/session-invalidation")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          // Verify internal authentication
          const body = await request.clone().text();
          const authResult = await requireInternalAuth(request, body);
          if (authResult) {
            return authResult; // Returns 401 on failure
          }

          // Parse and validate request body
          const payload = JSON.parse(body);
          const validationResult = sessionInvalidationSchema.safeParse(payload);

          if (!validationResult.success) {
            log.warn("Invalid session invalidation payload", {
              errors: validationResult.error.issues,
            });
            return Response.json(
              { error: "Invalid request payload", code: "VALIDATION_ERROR" },
              { status: 400 }
            );
          }

          const { userId, reason, timestamp } = validationResult.data;

          log.info("Processing session invalidation", {
            userId: userId.substring(0, 8) + "***",
            reason,
            timestamp,
          });

          // Invalidate all session-related cache keys for this user
          let invalidatedCount = 0;

          if (redis) {
            for (const pattern of SESSION_KEY_PATTERNS) {
              // Replace USER_ID with actual userId in patterns
              const userPattern = pattern.replace("USER_ID", userId);

              try {
                // Use SCAN to find matching keys (safer than KEYS for large datasets)
                let cursor = "0";
                do {
                  const [nextCursor, keys] = await redis.scan(
                    cursor,
                    "MATCH",
                    userPattern,
                    "COUNT",
                    100
                  );
                  cursor = nextCursor;

                  if (keys.length > 0) {
                    await redis.del(...keys);
                    invalidatedCount += keys.length;
                  }
                } while (cursor !== "0");
              } catch (scanError) {
                log.warn("Failed to scan/delete pattern", {
                  pattern: userPattern,
                  error: scanError instanceof Error ? scanError.message : String(scanError),
                });
              }
            }

            // Also set a revocation marker that can be checked during JWT validation
            // This marker expires after 24 hours (tokens should be re-validated by then)
            const revocationKey = `user:${userId}:revoked`;
            await redis.setex(revocationKey, 86400, timestamp); // 24 hours
          } else {
            log.warn("Redis not available, session invalidation limited to revocation marker only");
          }

          log.info("Session invalidation complete", {
            userId: userId.substring(0, 8) + "***",
            invalidatedCount,
            reason,
          });

          return Response.json({
            success: true,
            invalidatedCount,
            message: `Invalidated ${invalidatedCount} session keys for user`,
          });
        } catch (error) {
          log.error(
            "Session invalidation failed",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json(
            { error: "Internal server error", code: "INTERNAL_ERROR" },
            { status: 500 }
          );
        }
      },
    },
  },
});
