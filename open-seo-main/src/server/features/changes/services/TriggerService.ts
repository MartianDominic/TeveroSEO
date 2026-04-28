/**
 * Trigger Service
 * Phase 33: Auto-Fix System
 *
 * Evaluates rollback triggers by checking traffic and ranking metrics.
 * Returns whether a trigger should fire and what scope to revert.
 */
import { db } from '@/db';
import { rollbackTriggers, type RollbackTriggerSelect } from '@/db/change-schema';
import { gscSnapshots } from '@/db/analytics-schema';
import { keywordRankings } from '@/db/ranking-schema';
import { savedKeywords, projects } from '@/db/app.schema';
import { clients } from '@/db/client-schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import type { RevertScope } from './RevertService';
import {
  TrafficDropConfigSchema,
  RankingDropConfigSchema,
  RollbackScopeSchema,
  parseJsonbConfig,
  type TrafficDropConfig,
  type RankingDropConfig,
} from '@/lib/db-validators';
import { extractNumber } from '@/lib/type-guards';

/**
 * Result of evaluating a single trigger.
 */
export interface TriggerEvaluationResult {
  triggerId: string;
  shouldFire: boolean;
  reason: string;
  metrics?: {
    current: number;
    baseline: number;
    change: number;
    changePercent: number;
  };
  scope?: RevertScope;
}

/**
 * Check for traffic drop based on GSC clicks.
 * Compares recent period (default 7 days) to baseline period (7 days before that).
 */
export async function checkTrafficDrop(
  clientId: string,
  config: TrafficDropConfig
): Promise<{
  shouldFire: boolean;
  reason: string;
  metrics: { current: number; baseline: number; change: number; changePercent: number };
}> {
  const threshold = config.threshold ?? 20;
  const minimumBaseline = config.minimumBaseline ?? 100;
  const periodDays = config.comparisonPeriod === '14d' ? 14 : config.comparisonPeriod === '30d' ? 30 : 7;

  const now = new Date();
  const recentStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const baselineEnd = new Date(recentStart.getTime() - 1);
  const baselineStart = new Date(baselineEnd.getTime() - periodDays * 24 * 60 * 60 * 1000);

  // Get recent clicks
  const [recentData] = await db
    .select({ totalClicks: sql<number>`COALESCE(SUM(${gscSnapshots.clicks}), 0)` })
    .from(gscSnapshots)
    .where(
      and(
        eq(gscSnapshots.clientId, clientId),
        gte(gscSnapshots.date, recentStart.toISOString().split('T')[0]),
        lte(gscSnapshots.date, now.toISOString().split('T')[0])
      )
    );

  // Get baseline clicks
  const [baselineData] = await db
    .select({ totalClicks: sql<number>`COALESCE(SUM(${gscSnapshots.clicks}), 0)` })
    .from(gscSnapshots)
    .where(
      and(
        eq(gscSnapshots.clientId, clientId),
        gte(gscSnapshots.date, baselineStart.toISOString().split('T')[0]),
        lte(gscSnapshots.date, baselineEnd.toISOString().split('T')[0])
      )
    );

  const current = recentData?.totalClicks ?? 0;
  const baseline = baselineData?.totalClicks ?? 0;
  const change = current - baseline;
  const changePercent = baseline > 0 ? (change / baseline) * 100 : 0;

  // Check if should fire
  if (baseline < minimumBaseline) {
    return {
      shouldFire: false,
      reason: `Baseline traffic (${baseline}) below minimum threshold (${minimumBaseline})`,
      metrics: { current, baseline, change, changePercent },
    };
  }

  if (changePercent <= -threshold) {
    return {
      shouldFire: true,
      reason: `Traffic dropped ${Math.abs(changePercent).toFixed(1)}% (threshold: ${threshold}%)`,
      metrics: { current, baseline, change, changePercent },
    };
  }

  return {
    shouldFire: false,
    reason: `Traffic change ${changePercent.toFixed(1)}% within threshold`,
    metrics: { current, baseline, change, changePercent },
  };
}

/**
 * Check for ranking drop based on keyword positions.
 * Compares latest position to position from comparison period ago.
 */
