/**
 * Analytics Feature Module
 * Phase 96-01: GSC Analytics Infrastructure
 *
 * Barrel export for all analytics components.
 */

// Types
export * from "./types";
export { DIMENSION_COMBINATIONS } from "./types";

// Services
export { GscPaginationService, createGscPaginationService, getGscPaginationService } from "./services/GscPaginationService";
export { GscFullSyncService, createGscFullSyncService, getGscFullSyncService } from "./services/GscFullSyncService";
export type { SyncSummary } from "./services/GscFullSyncService";

// Repositories
export { QueryAnalyticsRepository, createQueryAnalyticsRepository, getQueryAnalyticsRepository } from "./repositories/QueryAnalyticsRepository";

// Jobs
export { gscSyncQueue, scheduleGscSync } from "./jobs/gsc-sync.job";
export type { GscSyncJobData, GscSyncJobResult } from "./jobs/gsc-sync.job";
export { gscSyncWorker, startGscSyncWorker, stopGscSyncWorker } from "./jobs/gsc-sync.worker";
