/**
 * Platform OAuth Services Barrel Export
 * Phase 61-02: Platform Integration Excellence
 *
 * Exports all Google API data fetching services.
 */

// Google Search Console
export {
  GoogleSearchConsoleService,
  type GSCData,
  type GSCQueryData,
  type GSCPageData,
  type GSCIndexStatus,
  type GSCCoreWebVitals,
  type GetSearchQueriesOptions,
  type GetPagePerformanceOptions,
} from "./GoogleSearchConsoleService";

// Google Analytics
export {
  GoogleAnalyticsService,
  type GAData,
  type GAOverview,
  type GAPageData,
  type GATrafficSource,
  type GAConversion,
  type GAFetchOptions,
} from "./GoogleAnalyticsService";

// Google Business Profile
export {
  GoogleBusinessProfileService,
  type GBPData,
  type GBPProfile,
  type GBPReview,
  type GBPInsights,
  type GBPFetchOptions,
} from "./GoogleBusinessProfileService";

// WordPress
export {
  WordPressService,
  type WPPost,
  type WPPage,
  type WPCategory,
  type WPTag,
  type WordPressData,
} from "./WordPressService";

// OAuth State Management (MED-VAL-02 FIX)
export {
  OAuthStateService,
  createOAuthStateService,
  type CreateStateRequest,
  type StateVerificationResult,
} from "./OAuthStateService";
