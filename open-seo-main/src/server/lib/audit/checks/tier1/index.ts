/**
 * Tier 1 SEO Checks Index
 * All 66 DOM/regex checks that run in <100ms
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

/** Expected count of Tier 1 checks */
export const TIER1_CHECK_COUNT = 66;
