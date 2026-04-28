/**
 * Site Connections API Routes
 * Phase 31-04: API Endpoints
 *
 * CRUD operations for site connections.
 * All credential data is encrypted by ConnectionService.
 *
 * GET /api/connections?clientId=X - List connections for client
 * POST /api/connections - Create new connection
 *
 * SECURITY CRITICAL: Contains encrypted CMS credentials.
 * Requires authentication and validates client ownership.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  connectionService,
  type CreateConnectionInput,
} from "@/server/features/connections/services/ConnectionService";
import { PLATFORM_TYPES } from "@/server/features/connections/types";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { resolveClientId } from "@/server/lib/client-context";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/connections" });

const CreateConnectionSchema = z.object({
  clientId: z.string().min(1, "clientId is required"),
  platform: z.enum(PLATFORM_TYPES),
  siteUrl: z.string().url("siteUrl must be a valid URL"),
  displayName: z.string().optional(),
  credentials: z.record(z.string(), z.unknown()),
});

export const Route = createFileRoute("/api/connections/")({
  server: {
    handlers: {
      // GET /api/connections?clientId=X
      GET: async ({ request }: { request: Request }) => {
        try {
          // 1. Authenticate request
          await requireApiAuth(request);

          const url = new URL(request.url);
          const clientIdParam = url.searchParams.get("clientId");

          if (!clientIdParam) {
            return Response.json(
              { error: "clientId query parameter required" },
              { status: 400 }
            );
          }

          // 2. Validate client ownership
          const headers = new Headers(request.headers);
          headers.set("x-client-id", clientIdParam);
          await resolveClientId(headers, request.url);

          const connections =
            await connectionService.getConnectionsForClient(clientIdParam);
          return Response.json(connections);
        } catch (error) {
          if (error instanceof AppError) {
            const status =
              error.code === "UNAUTHENTICATED"
                ? 401
                : error.code === "FORBIDDEN"
                  ? 403
                  : 400;
            return Response.json({ error: error.message }, { status });
          }
          log.error(
            "Failed to get connections",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },

      // POST /api/connections - create new connection
      POST: async ({ request }: { request: Request }) => {
        try {
          // 1. Authenticate request
          await requireApiAuth(request);

          const body = (await request.json()) as Record<string, unknown>;
          const parsed = CreateConnectionSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              { error: "Invalid input", details: parsed.error.issues },
              { status: 400 }
            );
          }

          // 2. Validate client ownership before creating connection
          const headers = new Headers(request.headers);
          headers.set("x-client-id", parsed.data.clientId);
          await resolveClientId(headers, request.url);

          const input: CreateConnectionInput = {
            clientId: parsed.data.clientId,
            platform: parsed.data.platform,
            siteUrl: parsed.data.siteUrl,
            displayName: parsed.data.displayName,
            credentials: parsed.data.credentials as Record<string, unknown>,
          };

          const connection = await connectionService.createConnection(input);

          log.info("Connection created", {
            connectionId: connection.id,
            clientId: input.clientId,
            platform: input.platform,
          });

          return Response.json(connection, { status: 201 });
        } catch (error) {
          if (error instanceof AppError) {
            const status =
              error.code === "UNAUTHENTICATED"
                ? 401
                : error.code === "FORBIDDEN"
                  ? 403
                  : 400;
            return Response.json({ error: error.message }, { status });
          }
          log.error(
            "Failed to create connection",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
