// schema.ts - Barrel export for all database schemas

// Core application schemas
export * from "./app.schema";
export * from "./client-schema";
export * from "./user-schema";

// Connection and integration schemas
export * from "./connection-schema";
export * from "./analytics-schema";

// Report and schedule schemas
export * from "./report-schema";
export * from "./schedule-schema";

// Branding and voice schemas
export * from "./branding-schema";
export * from "./voice-schema";

// Mapping and change schemas
export * from "./mapping-schema";
export * from "./change-schema";

// Goals and alerts
export * from "./goals-schema";
export * from "./alert-schema";

// Dashboard and links
export * from "./dashboard-schema";
export * from "./link-schema";

// Prospect and keyword schemas
export * from "./prospect-schema";
export * from "./prospect-keyword-schema";
export * from "./prospect-scrape-config-schema";

// Brief and content schemas
export * from "./brief-schema";

// API and infrastructure schemas
export * from "./api-key-schema";
export * from "./embedding-schema";
export * from "./crawl-schema";
export * from "./idempotency-schema";

// Ranking and patterns schemas
export * from "./ranking-schema";
export * from "./rank-events-schema";
export * from "./patterns-schema";

// Pipeline and automation schemas
export * from "./pipeline-rules-schema";
export * from "./automation-schema";

// Proposal and webhook schemas
export * from "./proposal-schema";
export * from "./webhook-schema";

// Security and audit schemas
export * from "./security-audit-schema";

// Onboarding schemas
export * from "./onboarding-schema";
export * from "./magic-link-schema";
export * from "./activity-schema";

// Pipeline configuration schema
export * from "./pipeline-config-schema";

// Tasks schema (Phase 49-51)
export * from "./tasks-schema";

// Report templates schema (Phase 53)
export * from "./report-template-schema";

// Payment settings schema (Phase 54)
export * from "./workspace-payment-settings-schema";

// Translation cache schema (Phase 55)
export * from "./translation-cache-schema";

// Agreement templates schema (Phase 55)
export * from "./agreement-template-schema";

// Proposal templates schema (Phase 57)
export * from "./proposal-template-schema";

// Variable definitions schema (Phase 57)
export * from "./variable-definitions-schema";

// Proposal versions schema (Phase 57)
// NOTE: Re-export with renamed types to avoid collision with change-schema.ts
export {
  proposalVersions,
  proposalVersionsRelations,
  type ProposalVersionSelect,
  type ProposalVersionInsert,
  CHANGE_TYPES as PROPOSAL_CHANGE_TYPES,
  type ChangeType as ProposalChangeType,
} from "./schema/proposal-versions";

// Service catalog schema (Phase 58)
export * from "./service-catalog-schema";

// Pixel installation schema (Phase 66)
export * from "./pixel-schema";
