/**
 * Camoufox Browser Pool Module
 *
 * Production-ready browser pool for anti-bot bypassing and JS rendering.
 * Part of the tiered scraping architecture (Tier 4: Browser Rendering).
 *
 * @see .planning/phases/95-scraping-infrastructure/CAMOUFOX-VPS-INFRASTRUCTURE.md
 * @see .planning/phases/95-scraping-infrastructure/CAMOUFOX-POOL-MANAGEMENT.md
 */

// Pool implementation
export { CamoufoxPool, createGeonodePool, createDevPool } from "./pool";
export type {
  PoolConfig,
  CamoufoxOptions,
  ProxyConfig,
  PoolMetrics,
  PageHandle,
  InstanceState,
} from "./pool";

// Health monitoring
export { createHealthServer } from "./health";
