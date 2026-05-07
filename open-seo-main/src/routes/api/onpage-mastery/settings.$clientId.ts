/**
 * On-Page Mastery Settings API
 * Phase 92-09: API Routes + UI Components
 *
 * GET /api/onpage-mastery/settings/$clientId - Get client settings
 * PUT /api/onpage-mastery/settings/$clientId - Update client settings
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clientSeoSettings } from "@/db/onpage-mastery-schema";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api/onpage-mastery/settings" });

const UpdateSettingsSchema = z.object({
  tier5Enabled: z.boolean().optional(),
  verticalOverride: z.string().nullable().optional(),
  qualityGateTier: z.enum(["basic", "standard", "full"]).optional(),
  excludedChecks: z.array(z.string()).optional(),
});

export const Route = createFileRoute(
  "/api/onpage-mastery/settings/$clientId" as never
)({
  server: {
    handlers: {
      GET: async ({ params }: { params: { clientId: string } }) => {
        const { clientId } = params;

        try {
          const settings = await db
            .select()
            .from(clientSeoSettings)
            .where(eq(clientSeoSettings.clientId, clientId))
            .limit(1);

          if (settings.length === 0) {
            return Response.json({
              success: true,
              data: {
                clientId,
                tier5Enabled: false,
                verticalOverride: null,
                qualityGateTier: "basic",
                excludedChecks: [],
              },
            });
          }

          return Response.json({ success: true, data: settings[0] });
        } catch (error) {
          log.error(
            "Failed to fetch settings",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json(
            { success: false, error: (error as Error).message },
            { status: 500 }
          );
        }
      },

      PUT: async ({
        request,
        params,
      }: {
        request: Request;
        params: { clientId: string };
      }) => {
        const { clientId } = params;

        try {
          const body = (await request.json()) as Record<string, unknown>;
          const parsed = UpdateSettingsSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              { success: false, error: parsed.error.message },
              { status: 400 }
            );
          }

          await db
            .insert(clientSeoSettings)
            .values({
              clientId,
              tier5Enabled: parsed.data.tier5Enabled ?? false,
              verticalOverride: parsed.data.verticalOverride ?? null,
              qualityGateTier: parsed.data.qualityGateTier ?? "basic",
              excludedChecks: parsed.data.excludedChecks ?? [],
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [clientSeoSettings.clientId],
              set: {
                ...parsed.data,
                updatedAt: new Date(),
              },
            });

          return Response.json({ success: true });
        } catch (error) {
          log.error(
            "Failed to update settings",
            error instanceof Error ? error : new Error(String(error))
          );
          return Response.json(
            { success: false, error: (error as Error).message },
            { status: 500 }
          );
        }
      },
    },
  },
});
