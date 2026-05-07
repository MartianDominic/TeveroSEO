/**
 * Portal Data API Endpoint
 * Phase 86-10: Final Integration
 *
 * GET /api/portal/data/:token
 *
 * Returns portal data for the given token, including:
 * - Client and agency info
 * - Goal and achievement metrics
 * - Keyword clusters ("growth areas")
 * - Content calendar events
 */

import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/db";
import { PortalDataService } from "@/server/features/portal/PortalDataService";

export const Route = createFileRoute("/api/portal/data/$token")({
  server: {
    handlers: {
      GET: async ({ params }: { params: { token: string } }) => {
        const { token } = params;

        if (!token) {
          return Response.json(
            { error: "Token required" },
            { status: 400 }
          );
        }

        try {
          const service = new PortalDataService(db as any);
          const data = await service.getPortalData(token);

          return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "private, max-age=300",
            },
          });
        } catch (error) {
          // Handle known error cases
          if (error instanceof Error) {
            if (error.message.includes("Invalid or expired")) {
              return Response.json(
                { error: "Invalid or expired portal token" },
                { status: 401 }
              );
            }
          }

          // Log unexpected errors
          console.error("[portal/data] Unexpected error:", error);

          return Response.json(
            { error: "Internal server error" },
            { status: 500 }
          );
        }
      },
    },
  },
});