export async function checkRankingDrop(
  clientId: string,
  config: RankingDropConfig
): Promise<{
  shouldFire: boolean;
  reason: string;
  affectedKeywords: Array<{ keyword: string; oldPosition: number; newPosition: number; drop: number }>;
}> {
  const positionDrop = config.positionDrop ?? 5;
  const minimumKeywords = config.minimumKeywords ?? 3;
  const periodDays = config.comparisonPeriod === '14d' ? 14 : config.comparisonPeriod === '30d' ? 30 : 7;

  const now = new Date();
  const comparisonDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

  // Get client's workspace to find their projects
  const [client] = await db
    .select({ workspaceId: clients.workspaceId })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) {
    return {
      shouldFire: false,
      reason: `Client ${clientId} not found`,
      affectedKeywords: [],
    };
  }

  // Get latest rankings via client -> projects -> savedKeywords path
  const latestRankings = await db
    .select({
      keyword: savedKeywords.keyword,
      position: keywordRankings.position,
      keywordId: keywordRankings.keywordId,
    })
    .from(keywordRankings)
    .innerJoin(savedKeywords, eq(keywordRankings.keywordId, savedKeywords.id))
    .innerJoin(projects, eq(savedKeywords.projectId, projects.id))
    .where(
      and(
        eq(projects.organizationId, client.workspaceId),
        eq(
          keywordRankings.date,
          sql`(SELECT MAX(date) FROM keyword_rankings kr2 WHERE kr2.keyword_id = ${keywordRankings.keywordId})`
        )
      )
    );

  // Get comparison rankings
  const comparisonRankings = await db
    .select({
      keyword: savedKeywords.keyword,
      position: keywordRankings.position,
      keywordId: keywordRankings.keywordId,
    })
    .from(keywordRankings)
    .innerJoin(savedKeywords, eq(keywordRankings.keywordId, savedKeywords.id))
    .innerJoin(projects, eq(savedKeywords.projectId, projects.id))
    .where(
      and(
        eq(projects.organizationId, client.workspaceId),
        lte(keywordRankings.date, comparisonDate)
      )
    )
    .orderBy(desc(keywordRankings.date));

  // Build comparison map (first occurrence per keyword)
  const comparisonMap = new Map<string, number>();
  for (const ranking of comparisonRankings) {
    if (!comparisonMap.has(ranking.keyword)) {
      comparisonMap.set(ranking.keyword, ranking.position);
    }
  }

  // Find affected keywords
  const affectedKeywords: Array<{ keyword: string; oldPosition: number; newPosition: number; drop: number }> = [];

  for (const ranking of latestRankings) {
    // Filter by specific keywords if configured
    if (config.keywords !== 'all_tracked' && config.keywords && !config.keywords.includes(ranking.keyword)) {
      continue;
    }

    const oldPosition = comparisonMap.get(ranking.keyword);
    if (oldPosition === undefined) continue;

    const drop = ranking.position - oldPosition;
    if (drop >= positionDrop) {
      affectedKeywords.push({
        keyword: ranking.keyword,
        oldPosition,
        newPosition: ranking.position,
        drop,
      });
    }
  }

  if (affectedKeywords.length >= minimumKeywords) {
    return {
      shouldFire: true,
      reason: `${affectedKeywords.length} keywords dropped ${positionDrop}+ positions (threshold: ${minimumKeywords})`,
      affectedKeywords,
    };
  }

  return {
    shouldFire: false,
    reason: `Only ${affectedKeywords.length} keywords affected (threshold: ${minimumKeywords})`,
    affectedKeywords,
  };
}

/**
 * Evaluate a rollback trigger and determine if it should fire.
 */
