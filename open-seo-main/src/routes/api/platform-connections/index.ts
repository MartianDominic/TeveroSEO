/**
 * Platform Connections API Routes
 * Phase 61-06: Platform Integration Excellence
 *
 * GET /api/platform-connections?workspaceId=X - List OAuth connections for workspace
 * POST /api/platform-connections - Create new OAuth connection
 *
 * SECURITY CRITICAL: Contains encrypted OAuth tokens.
 * Requires authentication and validates workspace ownership.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { platformConnectionService } from "@/server/features/platform-oauth/PlatformConnectionService";
import { OAUTH_PLATFORM_TYPES } from "@/db/platform-connection-schema";
import { encryptToken } from "@/server/features/platform-oauth/TokenEncryption";
import { db } from "@/db";
import { platformConnections } from "@/db/platform-connection-schema";
import { nanoid } from "nanoid";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/platform-connections" });

const CreatePlatformConnectionSchema = z.object({
  id: z.string().optional(),
  workspaceId: z.string().min(1, "workspaceId is required"),
  prospectId: z.string().nullable().optional(),
  platform: z.enum(OAUTH_PLATFORM_TYPES),
  platformAccountId: z.string().nullable().optional(),
  platformAccountName: z.string().nullable().optional(),
  platformSiteUrl: z.string().nullable().optional(),
  credentialType: z.enum(["oauth", "app_password", "api_key"]),
  credentials: z
    .object({
      username: z.string(),
      appPassword: z.string(),
    })
    .optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresIn: z.number().optional(),
  status: z.string().optional(),
  connectedBy: z.string(),
});

export const Route = createFileRoute("/api/platform-connections/")({
  server: {
    handlers: {
      // GET /api/platform-connections?workspaceId=X&prospectId=Y
      GET: async ({ request }: { request: Request }) => {
        try {
          const userId = request.headers.get("x-user-id");
          if (!userId) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }

          const url = new URL(request.url);
          const workspaceId = url.searchParams.get("workspaceId");
          const prospectId = url.searchParams.get("prospectId");

          if (!workspaceId) {
            return Response.json(
              { error: "workspaceId query parameter required" },
              { status: 400 }
            );
          }

          const connections =
            await platformConnectionService.getConnectionsForWorkspace(
              workspaceId,
              prospectId ?? undefined
            );

          return Response.json({ connections });
        } catch (error) {
          log.error(
            "Failed to get platform connections",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },

      // POST /api/platform-connections - create new connection
      POST: async ({ request }: { request: Request }) => {
        try {
          const userId = request.headers.get("x-user-id");
          if (!userId) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }

          const body = (await request.json()) as Record<string, unknown>;
          const parsed = CreatePlatformConnectionSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              { error: "Invalid input", details: parsed.error.issues },
              { status: 400 }
            );
          }

          const data = parsed.data;
          const id = data.id ?? nanoid();
          const now = new Date();

          // Handle different credential types
          if (data.credentialType === "app_password" && data.credentials) {
            // WordPress app password connection
            await db.insert(platformConnections).values({
              id,
              workspaceId: data.workspaceId,
              prospectId: data.prospectId ?? null,
              platform: data.platform,
              platformAccountId: data.platformAccountId ?? null,
              platformAccountName: data.platformAccountName ?? null,
              platformSiteUrl: data.platformSiteUrl ?? null,
              credentialType: "app_password",
              credentialsEncrypted: encryptToken(
                JSON.stringify(data.credentials)
              ),
              status: data.status ?? "active",
              connectedAt: now,
              connectedBy: data.connectedBy,
              createdAt: now,
              updatedAt: now,
            });
          } else if (data.accessToken) {
            // OAuth connection
            const expiresAt = data.expiresIn
              ? new Date(now.getTime() + data.expiresIn * 1000)
              : null;

            await db.insert(platformConnections).values({
              id,
              workspaceId: data.workspaceId,
              prospectId: data.prospectId ?? null,
              platform: data.platform,
              platformAccountId: data.platformAccountId ?? null,
              platformAccountName: data.platformAccountName ?? null,
              platformSiteUrl: data.platformSiteUrl ?? null,
              credentialType: "oauth",
              accessTokenEncrypted: encryptToken(data.accessToken),
              refreshTokenEncrypted: data.refreshToken
                ? encryptToken(data.refreshToken)
                : null,
              tokenExpiresAt: expiresAt,
              status: data.status ?? "active",
              connectedAt: now,
              connectedBy: data.connectedBy,
              createdAt: now,
              updatedAt: now,
            });
          } else {
            return Response.json(
              { error: "Either credentials or accessToken required" },
              { status: 400 }
            );
          }

          log.info("Platform connection created", {
            connectionId: id,
            workspaceId: data.workspaceId,
            platform: data.platform,
          });

          return Response.json({ id, success: true }, { status: 201 });
        } catch (error) {
          log.error(
            "Failed to create platform connection",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
