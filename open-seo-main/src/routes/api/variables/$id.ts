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
import { getClerkAuth } from "@/server/lib/clerk-auth";

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
  formatOptions: z.record(z.unknown()).optional(),
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
          const auth = await getClerkAuth(request);
          if (!auth?.userId || !auth?.orgId) {
            return Response.json(
              { error: "Unauthorized" },
              { status: 401 }
            );
          }

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
            variable.workspaceId !== auth.orgId
          ) {
            return Response.json(
              { error: "Variable not found" },
              { status: 404 }
            );
          }

          return Response.json({ data: variable });
        } catch (error) {
          console.error("[api/variables/$id] GET failed:", error);
          return Response.json(
            { error: "Failed to fetch variable" },
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
          const auth = await getClerkAuth(request);
          if (!auth?.userId || !auth?.orgId) {
            return Response.json(
              { error: "Unauthorized" },
              { status: 401 }
            );
          }

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
            auth.orgId,
            parsed.data
          );

          return Response.json({ data: updated });
        } catch (error) {
          console.error("[api/variables/$id] PUT failed:", error);

          // Handle specific errors
          if (error instanceof Error) {
            if (error.message.includes("NOT_FOUND")) {
              return Response.json(
                { error: "Variable not found" },
                { status: 404 }
              );
            }
            if (error.message.includes("FORBIDDEN")) {
              return Response.json(
                { error: "System variables cannot be modified" },
                { status: 403 }
              );
            }
          }

          return Response.json(
            { error: "Failed to update variable" },
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
          const auth = await getClerkAuth(request);
          if (!auth?.userId || !auth?.orgId) {
            return Response.json(
              { error: "Unauthorized" },
              { status: 401 }
            );
          }

          // Delete variable
          await VariableDefinitionService.delete(params.id, auth.orgId);

          return Response.json({ success: true });
        } catch (error) {
          console.error("[api/variables/$id] DELETE failed:", error);

          // Handle specific errors
          if (error instanceof Error) {
            if (error.message.includes("NOT_FOUND")) {
              return Response.json(
                { error: "Variable not found" },
                { status: 404 }
              );
            }
            if (error.message.includes("FORBIDDEN")) {
              return Response.json(
                { error: "System variables cannot be deleted" },
                { status: 403 }
              );
            }
          }

          return Response.json(
            { error: "Failed to delete variable" },
            { status: 500 }
          );
        }
      },
    },
  },
});
