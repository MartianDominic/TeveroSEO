/**
 * CSRF Token Endpoint
 * GET /api/auth/csrf-token
 *
 * Returns a CSRF token for SPA clients to include in state-changing requests.
 * Sets the token in an HttpOnly cookie and returns it in the response body.
 *
 * The client should:
 * 1. Call this endpoint on app initialization or when token expires
 * 2. Store the token in memory (not localStorage for security)
 * 3. Include X-CSRF-Token header on all POST/PUT/PATCH/DELETE requests
 *
 * Token lifecycle:
 * - Generated fresh if no existing token in cookie
 * - Reused from cookie if valid token exists (preserves session continuity)
 * - Cookie refreshed on each call to extend lifetime
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  generateCsrfToken,
  getCsrfTokenFromCookie,
  buildCsrfCookie,
} from "@/server/middleware/csrf";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "csrf-token-api" });

// Route types regenerated on build - suppress until then
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/auth/csrf-token")({
  loader: async ({ request }: any) => {
    // Only allow GET requests
    if (request.method !== "GET") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed" }),
        {
          status: 405,
          headers: {
            "Content-Type": "application/json",
            Allow: "GET",
          },
        }
      );
    }

    try {
      // Check for existing token in cookie
      let token = getCsrfTokenFromCookie(request);

      // Generate new token if none exists or existing is invalid
      // Tokens should be 64 characters (32 bytes hex encoded)
      if (!token || token.length !== 64) {
        token = generateCsrfToken();
        log.debug("Generated new CSRF token", {
          path: new URL(request.url).pathname,
        });
      } else {
        log.debug("Reusing existing CSRF token", {
          path: new URL(request.url).pathname,
        });
      }

      // Return token in body and set/refresh cookie
      const cookie = buildCsrfCookie(token);

      return new Response(
        JSON.stringify({
          success: true,
          token,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": cookie,
            // Prevent caching of CSRF tokens
            "Cache-Control": "no-store, no-cache, must-revalidate",
            Pragma: "no-cache",
          },
        }
      );
    } catch (error) {
      log.error(
        "CSRF token generation error",
        error instanceof Error ? error : undefined
      );

      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to generate CSRF token",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }
  },
});
