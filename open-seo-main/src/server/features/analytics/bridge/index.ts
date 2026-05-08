/**
 * Analytics-Audit Bridge Module
 * Phase 40: Cross-module integration between P92 audit checks and P96 analytics data
 *
 * This module provides audit-friendly access to analytics data for T4 architecture checks.
 *
 * OPS-004/005/006 FIX: Enhanced with caching, fallback strategies, and position history.
 */

// Service
export {
  AnalyticsAuditBridge,
  getAnalyticsAuditBridge,
  resetAnalyticsAuditBridge,
} from "./AnalyticsAuditBridge";

// Types (including new OPS-004/005/006 types)
export * from "./types";
