/**
 * DealOutcomeRepository - Repository for deal outcome data access
 * Phase 62-08: Win/Loss Analytics and Final Phase Completion
 *
 * Provides:
 * - findByWorkspace: Fetch deal outcomes for a workspace with optional date range
 * - countByOutcome: Count wins and losses
 * - groupByLossReason: Aggregate losses by reason
 * - getTopCompetitors: Get competitor names by frequency
 * - getAvgCycleDays: Calculate average deal cycle duration
 * - create: Create a new deal outcome
 */
import { eq, sql, and, gte, lte, isNotNull, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  db,
  dealOutcomes,
  type DealOutcomeSelect,
  type DealOutcomeInsert,
} from "@/db";

// Type for the Drizzle database client
type DrizzleClient = typeof db;

/**
 * Date range filter for queries.
 */
export interface DateRange {
  from: Date;
  to: Date;
}

/**
 * Win/loss count result.
 */
export interface OutcomeCounts {
  won: number;
  lost: number;
}

/**
 * Loss reason distribution item.
 */
export interface LossReasonCount {
  reason: string;
  count: number;
}

/**
 * Competitor frequency item.
 */
export interface CompetitorCount {
  name: string;
  count: number;
}

/**
 * DealOutcomeRepository interface for dependency injection.
 */
export interface DealOutcomeRepositoryInterface {
  findByWorkspace(
    workspaceId: string,
    dateRange?: DateRange
  ): Promise<DealOutcomeSelect[]>;
  countByOutcome(
    workspaceId: string,
    dateRange?: DateRange
  ): Promise<OutcomeCounts>;
  groupByLossReason(workspaceId: string): Promise<LossReasonCount[]>;
  getTopCompetitors(workspaceId: string, limit?: number): Promise<CompetitorCount[]>;
  getAvgCycleDays(workspaceId: string, dateRange?: DateRange): Promise<number>;
  create(data: Omit<DealOutcomeInsert, "id">): Promise<DealOutcomeSelect>;
}

/**
 * DealOutcomeRepository implementation.
 */
export class DealOutcomeRepository implements DealOutcomeRepositoryInterface {
  constructor(private readonly dbClient: DrizzleClient = db) {}

  /**
   * Fetch all deal outcomes for a workspace with optional date range.
   */
  async findByWorkspace(
    workspaceId: string,
    dateRange?: DateRange
  ): Promise<DealOutcomeSelect[]> {
    const conditions = [eq(dealOutcomes.workspaceId, workspaceId)];

    if (dateRange) {
      conditions.push(
        gte(dealOutcomes.outcomeAt, dateRange.from),
        lte(dealOutcomes.outcomeAt, dateRange.to)
      );
    }

    const result = await this.dbClient
      .select()
      .from(dealOutcomes)
      .where(and(...conditions))
      .orderBy(desc(dealOutcomes.outcomeAt));

    return result;
  }

  /**
   * Count wins and losses for a workspace.
   */
  async countByOutcome(
    workspaceId: string,
    dateRange?: DateRange
  ): Promise<OutcomeCounts> {
    const conditions = [eq(dealOutcomes.workspaceId, workspaceId)];

    if (dateRange) {
      conditions.push(
        gte(dealOutcomes.outcomeAt, dateRange.from),
        lte(dealOutcomes.outcomeAt, dateRange.to)
      );
    }

    const result = await this.dbClient
      .select({
        won: sql<number>`COUNT(*) FILTER (WHERE ${dealOutcomes.outcome} = 'won')::int`,
        lost: sql<number>`COUNT(*) FILTER (WHERE ${dealOutcomes.outcome} = 'lost')::int`,
      })
      .from(dealOutcomes)
      .where(and(...conditions));

    return {
      won: result[0]?.won ?? 0,
      lost: result[0]?.lost ?? 0,
    };
  }

  /**
   * Group lost deals by loss reason.
   */
  async groupByLossReason(workspaceId: string): Promise<LossReasonCount[]> {
    const result = await this.dbClient
      .select({
        reason: dealOutcomes.lossReason,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(dealOutcomes)
      .where(
        and(
          eq(dealOutcomes.workspaceId, workspaceId),
          eq(dealOutcomes.outcome, "lost"),
          isNotNull(dealOutcomes.lossReason)
        )
      )
      .groupBy(dealOutcomes.lossReason)
      .orderBy(desc(sql`COUNT(*)`));

    return result.map((row) => ({
      reason: row.reason ?? "unknown",
      count: row.count,
    }));
  }

  /**
   * Get top competitors by frequency of lost deals.
   */
  async getTopCompetitors(
    workspaceId: string,
    limit: number = 5
  ): Promise<CompetitorCount[]> {
    const result = await this.dbClient
      .select({
        name: dealOutcomes.competitorName,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(dealOutcomes)
      .where(
        and(
          eq(dealOutcomes.workspaceId, workspaceId),
          eq(dealOutcomes.outcome, "lost"),
          isNotNull(dealOutcomes.competitorName)
        )
      )
      .groupBy(dealOutcomes.competitorName)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(limit);

    return result.map((row) => ({
      name: row.name ?? "Unknown",
      count: row.count,
    }));
  }

  /**
   * Calculate average cycle days for won deals.
   */
  async getAvgCycleDays(
    workspaceId: string,
    dateRange?: DateRange
  ): Promise<number> {
    const conditions = [
      eq(dealOutcomes.workspaceId, workspaceId),
      eq(dealOutcomes.outcome, "won"),
      isNotNull(dealOutcomes.cycleDays),
    ];

    if (dateRange) {
      conditions.push(
        gte(dealOutcomes.outcomeAt, dateRange.from),
        lte(dealOutcomes.outcomeAt, dateRange.to)
      );
    }

    const result = await this.dbClient
      .select({
        avgDays: sql<number>`COALESCE(AVG(${dealOutcomes.cycleDays}), 0)::int`,
      })
      .from(dealOutcomes)
      .where(and(...conditions));

    return result[0]?.avgDays ?? 0;
  }

  /**
   * Create a new deal outcome record.
   */
  async create(
    data: Omit<DealOutcomeInsert, "id">
  ): Promise<DealOutcomeSelect> {
    const id = nanoid();

    const result = await this.dbClient
      .insert(dealOutcomes)
      .values({ ...data, id })
      .returning();

    return result[0];
  }
}

// Singleton instance
let repositoryInstance: DealOutcomeRepository | null = null;

/**
 * Get the singleton repository instance.
 */
export function getDealOutcomeRepository(): DealOutcomeRepository {
  if (!repositoryInstance) {
    repositoryInstance = new DealOutcomeRepository();
  }
  return repositoryInstance;
}
