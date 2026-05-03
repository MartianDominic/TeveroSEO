/**
 * Template Repository
 * Phase 57-01: Proposal Editor Revolution - Template System Foundation
 *
 * CRUD operations for proposal_templates and template_sections tables.
 * Supports three-layer hierarchy: system (workspaceId=null) -> workspace -> instance.
 */
import { eq, and, or, isNull, desc, asc, sql, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  proposalTemplates,
  templateSections,
  type ProposalTemplateInsert,
  type ProposalTemplateSelect,
  type TemplateSectionInsert,
  type TemplateSectionSelect,
  type ProposalTemplateType,
  type ProposalTemplateCategory,
} from "@/db/proposal-template-schema";

/**
 * Get all templates available to a workspace.
 * Includes system templates (workspaceId = null) and workspace-specific templates.
 */
export async function findAllTemplates(
  workspaceId: string,
  options?: {
    type?: ProposalTemplateType;
    category?: ProposalTemplateCategory;
    includeArchived?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<ProposalTemplateSelect[]> {
  const conditions = [
    or(
      eq(proposalTemplates.workspaceId, workspaceId),
      isNull(proposalTemplates.workspaceId)
    ),
  ];

  if (!options?.includeArchived) {
    conditions.push(eq(proposalTemplates.isArchived, false));
  }

  if (options?.type) {
    conditions.push(eq(proposalTemplates.type, options.type));
  }

  if (options?.category) {
    conditions.push(eq(proposalTemplates.category, options.category));
  }

  return await db
    .select()
    .from(proposalTemplates)
    .where(and(...conditions))
    .orderBy(
      // System templates first, then by name
      asc(proposalTemplates.workspaceId),
      asc(proposalTemplates.name)
    )
    .limit(options?.limit ?? 100)
    .offset(options?.offset ?? 0);
}

/**
 * Get a template by ID with its sections.
 * Uses Promise.all for parallel query execution (fixes MEDIUM-DB-005).
 */
export async function findTemplateById(
  templateId: string
): Promise<
  | (ProposalTemplateSelect & { sections: TemplateSectionSelect[] })
  | undefined
> {
  // Execute both queries in parallel since they are independent
  const [templateResult, sections] = await Promise.all([
    db
      .select()
      .from(proposalTemplates)
      .where(eq(proposalTemplates.id, templateId))
      .limit(1),
    db
      .select()
      .from(templateSections)
      .where(eq(templateSections.templateId, templateId))
      .orderBy(asc(templateSections.position)),
  ]);

  const template = templateResult[0];
  if (!template) {
    return undefined;
  }

  return { ...template, sections };
}

/**
 * Get the default template for a workspace/type combination.
 * Falls back to system default if no workspace default exists.
 */
export async function findDefaultTemplate(
  workspaceId: string,
  type: ProposalTemplateType = "proposal"
): Promise<
  | (ProposalTemplateSelect & { sections: TemplateSectionSelect[] })
  | undefined
> {
  // First try workspace default
  const [workspaceDefault] = await db
    .select()
    .from(proposalTemplates)
    .where(
      and(
        eq(proposalTemplates.workspaceId, workspaceId),
        eq(proposalTemplates.type, type),
        eq(proposalTemplates.isDefault, true),
        eq(proposalTemplates.isArchived, false)
      )
    )
    .limit(1);

  if (workspaceDefault) {
    const sections = await db
      .select()
      .from(templateSections)
      .where(eq(templateSections.templateId, workspaceDefault.id))
      .orderBy(asc(templateSections.position));
    return { ...workspaceDefault, sections };
  }

  // Fall back to system default
  const [systemDefault] = await db
    .select()
    .from(proposalTemplates)
    .where(
      and(
        isNull(proposalTemplates.workspaceId),
        eq(proposalTemplates.type, type),
        eq(proposalTemplates.isDefault, true),
        eq(proposalTemplates.isArchived, false)
      )
    )
    .limit(1);

  if (systemDefault) {
    const sections = await db
      .select()
      .from(templateSections)
      .where(eq(templateSections.templateId, systemDefault.id))
      .orderBy(asc(templateSections.position));
    return { ...systemDefault, sections };
  }

  return undefined;
}

/**
 * Create a new template with sections.
 * Uses transaction to ensure atomicity (fixes HIGH-DB-003).
 */
export async function createTemplate(
  template: ProposalTemplateInsert,
  sections?: Omit<TemplateSectionInsert, "templateId">[]
): Promise<ProposalTemplateSelect & { sections: TemplateSectionSelect[] }> {
  return await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(proposalTemplates)
      .values(template)
      .returning();

    let insertedSections: TemplateSectionSelect[] = [];

    if (sections && sections.length > 0) {
      const sectionsWithTemplateId = sections.map((section, index) => ({
        ...section,
        id: section.id ?? crypto.randomUUID(),
        templateId: inserted.id,
        position: section.position ?? index,
      }));

      // Batch insert all sections at once
      insertedSections = await tx
        .insert(templateSections)
        .values(sectionsWithTemplateId)
        .returning();

      // Update sectionOrder on the template
      const sectionOrder = insertedSections.map((s) => s.id);
      await tx
        .update(proposalTemplates)
        .set({ sectionOrder })
        .where(eq(proposalTemplates.id, inserted.id));
    }

    return { ...inserted, sections: insertedSections };
  });
}

