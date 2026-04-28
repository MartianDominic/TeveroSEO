/**
 * Logo upload/delete API route.
 * Phase 16: Client branding logo management.
 *
 * POST /api/branding/:clientId/logo - Upload logo
 * DELETE /api/branding/:clientId/logo - Delete logo
 */
import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/db";
import { clientBranding } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";
import { AppError } from "@/server/lib/errors";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import {
  saveBrandingLogo,
  deleteBrandingLogo,
} from "@/server/lib/storage";

const log = createLogger({ module: "api/branding/logo" });

/**
 * Default Tevero branding colors.
 */
const DEFAULT_BRANDING = {
  primaryColor: "#3b82f6",
  secondaryColor: "#10b981",
};

export const Route = createFileRoute("/api/branding/$clientId/logo")({
  server: {
    handlers: {
      // POST /api/branding/:clientId/logo - Upload logo
      POST: async ({
        request,
        params,
      }: {
        request: Request;
        params: { clientId: string };
      }) => {
        try {
          await requireApiAuth(request);

          const { clientId } = params;

          // Validate UUID format
          if (
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              clientId,
            )
          ) {
            return Response.json(
              { error: "Invalid client_id format" },
              { status: 400 },
            );
          }

          // Parse multipart form data
          const contentType = request.headers.get("content-type") ?? "";

          if (!contentType.includes("multipart/form-data")) {
            return Response.json(
              { error: "Expected multipart/form-data" },
              { status: 400 },
            );
          }

          const formData = await request.formData();
          const file = formData.get("file");

          if (!file || !(file instanceof File)) {
            return Response.json(
              { error: "No file provided" },
              { status: 400 },
            );
          }

          const mimeType = file.type;
          const buffer = Buffer.from(await file.arrayBuffer());

          // Save logo (validates type and size)
          let result;
          try {
            result = await saveBrandingLogo(clientId, buffer, mimeType);
          } catch (err) {
            return Response.json(
              { error: (err as Error).message },
              { status: 400 },
            );
          }

          // Update or create branding record with logo URL
          const [existing] = await db
            .select()
            .from(clientBranding)
            .where(eq(clientBranding.clientId, clientId))
            .limit(1);

          if (existing) {
            await db
              .update(clientBranding)
              .set({
                logoUrl: result.path,
                updatedAt: new Date(),
              })
              .where(eq(clientBranding.id, existing.id));
          } else {
            await db.insert(clientBranding).values({
              clientId,
              logoUrl: result.path,
              primaryColor: DEFAULT_BRANDING.primaryColor,
              secondaryColor: DEFAULT_BRANDING.secondaryColor,
            });
          }

          log.info("Logo uploaded", { clientId, path: result.path });

          return Response.json({
            logoUrl: result.path,
            message: "Logo uploaded successfully",
          });
        } catch (err) {
          if (err instanceof AppError) {
            const status =
              err.code === "UNAUTHENTICATED"
                ? 401
                : err.code === "FORBIDDEN"
                  ? 403
                  : 400;
            return Response.json({ error: err.message }, { status });
          }
          log.error(
            "Logo upload failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },

      // DELETE /api/branding/:clientId/logo - Delete logo
      DELETE: async ({
        request,
        params,
      }: {
        request: Request;
        params: { clientId: string };
      }) => {
        try {
          await requireApiAuth(request);

          const { clientId } = params;

          // Validate UUID format
          if (
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              clientId,
            )
          ) {
            return Response.json(
              { error: "Invalid client_id format" },
              { status: 400 },
            );
          }

          // Delete logo file
          await deleteBrandingLogo(clientId);

          // Update branding record to clear logoUrl
          const [existing] = await db
            .select()
            .from(clientBranding)
            .where(eq(clientBranding.clientId, clientId))
            .limit(1);

          if (existing) {
            await db
              .update(clientBranding)
              .set({
                logoUrl: null,
                updatedAt: new Date(),
              })
              .where(eq(clientBranding.id, existing.id));
          }

          log.info("Logo deleted", { clientId });

          return Response.json({
            message: "Logo deleted successfully",
          });
        } catch (err) {
          if (err instanceof AppError) {
            const status =
              err.code === "UNAUTHENTICATED"
                ? 401
                : err.code === "FORBIDDEN"
                  ? 403
                  : 400;
            return Response.json({ error: err.message }, { status });
          }
          log.error(
            "Logo delete failed",
            err instanceof Error ? err : new Error(String(err)),
          );
          return Response.json({ error: "Internal error" }, { status: 500 });
        }
      },
    },
  },
});
