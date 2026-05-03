/**
 * Connection Verification API Route
 * Phase 66-02: Pixel Event Collection + Real-Time Verification
 *
 * POST /api/connect/verify
 * GET /api/connect/verify?siteId=xxx
 *
 * Long-polls for up to 30 seconds waiting for pixel installation.
 * Returns status with location data when detected.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createLogger } from "@/server/lib/logger";
import { getPixelVerificationService } from "@/server/features/pixel/pixel-verification.service";

const log = createLogger({ module: "api/connect/verify" });

/**
 * Zod schema for verification request.
 */
const VerifyRequestSchema = z.object({
  siteId: z.string().min(1).max(100),
  timeoutMs: z.number().min(1000).max(60000).optional().default(30000),
});

export const Route = createFileRoute("/api/connect/verify")({
  server: {
    handlers: {
      // POST /api/connect/verify
      POST: async ({ request }: { request: Request }) => {
        try {
          const body = await request.json();
          const parsed = VerifyRequestSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              { error: "Invalid request", details: parsed.error.issues },
              { status: 400 }
            );
          }

          const verificationService = getPixelVerificationService();
          const status = await verificationService.waitForVerification(
            parsed.data.siteId,
            parsed.data.timeoutMs
          );

          log.info("Connection verification result", {
            siteId: parsed.data.siteId,
            status: status.status,
            timedOut: status.timedOut,
          });

          return Response.json(status, {
            headers: {
              "Cache-Control": "no-cache, no-store, must-revalidate",
            },
          });
        } catch (error) {
          log.error(
            "Connection verification error",
            error instanceof Error ? error : new Error(String(error))
          );

          return Response.json(
            { error: "Internal error" },
            { status: 500 }
          );
        }
      },

      // GET /api/connect/verify?siteId=xxx
      GET: async ({ request }: { request: Request }) => {
        try {
          const url = new URL(request.url);
          const siteId = url.searchParams.get("siteId");
          const timeoutMs = parseInt(url.searchParams.get("timeoutMs") || "30000", 10);

          const parsed = VerifyRequestSchema.safeParse({ siteId, timeoutMs });

          if (!parsed.success) {
            return Response.json(
              { error: "Invalid request", details: parsed.error.issues },
              { status: 400 }
            );
          }

          const verificationService = getPixelVerificationService();
          const status = await verificationService.waitForVerification(
            parsed.data.siteId,
            parsed.data.timeoutMs
          );

          return Response.json(status, {
            headers: {
              "Cache-Control": "no-cache, no-store, must-revalidate",
            },
          });
        } catch (error) {
          log.error(
            "Connection verification error",
            error instanceof Error ? error : new Error(String(error))
          );

          return Response.json(
            { error: "Internal error" },
            { status: 500 }
          );
        }
      },
    },
  },
});