/**
 * Update a template (metadata only, not sections).
 */
export async function updateTemplate(
  templateId: string,
  updates: Partial<
    Omit<
      ProposalTemplateInsert,
      "id" | "createdAt" | "createdBy" | "workspaceId"
    >
  >
): Promise<ProposalTemplateSelect | undefined> {
  const [updated] = await db
    .update(proposalTemplates)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(proposalTemplates.id, templateId))
    .returning();
  return updated;
}

/**
 * Update template section order.
 * Uses batch UPDATE with CASE WHEN to avoid N+1 queries (fixes HIGH-DB-001).
 */
export async function updateSectionOrder(
  templateId: string,
  sectionOrder: string[]
): Promise<ProposalTemplateSelect | undefined> {
  if (sectionOrder.length > 0) {
    // Build CASE WHEN expression for batch update
    const caseExpression = sql.join(
      sectionOrder.map(
        (id, index) => sql`WHEN ${templateSections.id} = ${id} THEN ${index}`
      ),
      sql` `
    );

    // Single batch UPDATE for all sections
    await db
      .update(templateSections)
      .set({
        position: sql`CASE ${caseExpression} ELSE ${templateSections.position} END`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(templateSections.templateId, templateId),
          inArray(templateSections.id, sectionOrder)
        )
      );
  }

  // Update sectionOrder on template
  const [updated] = await db
    .update(proposalTemplates)
    .set({ sectionOrder, updatedAt: new Date() })
    .where(eq(proposalTemplates.id, templateId))
    .returning();

  return updated;
}

/**
 * Soft delete a template (set isArchived = true).
 * Only workspace templates can be deleted, not system templates.
 */
export async function deleteTemplate(
  templateId: string,
  workspaceId: string
): Promise<boolean> {
  const [updated] = await db
    .update(proposalTemplates)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(
      and(
        eq(proposalTemplates.id, templateId),
        eq(proposalTemplates.workspaceId, workspaceId) // Prevent deleting system templates
      )
    )
    .returning();
  return !!updated;
}

/**
 * Duplicate a template to a workspace.
 * Creates a copy of a system or existing template for workspace customization.
 * Uses batch INSERT for sections to avoid N+1 queries (fixes HIGH-DB-002).
 */
export async function duplicateTemplate(
  templateId: string,
  targetWorkspaceId: string,
  newName?: string
): Promise<
  (ProposalTemplateSelect & { sections: TemplateSectionSelect[] }) | undefined
