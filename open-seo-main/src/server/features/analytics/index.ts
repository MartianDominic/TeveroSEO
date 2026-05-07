/**
 * Analytics Feature Module
 * Phase 96-01: GSC Analytics Infrastructure
 * Phase 96-02: Master Dashboard
 *
 * Barrel export for all analytics components.
 */

// Types
export * from "./types";
export { DIMENSION_COMBINATIONS } from "./types";

// Services (96-01)
export { GscPaginationService, createGscPaginationService, getGscPaginationService } from "./services/GscPaginationService";
export { GscFullSyncService, createGscFullSyncService, getGscFullSyncService } from "./services/GscFullSyncService";
export type { SyncSummary } from "./services/GscFullSyncService";

// Services (96-02)
export { MasterDashboardService, getMasterDashboardService } from "./services/MasterDashboardService";

// Repositories (96-01)
export { QueryAnalyticsRepository, createQueryAnalyticsRepository, getQueryAnalyticsRepository } from "./repositories/QueryAnalyticsRepository";

// Repositories (96-02)
export { SiteTagsRepository } from "./repositories/SiteTagsRepository";
export { ClientTagsRepository } from "./repositories/ClientTagsRepository";

// Jobs
export { gscSyncQueue, scheduleGscSync } from "./jobs/gsc-sync.job";
export type { GscSyncJobData, GscSyncJobResult } from "./jobs/gsc-sync.job";
export { gscSyncWorker, startGscSyncWorker, stopGscSyncWorker } from "./jobs/gsc-sync.worker";
