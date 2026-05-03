/**
 * Variable Detail API Routes
 * Phase 57-02: Variable System + Resolution Service
 *
 * GET    /api/variables/:id - Get variable by ID
 * PUT    /api/variables/:id - Update custom variable
 * DELETE /api/variables/:id - Delete custom variable
 *
 * SECURITY:
 * - T-57-01: Input validation with Zod
 * - T-57-02: Workspace authorization - can only modify own variables
 * - T-57-03: System variables are read-only
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { VariableDefinitionService } from "@/server/features/proposals/services/VariableDefinitionService";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api-variables-id" });

/**
 * Zod schema for updating a variable.
 */
const UpdateVariableSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  labelEn: z.string().max(100).optional(),
  labelLt: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  descriptionEn: z.string().max(500).optional(),
  descriptionLt: z.string().max(500).optional(),
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

export const Route = createFileRoute("/api/variables/$id")({
  server: {
    handlers: {
      /**
       * GET /api/variables/:id
       * Get a single variable by ID.
       */
      GET: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string };
      }) => {
        try {
          // Get auth context
          const auth = await requireApiAuth(request);

          const variable = await VariableDefinitionService.findById(params.id);

          if (!variable) {
            return Response.json(
              { error: "Variable not found" },
              { status: 404 }
            );
          }

          // Check access - system variables or own workspace variables
          if (
            variable.workspaceId !== null &&
            variable.workspaceId !== auth.organizationId
          ) {
            return Response.json(
              { error: "Variable not found" },
              { status: 404 }
            );
          }

          return Response.json({ data: variable });
        } catch (error) {
          log.error("GET failed", error instanceof Error ? error : new Error(String(error)));
          return Response.json(
            { error: { code: "INTERNAL_ERROR", message: "Failed to fetch variable" } },
            { status: 500 }
          );
        }
      },

      /**
       * PUT /api/variables/:id
       * Update a custom variable. System variables cannot be updated.
       */
      PUT: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string };
      }) => {
        try {
          // Get auth context
          const auth = await requireApiAuth(request);

          // Parse and validate body
          const body = (await request.json()) as Record<string, unknown>;
          const parsed = UpdateVariableSchema.safeParse(body);

          if (!parsed.success) {
            return Response.json(
              {
                error: "Invalid input",
                details: parsed.error.issues.map((issue) => ({
                  field: issue.path.join("."),
                  message: issue.message,
                })),
              },
              { status: 400 }
            );
          }

          // Update variable
          const updated = await VariableDefinitionService.update(
            params.id,
            auth.organizationId,
            parsed.data
          );

          return Response.json({ data: updated });
        } catch (error) {
          log.error("PUT failed", error instanceof Error ? error : new Error(String(error)));

          // Handle specific errors
          if (error instanceof Error) {
            if (error.message.includes("NOT_FOUND")) {
              return Response.json(
                { error: { code: "NOT_FOUND", message: "Variable not found" } },
                { status: 404 }
              );
            }
            if (error.message.includes("FORBIDDEN")) {
              return Response.json(
                { error: { code: "FORBIDDEN", message: "System variables cannot be modified" } },
                { status: 403 }
              );
            }
          }

          return Response.json(
            { error: { code: "INTERNAL_ERROR", message: "Failed to update variable" } },
            { status: 500 }
          );
        }
      },

      /**
       * DELETE /api/variables/:id
       * Delete a custom variable. System variables cannot be deleted.
       */
      DELETE: async ({
        request,
        params,
      }: {
        request: Request;
        params: { id: string };
      }) => {
        try {
          // Get auth context
          const auth = await requireApiAuth(request);

          // Delete variable
          await VariableDefinitionService.delete(params.id, auth.organizationId);

          return Response.json({ success: true });
        } catch (error) {
          log.error("DELETE failed", error instanceof Error ? error : new Error(String(error)));

          // Handle specific errors
          if (error instanceof Error) {
            if (error.message.includes("NOT_FOUND")) {
              return Response.json(
                { error: { code: "NOT_FOUND", message: "Variable not found" } },
                { status: 404 }
              );
            }
            if (error.message.includes("FORBIDDEN")) {
              return Response.json(
                { error: { code: "FORBIDDEN", message: "System variables cannot be deleted" } },
                { status: 403 }
              );
            }
          }

          return Response.json(
            { error: { code: "INTERNAL_ERROR", message: "Failed to delete variable" } },
            { status: 500 }
          );
        }
      },
    },
  },
});
