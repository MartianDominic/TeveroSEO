/**
 * Analytics Feature Module
 * Phase 96-01: GSC Analytics Infrastructure
 * Phase 96-02: Master Dashboard
 * Phase 96-03: Actionable Insights & Annotations
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

// Services (96-03)
export { TrendDetectionService, getTrendDetectionService, analyzePageTrends } from "./services/TrendDetectionService";
export { StrikingDistanceService, getStrikingDistanceService } from "./services/StrikingDistanceService";
export { AnnotationImportService, importGoogleUpdates } from "./services/AnnotationImportService";

// Repositories (96-01)
export { QueryAnalyticsRepository, createQueryAnalyticsRepository, getQueryAnalyticsRepository } from "./repositories/QueryAnalyticsRepository";

// Repositories (96-02)
export { SiteTagsRepository } from "./repositories/SiteTagsRepository";
export { ClientTagsRepository } from "./repositories/ClientTagsRepository";

// Repositories (96-03)
export { AnnotationsRepository } from "./repositories/AnnotationsRepository";

// Jobs
export { gscSyncQueue, scheduleGscSync } from "./jobs/gsc-sync.job";
export type { GscSyncJobData, GscSyncJobResult } from "./jobs/gsc-sync.job";
export { gscSyncWorker, startGscSyncWorker, stopGscSyncWorker } from "./jobs/gsc-sync.worker";

// Jobs (96-03)
export { annotationsImportQueue, scheduleAnnotationsImport, triggerAnnotationsImport } from "./jobs/annotations-import.job";
