/**
 * API Schema Exports
 *
 * Central export point for all API validation schemas.
 * FIX CRIT-API-01: Runtime schema validation on cross-service calls.
 */

// Cross-service schemas (goals, clients, audits, articles, etc.)
export * from "./cross-service";

// Invoice schemas
export * from "./invoice-schemas";
