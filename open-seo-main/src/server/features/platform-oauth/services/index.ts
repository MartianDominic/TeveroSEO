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
