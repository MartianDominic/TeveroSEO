/**
 * Next.js Instrumentation
 *
 * This file is loaded once when the Next.js server starts.
 * Use it for one-time initialization like validating critical dependencies
 * and initializing error tracking (Sentry).
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Initialize Sentry based on runtime environment
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Server-side Sentry initialization
    await import("../sentry.server.config");

    const { validateRedisAtStartup } = await import("@/lib/redis/client");

    try {
      await validateRedisAtStartup();
    } catch (error) {
      // In production, this will throw and prevent the server from starting
      // if Redis is unavailable. The error is already logged in validateRedisAtStartup.
      if (process.env.NODE_ENV === "production") {
        throw error;
      }
      // In development, we allow the server to start even without Redis
      console.warn(
        "[instrumentation] Redis validation failed, continuing in development mode"
      );
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    // Edge runtime Sentry initialization
    await import("../sentry.edge.config");
  }
}

/**
 * Sentry error handler for uncaught errors.
 * Next.js calls this when an error propagates to the error boundary.
 */
export const onRequestError = async (
  error: Error,
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
  },
  context: {
    routerKind: "Pages Router" | "App Router";
    routePath: string;
    routeType: "render" | "route" | "action" | "middleware";
    revalidateReason?: "on-demand" | "stale" | undefined;
    renderSource?: "react-server-components" | "react-server-components-payload" | "server-rendering";
  }
) => {
  // Dynamic import to avoid loading Sentry if not configured
  const Sentry = await import("@sentry/nextjs");

  Sentry.captureException(error, {
    extra: {
      method: request.method,
      url: request.url,
      routerKind: context.routerKind,
      routePath: context.routePath,
      routeType: context.routeType,
      revalidateReason: context.revalidateReason,
      renderSource: context.renderSource,
    },
    tags: {
      routerKind: context.routerKind,
      routeType: context.routeType,
    },
  });
};
