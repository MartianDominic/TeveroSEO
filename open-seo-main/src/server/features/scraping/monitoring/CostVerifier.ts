import type { DfsCostTracker } from '../providers/DfsCostTracker';
import type { Pool } from 'pg';

export interface CostVerificationReport {
  period: { start: Date; end: Date };
  tracked: {
    totalCost: number;
    byTier: Record<string, number>;
    byConsumer: Record<string, number>;
    totalRequests: number;
  };
  actual: {
    dataForSeo: number;
    webshare: number;
    geonode: number;
  };
  discrepancy: {
    absolute: number;
    percentage: number;
    withinTolerance: boolean;
  };
  savings: {
    vsLegacy: number;
    percentage: number;
  };
}

export interface ProviderUsageClient {
  getUsage(start: Date, end: Date): Promise<{ cost: number }>;
}

export interface CostVerifierConfig {
  costTracker: DfsCostTracker;
  dfsClient: ProviderUsageClient;
  webshareClient: ProviderUsageClient;
  geonodeClient: ProviderUsageClient;
  pg: Pool;
  alertManager?: {
    fire(alert: { name: string; severity: string; message: string }): void;
  };
  logger?: {
    info(message: string, meta?: any): void;
    error(message: string, meta?: any): void;
  };
}

export class CostVerifier {
  private costTracker: DfsCostTracker;
  private dfsClient: ProviderUsageClient;
  private webshareClient: ProviderUsageClient;
  private geonodeClient: ProviderUsageClient;
  private pg: Pool;
  private alertManager?: {
    fire(alert: { name: string; severity: string; message: string }): void;
  };
  private logger: {
    info(message: string, meta?: any): void;
    error(message: string, meta?: any): void;
  };

  constructor(config: CostVerifierConfig) {
    this.costTracker = config.costTracker;
    this.dfsClient = config.dfsClient;
    this.webshareClient = config.webshareClient;
    this.geonodeClient = config.geonodeClient;
    this.pg = config.pg;
    this.alertManager = config.alertManager;
    this.logger = config.logger || {
      info: (msg, meta) => console.log(msg, meta),
      error: (msg, meta) => console.error(msg, meta),
    };
  }

  async generateReport(start: Date, end: Date): Promise<CostVerificationReport> {
    // Get tracked costs from our system
    const tracked = await this.costTracker.getReport({ start, end });

    // Get actual costs from provider APIs
    const [dfsActual, webshareActual, geonodeActual] = await Promise.all([
      this.dfsClient.getUsage(start, end).catch(() => ({ cost: 0 })),
      this.webshareClient.getUsage(start, end).catch(() => ({ cost: 0 })),
      this.geonodeClient.getUsage(start, end).catch(() => ({ cost: 0 })),
    ]);

    const actual = {
      dataForSeo: dfsActual.cost,
      webshare: webshareActual.cost,
      geonode: geonodeActual.cost,
    };

    const actualTotal = Object.values(actual).reduce((a, b) => a + b, 0);
    const discrepancy = Math.abs(tracked.totalCost - actualTotal);
    const discrepancyPct =
      tracked.totalCost > 0 ? (discrepancy / tracked.totalCost) * 100 : 0;

    // Calculate savings vs legacy system
    // Legacy: DataForSEO for everything @ $0.02/page
    const legacyCost = tracked.totalRequests * 0.02;
    const savings = legacyCost - tracked.totalCost;
    const savingsPct = legacyCost > 0 ? (savings / legacyCost) * 100 : 0;

    return {
      period: { start, end },
      tracked: {
        totalCost: tracked.totalCost,
        byTier: tracked.costByTier || {},
        byConsumer: tracked.costByConsumer || {},
        totalRequests: tracked.totalRequests,
      },
      actual,
      discrepancy: {
        absolute: discrepancy,
        percentage: discrepancyPct,
        withinTolerance: discrepancyPct <= 5,
      },
      savings: {
        vsLegacy: savings,
        percentage: savingsPct,
      },
    };
  }

  async verifyDailyReports(): Promise<void> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      const report = await this.generateReport(yesterday, today);

      if (!report.discrepancy.withinTolerance && this.alertManager) {
        const actualTotal = Object.values(report.actual).reduce((a, b) => a + b, 0);
        this.alertManager.fire({
          name: 'cost-tracking-discrepancy',
          severity: 'warning',
          message: `Cost tracking discrepancy: ${report.discrepancy.percentage.toFixed(
            1
          )}% (tracked: $${report.tracked.totalCost.toFixed(
            2
          )}, actual: $${actualTotal.toFixed(2)})`,
        });
      }

      // Log savings for visibility
      this.logger.info('Daily cost verification', {
        trackedCost: report.tracked.totalCost,
        actualCost: Object.values(report.actual).reduce((a, b) => a + b, 0),
        discrepancy: report.discrepancy,
        savings: report.savings,
      });

      // Store for historical analysis
      await this.storeReport(report);
    } catch (error) {
      this.logger.error('Failed to verify daily costs', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async storeReport(report: CostVerificationReport): Promise<void> {
    await this.pg.query(
      `
      INSERT INTO cost_verification_reports (
        date,
        tracked_cost,
        actual_cost,
        discrepancy_pct,
        savings_pct,
        report_data
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (date) DO UPDATE SET
        tracked_cost = EXCLUDED.tracked_cost,
        actual_cost = EXCLUDED.actual_cost,
        discrepancy_pct = EXCLUDED.discrepancy_pct,
        savings_pct = EXCLUDED.savings_pct,
        report_data = EXCLUDED.report_data
    `,
      [
        report.period.start,
        report.tracked.totalCost,
        Object.values(report.actual).reduce((a, b) => a + b, 0),
        report.discrepancy.percentage,
        report.savings.percentage,
        JSON.stringify(report),
      ]
    );
  }

  async getHistoricalReports(days: number = 30): Promise<CostVerificationReport[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const result = await this.pg.query(
      `
      SELECT report_data
      FROM cost_verification_reports
      WHERE date >= $1
      ORDER BY date DESC
    `,
      [cutoff]
    );

    return result.rows.map((row) => row.report_data);
  }
}