> {
  // Get the source template with sections
  const source = await findTemplateById(templateId);
  if (!source) {
    return undefined;
  }

  const newTemplateId = crypto.randomUUID();

  // Build section ID mapping and prepare batch insert data
  const sectionIdMap = new Map<string, string>();
  const sectionsToInsert = source.sections.map((section) => {
    const newSectionId = crypto.randomUUID();
    sectionIdMap.set(section.id, newSectionId);
    return {
      id: newSectionId,
      templateId: newTemplateId,
      key: section.key,
      title: section.title,
      titleEn: section.titleEn,
      titleLt: section.titleLt,
      content: section.content,
      contentEn: section.contentEn,
      contentLt: section.contentLt,
      sectionType: section.sectionType,
      isRequired: section.isRequired,
      isEditable: section.isEditable,
      position: section.position,
      conditions: section.conditions,
      aiPromptHint: section.aiPromptHint,
    };
  });

  // Calculate new section order before inserting
  const newSectionOrder = source.sectionOrder.map(
    (oldId) => sectionIdMap.get(oldId) ?? oldId
  );

  // Use transaction for atomicity
  return await db.transaction(async (tx) => {
    // Create the new template with final sectionOrder
    const [newTemplate] = await tx
      .insert(proposalTemplates)
      .values({
        id: newTemplateId,
        workspaceId: targetWorkspaceId,
        name: newName ?? `${source.name} (Copy)`,
        nameEn: source.nameEn,
        nameLt: source.nameLt,
        description: source.description,
        descriptionEn: source.descriptionEn,
        descriptionLt: source.descriptionLt,
        type: source.type as ProposalTemplateType,
        category: source.category as ProposalTemplateCategory,
        variables: source.variables,
        brandingSettings: source.brandingSettings,
        version: 1,
        isPublished: false,
        isDefault: false,
        isArchived: false,
        sectionOrder: newSectionOrder,
      })
      .returning();

    // Batch insert all sections at once
    let newSections: TemplateSectionSelect[] = [];
    if (sectionsToInsert.length > 0) {
      newSections = await tx
        .insert(templateSections)
        .values(sectionsToInsert)
        .returning();
    }

    return {
      ...newTemplate,
      sections: newSections,
    };
  });
}

// Section-specific operations

/**
 * Create a new section in a template.
 */
export async function createSection(
  section: TemplateSectionInsert
): Promise<TemplateSectionSelect> {
  const [inserted] = await db
    .insert(templateSections)
    .values(section)
    .returning();

  // Add to template's sectionOrder
  const [template] = await db
    .select({ sectionOrder: proposalTemplates.sectionOrder })
    .from(proposalTemplates)
    .where(eq(proposalTemplates.id, section.templateId))
    .limit(1);

  if (template) {
    const newOrder = [...(template.sectionOrder ?? []), inserted.id];
    await db
      .update(proposalTemplates)
      .set({ sectionOrder: newOrder, updatedAt: new Date() })
      .where(eq(proposalTemplates.id, section.templateId));
  }

  return inserted;
}

/**
 * Update a section.
 */
export async function updateSection(
  sectionId: string,
  updates: Partial<
    Omit<TemplateSectionInsert, "id" | "templateId" | "createdAt">
  >
): Promise<TemplateSectionSelect | undefined> {
  const [updated] = await db
    .update(templateSections)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(templateSections.id, sectionId))
    .returning();
  return updated;
}

/**
 * Delete a section from a template.
 */
export async function deleteSection(
  sectionId: string,
  templateId: string
): Promise<boolean> {
  // Remove from sectionOrder first
  const [template] = await db
    .select({ sectionOrder: proposalTemplates.sectionOrder })
    .from(proposalTemplates)
    .where(eq(proposalTemplates.id, templateId))
    .limit(1);

  if (template) {
    const newOrder = (template.sectionOrder ?? []).filter(
      (id) => id !== sectionId
    );
    await db
      .update(proposalTemplates)
      .set({ sectionOrder: newOrder, updatedAt: new Date() })
      .where(eq(proposalTemplates.id, templateId));
  }

  // Delete the section
  const result = await db
    .delete(templateSections)
    .where(
      and(
        eq(templateSections.id, sectionId),
        eq(templateSections.templateId, templateId)
      )
    )
    .returning();

  return result.length > 0;
}

/**
 * Get sections for a template.
 */
export async function getSectionsByTemplateId(
  templateId: string
): Promise<TemplateSectionSelect[]> {
  return await db
    .select()
    .from(templateSections)
    .where(eq(templateSections.templateId, templateId))
    .orderBy(asc(templateSections.position));
}

export const TemplateRepository = {
  findAllTemplates,
  findTemplateById,
  findDefaultTemplate,
  createTemplate,
  updateTemplate,
  updateSectionOrder,
  deleteTemplate,
  duplicateTemplate,
  createSection,
  updateSection,
  deleteSection,
  getSectionsByTemplateId,
};