export async function evaluateTrigger(
  trigger: RollbackTriggerSelect
): Promise<TriggerEvaluationResult> {
  const { id, clientId, triggerType, config, rollbackScope } = trigger;

  // Check cooldown using type-safe extraction
  if (trigger.lastTriggeredAt) {
    const cooldownHours = extractNumber(config, 'cooldownHours', 24);
    const cooldownExpiry = new Date(trigger.lastTriggeredAt.getTime() + cooldownHours * 60 * 60 * 1000);
    if (new Date() < cooldownExpiry) {
      return {
        triggerId: id,
        shouldFire: false,
        reason: `Trigger in cooldown until ${cooldownExpiry.toISOString()}`,
      };
    }
  }

  // Evaluate based on trigger type with validated config
  switch (triggerType) {
    case 'traffic_drop': {
      const validatedConfig = parseJsonbConfig(
        config,
        TrafficDropConfigSchema,
        { threshold: 20, comparisonPeriod: '7d' as const, minimumBaseline: 100, cooldownHours: 24 }
      );
      const result = await checkTrafficDrop(clientId, validatedConfig);
      return {
        triggerId: id,
        shouldFire: result.shouldFire,
        reason: result.reason,
        metrics: result.metrics,
        scope: result.shouldFire ? parseRollbackScope(rollbackScope, clientId) : undefined,
      };
    }

    case 'ranking_drop': {
      const validatedConfig = parseJsonbConfig(
        config,
        RankingDropConfigSchema,
        { positionDrop: 5, minimumKeywords: 3, comparisonPeriod: '7d' as const, cooldownHours: 24 }
      );
      const result = await checkRankingDrop(clientId, validatedConfig);
      return {
        triggerId: id,
        shouldFire: result.shouldFire,
        reason: result.reason,
        scope: result.shouldFire ? parseRollbackScope(rollbackScope, clientId) : undefined,
      };
    }

    case 'error_spike':
      // TODO: Implement error spike detection
      return {
        triggerId: id,
        shouldFire: false,
        reason: 'Error spike detection not yet implemented',
      };

    case 'manual':
      // Manual triggers don't auto-fire
      return {
        triggerId: id,
        shouldFire: false,
        reason: 'Manual trigger - requires explicit execution',
      };

    default:
      return {
        triggerId: id,
        shouldFire: false,
        reason: `Unknown trigger type: ${triggerType}`,
      };
  }
}

/**
 * Parse rollback scope from JSONB config to RevertScope type.
 * Uses Zod validation for type safety.
 */
function parseRollbackScope(scope: unknown, clientId: string): RevertScope {
  // Default scope for missing or invalid config
  const defaultScope = (): RevertScope => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return {
      type: 'date_range',
      from: weekAgo,
      to: new Date(),
      clientId,
    };
  };

  if (!scope) {
    return defaultScope();
  }

  // Try to parse with Zod schema
  const parsed = RollbackScopeSchema.safeParse(scope);
  if (!parsed.success) {
    console.warn('Invalid rollback scope config, using default:', parsed.error.issues);
    return defaultScope();
  }

  const validScope = parsed.data;

  switch (validScope.type) {
    case 'single':
      return { type: 'single', changeId: validScope.changeId };
    case 'resource':
      return { type: 'resource', resourceId: validScope.resourceId, clientId };
    case 'category':
      return { type: 'category', category: validScope.category, clientId };
    case 'batch':
      return { type: 'batch', batchId: validScope.batchId };
    case 'date_range':
      return {
        type: 'date_range',
        from: validScope.from,
        to: validScope.to,
        clientId,
      };
    case 'audit':
      return { type: 'audit', auditId: validScope.auditId };
    case 'full':
      return { type: 'full', clientId };
    default:
      return defaultScope();
  }
}

/**
 * Get all enabled triggers for a client.
 */
export async function getEnabledTriggers(clientId?: string): Promise<RollbackTriggerSelect[]> {
  const conditions = [eq(rollbackTriggers.isEnabled, true)];
  if (clientId) {
    conditions.push(eq(rollbackTriggers.clientId, clientId));
  }

  return db
    .select()
    .from(rollbackTriggers)
    .where(and(...conditions));
}

/**
 * Update trigger's last check and optionally last triggered timestamps.
 */
export async function updateTriggerTimestamps(
  triggerId: string,
  triggered: boolean
): Promise<void> {
  const now = new Date();
  const updates: { lastCheckAt: Date; lastTriggeredAt?: Date } = {
    lastCheckAt: now,
  };
  if (triggered) {
    updates.lastTriggeredAt = now;
  }

  await db
    .update(rollbackTriggers)
    .set(updates)
    .where(eq(rollbackTriggers.id, triggerId));
}

export const TriggerService = {
  checkTrafficDrop,
  checkRankingDrop,
  evaluateTrigger,
  getEnabledTriggers,
  updateTriggerTimestamps,
};
