/**
 * Tier 1 SEO Checks Index
 * All 68 DOM/regex checks that run in <100ms
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

import { getChecksByTier } from "../registry";

/** Get all Tier 1 checks */
export const tier1Checks = () => getChecksByTier(1);

/** Expected count of Tier 1 checks (66 original + T1-67 noindex + T1-68 YMYL author) */
export const TIER1_CHECK_COUNT = 68;
