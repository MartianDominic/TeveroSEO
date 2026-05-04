/**
 * Variables API Routes
 * Phase 57-02: Variable System + Resolution Service
 *
 * GET  /api/variables            - List all variables (system + workspace)
 * GET  /api/variables/categories - List all categories with metadata
 * POST /api/variables            - Create custom variable
 *
 * SECURITY:
 * - T-57-01: Input validation with Zod
 * - T-57-02: Workspace authorization via Clerk JWT
 * - T-57-03: Rate limiting via existing middleware
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { VariableDefinitionService } from "@/server/features/proposals/services/VariableDefinitionService";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { VARIABLE_CATEGORIES } from "@/db/variable-definitions-schema";
import { createLogger } from "@/server/lib/logger";
import { successResponse, errorResponse } from "@/server/lib/response";

const log = createLogger({ module: "api-variables" });

/**
 * Zod schema for creating a custom variable.
 */
const CreateVariableSchema = z.object({
  key: z
    .string()
    .min(3, "Key must be at least 3 characters")
    .max(50, "Key must be at most 50 characters")
    .regex(
      /^[a-z]+\.[a-zA-Z0-9_]+$/,
      "Key must be in format 'category.name' (lowercase category, alphanumeric name)"
    ),
  label: z
    .string()
    .min(1, "Label is required")
    .max(100, "Label must be at most 100 characters"),
  labelEn: z.string().max(100).optional(),
  labelLt: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  descriptionEn: z.string().max(500).optional(),
  descriptionLt: z.string().max(500).optional(),
  category: z.enum(VARIABLE_CATEGORIES as unknown as readonly [string, ...string[]]).optional(),
  sourceType: z.enum(["entity", "computed", "custom", "input"]).optional(),
  sourcePath: z.string().max(200).optional(),
  format: z.enum(["text", "currency", "date", "number", "percentage", "list"]).optional(),
  formatOptions: z.record(z.string(), z.unknown()).optional(),
  defaultValue: z.string().max(1000).optional(),
  isRequired: z.boolean().optional(),
  validationRules: z
    .object({
      minLength: z.number().int().min(0).optional(),
      maxLength: z.number().int().min(1).max(10000).optional(),
      pattern: z.string().max(500).optional(),
      required: z.boolean().optional(),
    })
    .optional(),
  icon: z.string().max(50).optional(),
  displayOrder: z.number().int().min(0).max(1000).optional(),
});

/**
 * Query params for list endpoint.
 */
const ListQuerySchema = z.object({
  locale: z.enum(["en", "lt"]).optional(),
  grouped: z.enum(["true", "false"]).optional(),
});

export const Route = createFileRoute("/api/variables/")({
  server: {
    handlers: {
      /**
       * GET /api/variables
       * List all variables available to the authenticated workspace.
       */
      GET: async ({ request }: { request: Request }) => {
        try {
          // Get auth context
          const auth = await requireApiAuth(request);

          // Parse query params
          const url = new URL(request.url);
          const params = ListQuerySchema.safeParse({
            locale: url.searchParams.get("locale") ?? "en",
            grouped: url.searchParams.get("grouped") ?? "false",
          });

          if (!params.success) {
            return errorResponse(400, "Invalid query parameters", {
              code: "VALIDATION_ERROR",
            });
          }

          const locale = params.data.locale ?? "en";
          const grouped = params.data.grouped ?? "false";

          // Fetch variables
          if (grouped === "true") {
            const categories = await VariableDefinitionService.listByCategory(
              auth.organizationId,
              locale as "en" | "lt"
            );
            return successResponse(categories);
          }

          const variables = await VariableDefinitionService.listAll(
            auth.organizationId,
            locale as "en" | "lt"
          );

          return successResponse(variables);
        } catch (error) {
          log.error("GET failed", error instanceof Error ? error : new Error(String(error)));
          return errorResponse(500, "Failed to fetch variables", { code: "INTERNAL_ERROR" });
        }
      },

      /**
       * POST /api/variables
       * Create a custom variable for the workspace.
       */
      POST: async ({ request }: { request: Request }) => {
        try {
          // Get auth context
          const auth = await requireApiAuth(request);

          // Parse and validate body
          const body = (await request.json()) as Record<string, unknown>;
          const parsed = CreateVariableSchema.safeParse(body);

          if (!parsed.success) {
            return errorResponse(400, "Invalid input", {
              code: "VALIDATION_ERROR",
              details: parsed.error.issues.map((issue) => ({
                field: issue.path.join("."),
                message: issue.message,
              })),
            });
          }

          // Create variable
          const created = await VariableDefinitionService.create({
            ...parsed.data,
            workspaceId: auth.organizationId,
            category: parsed.data.category as "custom" | "client" | "audit" | "provider" | "pricing" | "dates" | undefined,
          });

          // Return 201 with success envelope
          const successResp = successResponse(created);
          return new Response(successResp.body, {
            status: 201,
            headers: successResp.headers,
          });
        } catch (error) {
          log.error("POST failed", error instanceof Error ? error : new Error(String(error)));

          // Handle specific errors
          if (error instanceof Error) {
            if (error.message.includes("CONFLICT")) {
              return errorResponse(409, error.message, { code: "CONFLICT" });
            }
            if (error.message.includes("VALIDATION_ERROR")) {
              return errorResponse(400, error.message, { code: "VALIDATION_ERROR" });
            }
          }

          return errorResponse(500, "Failed to create variable", { code: "INTERNAL_ERROR" });
        }
      },
    },
  },
});
