import type {
  CreateProjectInput,
  DeleteProjectInput,
} from "@/types/schemas/projects";
import { ProjectRepository } from "@/server/features/projects/repositories/ProjectRepository";
import { AppError } from "@/server/lib/errors";

function mapProject(project: {
  id: string;
  name: string;
  domain: string | null;
  createdAt: Date;
}) {
  return {
    id: project.id,
    name: project.name,
    domain: project.domain,
    createdAt: project.createdAt.toISOString(),
  };
}

export async function listProjects(organizationId: string) {
  const rows = await ProjectRepository.listProjects(organizationId);
  return rows.map(mapProject);
}

/**
 * Create a new SEO project.
 *
 * H-ONBOARD-01 FIX: Added idempotencyKey support to prevent duplicate
 * projects when users retry after network errors.
 */
export async function createProject(
  organizationId: string,
  input: CreateProjectInput,
) {
  const id = await ProjectRepository.createProject(
    organizationId,
    input.name,
    input.domain,
    input.idempotencyKey, // H-ONBOARD-01: Pass through for deduplication
  );
  return { id };
}

export async function deleteProject(
  organizationId: string,
  input: DeleteProjectInput,
) {
  await ProjectRepository.deleteProject(input.projectId, organizationId);
  return { success: true };
}

export async function getOrCreateDefaultProject(organizationId: string) {
  // Use atomic upsert to prevent race condition creating duplicate "Default" projects
  const project = await ProjectRepository.getOrCreateDefaultProject(organizationId);
  return mapProject(project);
}

export async function getProject(projectId: string) {
  const project = await ProjectRepository.getProjectById(projectId);
  if (!project) {
    throw new AppError("NOT_FOUND");
  }

  return mapProject(project);
}

export async function getProjectForOrganization(
  organizationId: string,
  projectId: string,
) {
  const project = await ProjectRepository.getProjectForOrganization(
    projectId,
    organizationId,
  );
  if (!project) {
    throw new AppError("NOT_FOUND");
  }

  return mapProject(project);
}
