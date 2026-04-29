/**
 * Next.js Instrumentation
 *
 * This file is loaded once when the Next.js server starts.
 * Use it for one-time initialization like validating critical dependencies.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on the server (not during build or in edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
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
}
