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
 *
 * CRIT-API-01 FIX: Platform-specific credential validation.
 * HIGH-API-05 FIX: 422 for validation errors.
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
import {
  GoogleCredentialsSchema,
  ShopifyCredentialsSchema,
  WordPressCredentialsSchema,
  WordPressOAuthCredentialsSchema,
  WixCredentialsSchema,
  WebflowCredentialsSchema,
  SquarespaceCredentialsSchema,
  PixelCredentialsSchema,
  CustomCredentialsSchema,
  errorResponse,
} from "@/shared/api-schemas";

const log = createLogger({ module: "api/connections" });

/**
 * CRIT-API-01 FIX: Platform-specific credential validation schemas.
 * Uses discriminated union to validate credentials based on platform type.
 */
const PlatformCredentialSchemas: Record<string, z.ZodSchema> = {
  wordpress: z.union([WordPressCredentialsSchema, WordPressOAuthCredentialsSchema]),
  shopify: ShopifyCredentialsSchema,
  wix: WixCredentialsSchema,
  squarespace: SquarespaceCredentialsSchema,
  webflow: WebflowCredentialsSchema,
  pixel: PixelCredentialsSchema,
  custom: CustomCredentialsSchema,
};

/**
 * Validate credentials for a specific platform.
 * Returns validation result with detailed error messages.
 */
function validateCredentialsForPlatform(
  platform: string,
  credentials: unknown
): { success: true; data: Record<string, unknown> } | { success: false; errors: Array<{ path: Array<string | number>; message: string }> } {
  const schema = PlatformCredentialSchemas[platform];
  if (!schema) {
    // Unknown platform - use minimal validation
    if (!credentials || typeof credentials !== "object") {
      return {
        success: false,
        errors: [{ path: ["credentials"], message: "Credentials must be an object" }],
      };
    }
    return { success: true, data: credentials as Record<string, unknown> };
  }

  const result = schema.safeParse(credentials);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map((issue) => ({
        path: ["credentials", ...issue.path.map((p) => typeof p === "symbol" ? String(p) : p)] as Array<string | number>,
        message: issue.message,
      })),
    };
  }

  return { success: true, data: result.data as Record<string, unknown> };
}

const CreateConnectionSchema = z.object({
  clientId: z.string().min(1, "clientId is required"),
  platform: z.enum(PLATFORM_TYPES),
  siteUrl: z.string().url("siteUrl must be a valid URL"),
  displayName: z.string().optional(),
  // Note: credentials are validated separately per platform
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
            // HIGH-API-05 FIX: Use 422 for missing required parameter
            return errorResponse("VALIDATION_ERROR", "clientId query parameter required");
          }

          // 2. Validate client ownership
          const headers = new Headers(request.headers);
          headers.set("x-client-id", clientIdParam);
          await resolveClientId(headers, request.url);

          const connections =
            await connectionService.getConnectionsForClient(clientIdParam);
          return Response.json({ success: true, data: connections });
        } catch (error) {
          if (error instanceof AppError) {
            return errorResponse(error.code, error.message);
          }
          log.error(
            "Failed to get connections",
            error instanceof Error ? error : new Error(String(error))
          );
          return errorResponse("INTERNAL_ERROR", "Failed to get connections");
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
            // HIGH-API-05 FIX: Use 422 for validation errors
            return errorResponse("VALIDATION_ERROR", "Invalid input", {
              details: parsed.error.issues.map((issue) => ({
                path: issue.path.map((p) => typeof p === "symbol" ? String(p) : p) as Array<string | number>,
                message: issue.message,
              })),
            });
          }

          // CRIT-API-01 FIX: Validate credentials based on platform type
          const credentialValidation = validateCredentialsForPlatform(
            parsed.data.platform,
            parsed.data.credentials
          );

          if (credentialValidation.success === false) {
            return errorResponse("VALIDATION_ERROR", `Invalid credentials for platform ${parsed.data.platform}`, {
              details: credentialValidation.errors,
            });
          }

          // 2. Validate client ownership before creating connection
          const headers = new Headers(request.headers);
          headers.set("x-client-id", parsed.data.clientId);
          await resolveClientId(headers, request.url);

          // Type is now narrowed to { success: true; data: Record<string, unknown> }
          const validatedCredentials = credentialValidation.data;

          const input: CreateConnectionInput = {
            clientId: parsed.data.clientId,
            platform: parsed.data.platform,
            siteUrl: parsed.data.siteUrl,
            displayName: parsed.data.displayName,
            credentials: validatedCredentials,
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
            return errorResponse(error.code, error.message);
          }
          log.error(
            "Failed to create connection",
            error instanceof Error ? error : new Error(String(error))
          );
          return errorResponse("INTERNAL_ERROR", "Failed to create connection");
        }
      },
    },
  },
});
