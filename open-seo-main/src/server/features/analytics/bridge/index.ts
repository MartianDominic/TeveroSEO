/**
 * Analytics-Audit Bridge Module
 * Phase 40: Cross-module integration between P92 audit checks and P96 analytics data
 *
 * This module provides audit-friendly access to analytics data for T4 architecture checks.
 */

// Service
export {
  AnalyticsAuditBridge,
  getAnalyticsAuditBridge,
  resetAnalyticsAuditBridge,
} from "./AnalyticsAuditBridge";

// Types
export * from "./types";
