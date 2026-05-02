"use server";

/**
 * Server Actions for Agreement Template Editor
 * Phase 59-05: Template Editor with Drag-Drop Variables
 *
 * Provides CRUD operations for agreement templates with clause management.
 * Calls open-seo-main API endpoints for persistence.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getOpenSeo, putOpenSeo } from "@/lib/server-fetch";
import { requireActionAuth } from "@/lib/auth/action-auth";

// =============================================================================
// Types
// =============================================================================

/**
 * Template clause structure matching the agreement_templates.sections JSONB.
 */
export interface TemplateClause {
  id: string;
  title: string;
  content: string;
  isLegal: boolean;
  order: number;
}

/**
 * Template variable definition.
 */
export interface TemplateVariable {
  key: string;
  label: string;
  type: "text" | "date" | "currency" | "number" | "list";
  required: boolean;
  translateValue: boolean;
}

/**
 * Full template data structure for the editor.
 */
export interface TemplateData {
  id: string;
  name: string;
  description: string | null;
  language: "en" | "lt";
  type: string;
  clauses: TemplateClause[];
  clauseOrder: string[];
  variables: TemplateVariable[];
  version: number;
  isActive: boolean;
}

/**
 * API response shape from open-seo-main.
 */
interface ApiTemplateResponse {
  id: string;
  name: string;
  description: string | null;
  language: string;
  type: string;
  sections: TemplateClause[];
  variables: TemplateVariable[];
  version: number;
  isActive: boolean;
}

// =============================================================================
// Validation Schemas
// =============================================================================

const templateIdSchema = z.string().min(1, "Template ID is required");

const clauseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  content: z.string().max(50000),
  isLegal: z.boolean(),
  order: z.number().int().min(0),
});

const variableSchema = z.object({
  key: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  type: z.enum(["text", "date", "currency", "number", "list"]),
  required: z.boolean(),
  translateValue: z.boolean(),
});

const saveTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable(),
  clauses: z.array(clauseSchema).max(50),
  clauseOrder: z.array(z.string()).max(50),
  variables: z.array(variableSchema).max(100),
});

// =============================================================================
// Server Actions
// =============================================================================

/**
 * Get a template by ID.
 */
export async function getTemplate(templateId: string): Promise<TemplateData | null> {
  await requireActionAuth();

  const validatedId = templateIdSchema.parse(templateId);

  try {
    const template = await getOpenSeo<ApiTemplateResponse>(
      `/api/templates/agreements/${validatedId}`
    );

    if (!template) return null;

    // Transform API response to editor format
    // The API uses "sections" but the editor uses "clauses" for clarity
    const clauses = template.sections || [];
    const clauseOrder = clauses
      .sort((a, b) => a.order - b.order)
      .map((c) => c.id);

    return {
      id: template.id,
      name: template.name,
      description: template.description,
      language: template.language as "en" | "lt",
      type: template.type,
      clauses,
      clauseOrder,
      variables: template.variables || [],
      version: template.version,
      isActive: template.isActive,
    };
  } catch (error) {
    console.error("[getTemplate] Failed to fetch template:", error);
    return null;
  }
}

/**
 * Save template changes.
 */
export async function saveTemplate(
  templateId: string,
  data: {
    name: string;
    description: string | null;
    clauses: TemplateClause[];
    clauseOrder: string[];
    variables: TemplateVariable[];
  }
): Promise<{ success: boolean; error?: string }> {
  await requireActionAuth();

  const validatedId = templateIdSchema.parse(templateId);
  const validatedData = saveTemplateSchema.parse(data);

  try {
    // Reorder clauses based on clauseOrder before saving
    const orderedClauses = validatedData.clauseOrder.map((id, index) => {
      const clause = validatedData.clauses.find((c) => c.id === id);
      if (!clause) {
        throw new Error(`Clause ${id} not found in clauses array`);
      }
      return { ...clause, order: index };
    });

    await putOpenSeo(`/api/templates/agreements/${validatedId}`, {
      name: validatedData.name,
      description: validatedData.description,
      sections: orderedClauses,
      variables: validatedData.variables,
    });

    revalidatePath(`/templates/${validatedId}/edit`);
    return { success: true };
  } catch (error) {
    console.error("[saveTemplate] Failed to save template:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save template",
    };
  }
}

/**
 * Add a new clause to a template.
 */
export async function addClause(
  templateId: string,
  clause: Omit<TemplateClause, "order">
): Promise<{ success: boolean; clause?: TemplateClause; error?: string }> {
  await requireActionAuth();

  const validatedId = templateIdSchema.parse(templateId);

  try {
    // Get current template to determine order
    const template = await getTemplate(validatedId);
    if (!template) {
      return { success: false, error: "Template not found" };
    }

    const newOrder = template.clauses.length;
    const newClause: TemplateClause = {
      ...clause,
      order: newOrder,
    };

    // Save with the new clause added
    const result = await saveTemplate(validatedId, {
      name: template.name,
      description: template.description,
      clauses: [...template.clauses, newClause],
      clauseOrder: [...template.clauseOrder, newClause.id],
      variables: template.variables,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, clause: newClause };
  } catch (error) {
    console.error("[addClause] Failed to add clause:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add clause",
    };
  }
}

/**
 * Delete a clause from a template.
 */
export async function deleteClause(
  templateId: string,
  clauseId: string
): Promise<{ success: boolean; error?: string }> {
  await requireActionAuth();

  const validatedId = templateIdSchema.parse(templateId);

  try {
    const template = await getTemplate(validatedId);
    if (!template) {
      return { success: false, error: "Template not found" };
    }

    const filteredClauses = template.clauses.filter((c) => c.id !== clauseId);
    const filteredOrder = template.clauseOrder.filter((id) => id !== clauseId);

    const result = await saveTemplate(validatedId, {
      name: template.name,
      description: template.description,
      clauses: filteredClauses,
      clauseOrder: filteredOrder,
      variables: template.variables,
    });

    return result;
  } catch (error) {
    console.error("[deleteClause] Failed to delete clause:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete clause",
    };
  }
}

/**
 * Reorder clauses in a template.
 */
export async function reorderClauses(
  templateId: string,
  newOrder: string[]
): Promise<{ success: boolean; error?: string }> {
  await requireActionAuth();

  const validatedId = templateIdSchema.parse(templateId);

  try {
    const template = await getTemplate(validatedId);
    if (!template) {
      return { success: false, error: "Template not found" };
    }

    const result = await saveTemplate(validatedId, {
      name: template.name,
      description: template.description,
      clauses: template.clauses,
      clauseOrder: newOrder,
      variables: template.variables,
    });

    return result;
  } catch (error) {
    console.error("[reorderClauses] Failed to reorder clauses:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reorder clauses",
    };
  }
}
