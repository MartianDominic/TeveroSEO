import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { AppError } from "@/server/lib/errors";

async function listProjects(
  organizationId: string,
  options: { limit?: number; offset?: number } = {}
) {
  const { limit = 100, offset = 0 } = options;
  return db.query.projects.findMany({
    where: and(
      eq(projects.organizationId, organizationId),
      eq(projects.isDeleted, false),
    ),
    orderBy: desc(projects.createdAt),
    limit,
    offset,
  });
}

async function getProjectForOrganization(
  projectId: string,
  organizationId: string,
) {
  return db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.organizationId, organizationId),
      eq(projects.isDeleted, false),
    ),
  });
}

async function getProjectById(projectId: string) {
  return db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.isDeleted, false),
    ),
  });
}

async function createProject(
  organizationId: string,
  name: string,
  domain?: string,
) {
  const id = crypto.randomUUID();
  await db.insert(projects).values({
    id,
    organizationId,
    name,
    domain,
  });
  return id;
}

/**
 * Soft delete a project by setting isDeleted=true and deletedAt=now().
 * Preserves all audit history, keyword research, and content briefs.
 */
async function deleteProject(projectId: string, organizationId: string) {
  const project = await getProjectForOrganization(projectId, organizationId);
  if (!project) {
    throw new AppError("NOT_FOUND");
  }

  await db
    .update(projects)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
    })
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.organizationId, organizationId),
      ),
    );
}

/**
 * Permanently delete a project and all associated data.
 * Use with caution - this cannot be undone.
 */
async function hardDeleteProject(projectId: string, organizationId: string) {
  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.organizationId, organizationId),
    ),
  });
  if (!project) {
    throw new AppError("NOT_FOUND");
  }

  await db
    .delete(projects)
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.organizationId, organizationId),
      ),
    );
}

/**
 * Restore a soft-deleted project.
 */
async function restoreProject(projectId: string, organizationId: string) {
  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.organizationId, organizationId),
      eq(projects.isDeleted, true),
    ),
  });
  if (!project) {
    throw new AppError("NOT_FOUND");
  }

  await db
    .update(projects)
    .set({
      isDeleted: false,
      deletedAt: null,
    })
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.organizationId, organizationId),
      ),
    );
}

/**
 * List soft-deleted projects for potential restoration.
 * Phase 69-03: Added default limit to prevent unbounded queries.
 */
async function listDeletedProjects(
  organizationId: string,
  options: { limit?: number; offset?: number } = {}
) {
  const { limit = 100, offset = 0 } = options;
  return db.query.projects.findMany({
    where: and(
      eq(projects.organizationId, organizationId),
      eq(projects.isDeleted, true),
    ),
    orderBy: desc(projects.deletedAt),
    limit,
    offset,
  });
}

/**
 * Atomically get or create the default project for an organization.
 * Uses INSERT ON CONFLICT to prevent race conditions creating duplicates.
 *
 * Note: This relies on the unique constraint on (organization_id, name) in the database.
 * If the constraint doesn't exist, add it via migration:
 * CREATE UNIQUE INDEX IF NOT EXISTS uq_projects_org_name ON projects(organization_id, name);
 */
async function getOrCreateDefaultProject(organizationId: string) {
  const id = crypto.randomUUID();
  const now = new Date();

  // Atomic upsert: INSERT ON CONFLICT DO NOTHING, then SELECT
  // This prevents race conditions where two concurrent requests could both
  // pass the "check if exists" step and create duplicate Default projects
  await db
    .insert(projects)
    .values({
      id,
      organizationId,
      name: "Default",
      domain: null,
      createdAt: now,
    })
    .onConflictDoNothing({
      // Target the unique constraint on (organizationId, name)
      target: [projects.organizationId, projects.name],
    });

  // Fetch the project (either just inserted or already existed)
  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.organizationId, organizationId),
      eq(projects.name, "Default"),
    ),
  });

  if (!project) {
    // Should never happen, but handle gracefully
    throw new AppError("INTERNAL_ERROR", "Failed to create default project");
  }

  return project;
}

export const ProjectRepository = {
  listProjects,
  listDeletedProjects,
  getProjectForOrganization,
  getProjectById,
  createProject,
  deleteProject,
  hardDeleteProject,
  restoreProject,
  getOrCreateDefaultProject,
} as const;
