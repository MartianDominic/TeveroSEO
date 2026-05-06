/**
 * Tier 1 SEO Checks Index
 * All 84 DOM/regex checks that run in <100ms
 *
 * Check categories:
 * - T1-01 to T1-05: HTML Signals
 * - T1-06 to T1-13: Heading Structure
 * - T1-14 to T1-20: Title/Meta
 * - T1-21 to T1-25: URL Structure
 * - T1-26 to T1-32: Content Structure
 * - T1-33 to T1-38: Image Basics
 * - T1-39 to T1-43: Internal Links
 * - T1-44 to T1-47: External Links
 * - T1-48 to T1-54: Schema Basics
 * - T1-55 to T1-59, T1-67: Technical Basics (T1-67: noindex check)
 * - T1-60 to T1-66, T1-68: E-E-A-T Signals (T1-68: YMYL author check)
 * - T1-70 to T1-85: Page Structure (Phase 92)
 */

// Import all category files to trigger registration
import "./html-signals";
import "./heading-structure";
import "./title-meta";
import "./url-structure";
import "./content-structure";
import "./image-basics";
import "./internal-links";
import "./external-links";
import "./schema-basics";
import "./technical-basics";
import "./eeat-signals";

// Phase 92: Page Structure checks (T1-70 to T1-85)
import "./T1-70-page-type";
import "./T1-71-value-prop";
import "./T1-72-cta-above-fold";
import "./T1-73-h2-spacing";
import "./T1-74-comparison-table";
import "./T1-75-pros-cons";
import "./T1-76-winner-declaration";
import "./T1-77-listicle-numbered";
import "./T1-78-nap-info";
import "./T1-79-map-embed";
import "./T1-80-local-business-schema";
import "./T1-81-author-byline";
import "./T1-82-published-date";
import "./T1-83-service-schema";
import "./T1-84-itemlist-schema";
import "./T1-85-social-proof";

import { getChecksByTier } from "../registry";

/** Get all Tier 1 checks */
export const tier1Checks = () => getChecksByTier(1);

/** Expected count of Tier 1 checks (68 original + 16 Phase 92 page structure checks) */
export const TIER1_CHECK_COUNT = 84;

// Re-export page type detection for use in other modules
export { detectPageType, type PageType } from "./T1-70-page-type";
