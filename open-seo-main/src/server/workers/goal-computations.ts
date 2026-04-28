/**
 * Goal computation methods for different goal types.
 * Phase 22: Goal-Based Metrics System
 */
import { db } from "@/db";
import { gscSnapshots } from "@/db/analytics-schema";
import { keywordRankings } from "@/db/ranking-schema";
import { savedKeywords, projects } from "@/db/app.schema";
import { sql, eq, and, gte } from "drizzle-orm";
import type { ClientGoalSelect, GoalTemplateSelect } from "@/db/goals-schema";

export interface ComputationResult {
  currentValue: number;
  error?: string;
}

type ComputationMethod = (
  clientId: string,
  goal: ClientGoalSelect & { template: GoalTemplateSelect },
) => Promise<ComputationResult>;

/**
 * Count keywords in a position range (top 10, top 3, or #1)
 */
async function countKeywordsInRange(
  clientId: string,
  goal: ClientGoalSelect & { template: GoalTemplateSelect },
): Promise<ComputationResult> {
  const positionMax =
    goal.template.goalType === "keywords_top_10"
      ? 10
      : goal.template.goalType === "keywords_top_3"
        ? 3
        : 1;

  // Query keywords tracked for this client's projects that are in the target position range
  const result = await db.execute(sql`
    SELECT COUNT(DISTINCT kr.keyword_id) as count
    FROM ${keywordRankings} kr
    JOIN ${savedKeywords} sk ON kr.keyword_id = sk.id
    JOIN ${projects} p ON sk.project_id = p.id
    WHERE p.organization_id = ${clientId}
    AND kr.position <= ${positionMax}
    AND kr.date = (
      SELECT MAX(date) FROM ${keywordRankings} sub
      WHERE sub.keyword_id = kr.keyword_id
    )
  `);

  return { currentValue: Number(result.rows[0]?.count ?? 0) };
}

/**
 * Sum clicks over a period (7 days for weekly, 30 days for monthly)
 */
async function sumClicksPeriod(
  clientId: string,
  goal: ClientGoalSelect & { template: GoalTemplateSelect },
): Promise<ComputationResult> {
  const days = goal.template.goalType === "weekly_clicks" ? 7 : 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const result = await db
    .select({ total: sql<number>`COALESCE(SUM(${gscSnapshots.clicks}), 0)` })
    .from(gscSnapshots)
    .where(
      and(
        eq(gscSnapshots.clientId, clientId),
        gte(gscSnapshots.date, startDate.toISOString().split("T")[0]),
      ),
    );

  return { currentValue: Number(result[0]?.total ?? 0) };
}

/**
 * Sum impressions over 30 days
 */
async function sumImpressionsPeriod(
  clientId: string,
  _goal: ClientGoalSelect & { template: GoalTemplateSelect },
): Promise<ComputationResult> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  const result = await db
    .select({
      total: sql<number>`COALESCE(SUM(${gscSnapshots.impressions}), 0)`,
    })
    .from(gscSnapshots)
    .where(
      and(
        eq(gscSnapshots.clientId, clientId),
        gte(gscSnapshots.date, startDate.toISOString().split("T")[0]),
      ),
    );

  return { currentValue: Number(result[0]?.total ?? 0) };
}

/**
 * Average CTR over 30 days (returns percentage)
 */
async function avgCtrPeriod(
  clientId: string,
  _goal: ClientGoalSelect & { template: GoalTemplateSelect },
): Promise<ComputationResult> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  const result = await db
    .select({
      avgCtr: sql<number>`COALESCE(AVG(${gscSnapshots.ctr}) * 100, 0)`,
    })
    .from(gscSnapshots)
    .where(
      and(
        eq(gscSnapshots.clientId, clientId),
        gte(gscSnapshots.date, startDate.toISOString().split("T")[0]),
      ),
    );

  return { currentValue: Number(result[0]?.avgCtr ?? 0) };
}

/**
 * Month-over-month growth percentage
 */
async function momGrowthPct(
  clientId: string,
  _goal: ClientGoalSelect & { template: GoalTemplateSelect },
): Promise<ComputationResult> {
  const result = await db.execute(sql`
    WITH monthly AS (
      SELECT
        SUM(CASE WHEN date >= CURRENT_DATE - INTERVAL '30 days' THEN clicks ELSE 0 END) as this_month,
        SUM(CASE WHEN date >= CURRENT_DATE - INTERVAL '60 days'
                  AND date < CURRENT_DATE - INTERVAL '30 days' THEN clicks ELSE 0 END) as last_month
      FROM ${gscSnapshots}
      WHERE client_id = ${clientId}
        AND date >= CURRENT_DATE - INTERVAL '60 days'
    )
    SELECT
      CASE
        WHEN last_month = 0 THEN 0
        ELSE ((this_month - last_month)::float / NULLIF(last_month, 0) * 100)
      END as growth_pct
    FROM monthly
  `);

  return { currentValue: Number(result.rows[0]?.growth_pct ?? 0) };
}

/**
 * Manual goals don't auto-compute - preserve current value
 */
async function manual(
  _clientId: string,
  goal: ClientGoalSelect & { template: GoalTemplateSelect },
): Promise<ComputationResult> {
  return { currentValue: Number(goal.currentValue ?? 0) };
}

export const computationMethods: Record<string, ComputationMethod> = {
  count_keywords_in_range: countKeywordsInRange,
  sum_clicks_period: sumClicksPeriod,
  sum_impressions_period: sumImpressionsPeriod,
  avg_ctr_period: avgCtrPeriod,
  mom_growth_pct: momGrowthPct,
  manual,
};
