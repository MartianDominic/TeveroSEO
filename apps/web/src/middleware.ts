import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/connect/(.*)",
  "/api/health",
]);

// Sensitive routes require fresh sessions (re-auth after 24 hours)
const isSensitiveRoute = createRouteMatcher([
  "/settings(.*)",
  "/(.*)/delete(.*)",
  "/(.*)/admin(.*)",
  "/admin(.*)",
]);

// Maximum session age for sensitive operations (24 hours)
const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000;

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) {
    return;
  }

  const authObj = await auth();
  const { userId, sessionClaims } = authObj;

  // Require authentication for protected routes
  if (!userId) {
    return authObj.redirectToSignIn();
  }

  // Check session freshness for sensitive operations
  if (sessionClaims && isSensitiveRoute(req)) {
    // sessionClaims.iat is the "issued at" timestamp in seconds (JWT standard)
    const sessionIssuedAt = sessionClaims.iat
      ? (sessionClaims.iat as number) * 1000
      : 0;
    const sessionAge = Date.now() - sessionIssuedAt;

    if (sessionAge > MAX_SESSION_AGE_MS) {
      // Session too old for sensitive operations - require re-authentication
      const signInUrl = new URL("/sign-in", req.url);
      signInUrl.searchParams.set("redirect_url", req.nextUrl.pathname);
      signInUrl.searchParams.set("reason", "session_expired");
      return Response.redirect(signInUrl);
    }
  }
});

export const config = {
  matcher: [
    // Protect everything except _next internals and files with extensions
    "/((?!_next|.*\\..*).*)",
    "/",
    "/(api|trpc)(.*)",
  ],
};
