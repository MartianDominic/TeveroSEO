import type { Redis } from 'ioredis';
import type { Pool } from 'pg';
// @ts-expect-error - cron may not be installed yet
import { CronJob } from 'cron';
import { gzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);

import { retentionLogger } from '../logging';

export interface RetentionPolicy {
  target: 'cache' | 'logs' | 'metrics' | 'domain_learning';
  retention: number;
  action: 'delete' | 'archive' | 'compress';
  schedule: string;
}

export interface RetentionStats {
  cache: { sizeMb: number; retentionDays: number };
  logs: { sizeMb: number; retentionDays: number };
  metrics: { sizeMb: number; retentionDays: number };
  domainLearning: { count: number; retentionDays: number };
}

export interface R2Client {
  list(params: { prefix: string; maxKeys: number }): Promise<{ objects: Array<{ key: string; uploaded: Date }> }>;
  delete(key: string): Promise<void>;
  put(key: string, body: Buffer): Promise<void>;
}

export interface RetentionManagerConfig {
  redis: Redis;
  pg: Pool;
  r2?: R2Client;
  policies?: RetentionPolicy[];
  logger?: {
    info(message: string, meta?: any): void;
    error(message: string, meta?: any): void;
  };
}

const DEFAULT_POLICIES: RetentionPolicy[] = [
  // Cache retention
  {
    target: 'cache',
    retention: 30,
    action: 'delete',
    schedule: '0 3 * * *',
  },

  // Log retention
  {
    target: 'logs',
    retention: 90,
    action: 'archive',
    schedule: '0 4 * * 0',
  },

  // Metrics retention
  {
    target: 'metrics',
    retention: 365,
    action: 'compress',
    schedule: '0 5 1 * *',
  },

  // Domain learning retention
  {
    target: 'domain_learning',
    retention: 180,
    action: 'delete',
    schedule: '0 2 * * *',
  },
];

export class RetentionManager {
  private jobs: Map<string, CronJob> = new Map();
  private _redis: Redis;
  private pg: Pool;
  private r2?: R2Client;
  private policies: RetentionPolicy[];
  private logger: {
    info(message: string, meta?: any): void;
    error(message: string, meta?: any): void;
  };

  constructor(config: RetentionManagerConfig) {
    this._redis = config.redis;
    this.pg = config.pg;
    this.r2 = config.r2;
    this.policies = config.policies || DEFAULT_POLICIES;
    this.logger = config.logger || {
      info: (msg, meta) => retentionLogger.info(meta, msg),
      error: (msg, meta) => retentionLogger.error(meta, msg),
    };
  }

  async start(): Promise<void> {
    for (const policy of this.policies) {
      const job = new CronJob(
        policy.schedule,
        () => this.executePolicy(policy),
        null,
        true,
        'UTC'
      );
      this.jobs.set(policy.target, job);
    }
  }

  async stop(): Promise<void> {
    for (const job of this.jobs.values()) {
      job.stop();
    }
    this.jobs.clear();
  }

