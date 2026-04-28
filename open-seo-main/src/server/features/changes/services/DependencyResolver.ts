/**
 * Dependency Resolver
 * Phase 33: Auto-Fix System
 *
 * Detects dependencies between changes to prevent cascading issues on revert.
 * A change B depends on change A if B's beforeValue equals A's afterValue.
 */
import { db } from '@/db';
import { siteChanges, type SiteChangeSelect } from '@/db/change-schema';
import { and, eq, gt, desc, inArray } from 'drizzle-orm';

/**
 * Dependency graph node representing a change and its dependents.
 */
export interface DependencyNode {
  /** The change being analyzed */
  change: SiteChangeSelect;
  /** Changes that depend on this change's afterValue */
  dependents: DependencyNode[];
  /** Depth in the dependency tree (0 = root) */
  depth: number;
}

/**
 * Result of dependency detection for a single change.
 */
export interface DependencyResult {
  /** The change being analyzed */
  changeId: string;
  /** Whether this change has any dependents */
  hasDependents: boolean;
  /** Number of direct dependents */
  directDependentCount: number;
  /** Total number of dependents (including transitive) */
  totalDependentCount: number;
  /** All dependent change IDs (flat list) */
  dependentIds: string[];
  /** Full dependency tree (for detailed analysis) */
  dependencyTree: DependencyNode | null;
}

/**
 * Detect changes that depend on a given change.
 * A later change depends on this one if:
 * 1. Same resourceId and field
 * 2. Created after this change was applied
 * 3. beforeValue matches this change's afterValue
 */
export async function detectDependencies(
  changeId: string,
  maxDepth: number = 5
): Promise<DependencyResult> {
  // Get the source change
  const [change] = await db
    .select()
    .from(siteChanges)
    .where(eq(siteChanges.id, changeId))
    .limit(1);

  if (!change) {
    return {
      changeId,
      hasDependents: false,
      directDependentCount: 0,
      totalDependentCount: 0,
      dependentIds: [],
      dependencyTree: null,
    };
  }

  // Build dependency tree recursively
  const visited = new Set<string>();
  const tree = await buildDependencyNode(change, visited, 0, maxDepth);
  const dependentIds = collectDependentIds(tree);

  return {
    changeId,
    hasDependents: dependentIds.length > 0,
    directDependentCount: tree.dependents.length,
    totalDependentCount: dependentIds.length,
    dependentIds,
    dependencyTree: tree,
  };
}

/**
 * Build a dependency node for a change, recursively finding dependents.
 */
async function buildDependencyNode(
  change: SiteChangeSelect,
  visited: Set<string>,
  depth: number,
  maxDepth: number
): Promise<DependencyNode> {
  visited.add(change.id);

  const node: DependencyNode = {
    change,
    dependents: [],
    depth,
  };

  // Stop recursion at max depth
  if (depth >= maxDepth) {
    return node;
  }

  // Skip if no afterValue to depend on
  if (!change.afterValue || !change.appliedAt) {
    return node;
  }

  // Find changes that:
  // 1. Same resourceId and field
  // 2. Created after this change
  // 3. beforeValue matches afterValue
  const dependents = await db
    .select()
    .from(siteChanges)
    .where(
      and(
        eq(siteChanges.resourceId, change.resourceId),
        eq(siteChanges.field, change.field),
        gt(siteChanges.createdAt, change.appliedAt),
        eq(siteChanges.beforeValue, change.afterValue),
        eq(siteChanges.status, 'verified') // Only verified changes count
      )
    )
    .orderBy(siteChanges.createdAt);

  // Build child nodes for each dependent
  for (const dependent of dependents) {
    if (!visited.has(dependent.id)) {
      const childNode = await buildDependencyNode(dependent, visited, depth + 1, maxDepth);
      node.dependents.push(childNode);
    }
  }

  return node;
}

/**
 * Collect all dependent IDs from a dependency tree.
 */
function collectDependentIds(node: DependencyNode): string[] {
  const ids: string[] = [];

  for (const dependent of node.dependents) {
    ids.push(dependent.change.id);
    ids.push(...collectDependentIds(dependent));
  }

  return ids;
}

/**
 * Check if reverting a set of changes would create orphaned dependencies.
 * Returns changes that would have their beforeValue become invalid.
 */
export async function checkRevertSafety(
  changeIds: string[]
): Promise<{
  safe: boolean;
  orphanedChanges: SiteChangeSelect[];
  warnings: string[];
}> {
  if (changeIds.length === 0) {
    return { safe: true, orphanedChanges: [], warnings: [] };
  }

  // Get all changes being reverted
  const changes = await db
    .select()
    .from(siteChanges)
    .where(inArray(siteChanges.id, changeIds));

  const orphanedChanges: SiteChangeSelect[] = [];
  const warnings: string[] = [];

  // For each change, check if any non-reverted change depends on it
  for (const change of changes) {
    if (!change.afterValue) continue;

    const dependents = await db
      .select()
      .from(siteChanges)
      .where(
        and(
          eq(siteChanges.resourceId, change.resourceId),
          eq(siteChanges.field, change.field),
          gt(siteChanges.createdAt, change.createdAt),
          eq(siteChanges.beforeValue, change.afterValue),
          eq(siteChanges.status, 'verified')
        )
      );

    // Check if any dependent is NOT in the revert set
    for (const dependent of dependents) {
      if (!changeIds.includes(dependent.id)) {
        orphanedChanges.push(dependent);
        warnings.push(
          `Change ${dependent.id} depends on ${change.id} but is not being reverted`
        );
      }
    }
  }

  return {
    safe: orphanedChanges.length === 0,
    orphanedChanges,
    warnings,
  };
}

/**
 * Get the revert order for a set of changes.
 * Changes should be reverted in reverse chronological order.
 */
export async function getRevertOrder(changeIds: string[]): Promise<string[]> {
  if (changeIds.length === 0) return [];

  const changes = await db
    .select()
    .from(siteChanges)
    .where(inArray(siteChanges.id, changeIds))
    .orderBy(desc(siteChanges.createdAt));

  return changes.map((c) => c.id);
}

export const DependencyResolver = {
  detectDependencies,
  checkRevertSafety,
  getRevertOrder,
};