  async executePolicy(policy: RetentionPolicy): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - policy.retention);

    this.logger.info(`Executing retention policy for ${policy.target}`, {
      cutoff: cutoff.toISOString(),
      action: policy.action,
    });

    try {
      switch (policy.target) {
        case 'cache':
          await this.cleanCache(cutoff, policy.action);
          break;
        case 'logs':
          await this.cleanLogs(cutoff, policy.action);
          break;
        case 'metrics':
          await this.cleanMetrics(cutoff, policy.action);
          break;
        case 'domain_learning':
          await this.cleanDomainLearning(cutoff, policy.action);
          break;
      }
    } catch (error) {
      this.logger.error(`Failed to execute retention policy for ${policy.target}`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async cleanCache(cutoff: Date, action: string): Promise<void> {
    // L3 PostgreSQL cache
    const result = await this.pg.query(
      `
      DELETE FROM scraping_cache
      WHERE created_at < $1
      RETURNING id
    `,
      [cutoff]
    );

    this.logger.info(`Deleted ${result.rowCount} expired cache entries`);

    // L4 R2 archive - list and delete old objects
    if (action === 'delete' && this.r2) {
      const objects = await this.r2.list({
        prefix: 'cache/',
        maxKeys: 1000,
      });

      const oldObjects = objects.objects.filter((obj) => obj.uploaded < cutoff);

      for (const obj of oldObjects) {
        await this.r2.delete(obj.key);
      }

      this.logger.info(`Deleted ${oldObjects.length} old R2 objects`);
    }
  }

  private async cleanLogs(cutoff: Date, action: string): Promise<void> {
    if (action === 'archive' && this.r2) {
      // Compress and move to archive
      const logs = await this.pg.query(
        `
        SELECT * FROM scraping_logs
        WHERE timestamp < $1
        ORDER BY timestamp
      `,
        [cutoff]
      );

      if (logs.rowCount && logs.rowCount > 0) {
        const compressed = await gzipAsync(JSON.stringify(logs.rows));
        const archiveKey = `logs/archive-${cutoff.toISOString().split('T')[0]}.json.gz`;

        await this.r2.put(archiveKey, compressed);

        await this.pg.query(
          `
          DELETE FROM scraping_logs
          WHERE timestamp < $1
        `,
          [cutoff]
        );

        this.logger.info(`Archived ${logs.rowCount} log entries to ${archiveKey}`);
      }
    }
  }

  private async cleanMetrics(cutoff: Date, action: string): Promise<void> {
    if (action === 'compress') {
      // Aggregate old metrics into daily summaries
      await this.pg.query(
        `
        INSERT INTO scraping_metrics_daily (date, metrics)
        SELECT
          DATE(timestamp) as date,
          jsonb_build_object(
            'requests', SUM((metrics->>'requests')::int),
            'errors', SUM((metrics->>'errors')::int),
            'cost', SUM((metrics->>'cost')::numeric),
            'cache_hits', SUM((metrics->>'cache_hits')::int)
          ) as metrics
        FROM scraping_metrics_hourly
        WHERE timestamp < $1
        GROUP BY DATE(timestamp)
        ON CONFLICT (date) DO UPDATE SET
          metrics = scraping_metrics_daily.metrics || EXCLUDED.metrics
      `,
        [cutoff]
      );

      // Delete compressed hourly data
      const result = await this.pg.query(
        `
        DELETE FROM scraping_metrics_hourly
        WHERE timestamp < $1
      `,
        [cutoff]
      );

      this.logger.info(`Compressed ${result.rowCount} metric entries`);
    }
  }

  private async cleanDomainLearning(cutoff: Date, _action: string): Promise<void> {
    // Remove domain mappings not accessed recently
    const result = await this.pg.query(
      `
      DELETE FROM domain_tier_mappings
      WHERE last_accessed < $1
      RETURNING domain
    `,
      [cutoff]
    );

    this.logger.info(`Removed ${result.rowCount} stale domain mappings`);
  }

  async getStats(): Promise<RetentionStats> {
    const [cacheSize, logSize, metricsSize, domainCount] = await Promise.all([
      this.pg.query("SELECT pg_total_relation_size('scraping_cache') as size"),
      this.pg.query("SELECT pg_total_relation_size('scraping_logs') as size"),
      this.pg.query("SELECT pg_total_relation_size('scraping_metrics_hourly') as size"),
      this.pg.query('SELECT COUNT(*) FROM domain_tier_mappings'),
    ]);

    return {
      cache: {
        sizeMb: Math.round(cacheSize.rows[0].size / 1024 / 1024),
        retentionDays: this.getPolicyRetention('cache'),
      },
      logs: {
        sizeMb: Math.round(logSize.rows[0].size / 1024 / 1024),
        retentionDays: this.getPolicyRetention('logs'),
      },
      metrics: {
        sizeMb: Math.round(metricsSize.rows[0].size / 1024 / 1024),
        retentionDays: this.getPolicyRetention('metrics'),
      },
      domainLearning: {
        count: parseInt(domainCount.rows[0].count),
        retentionDays: this.getPolicyRetention('domain_learning'),
      },
    };
  }

  private getPolicyRetention(target: string): number {
    const policy = this.policies.find((p) => p.target === target);
    return policy?.retention || 0;
  }
}
