/**
 * Analytics Feature Types
 * Phase 96-01: GSC Analytics Infrastructure
 */

export interface GscQueryRow {
  query: string;
  pageUrl?: string;
  country?: string;
  device?: string;
  searchAppearance?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface PaginationOptions {
  siteId: string;
  siteUrl: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  dimensions: string[];
  rowLimit?: number; // default 25000
}

export type DimensionCombination =
  | ["query"]
  | ["query", "page"]
  | ["query", "country"]
  | ["page"];

export const DIMENSION_COMBINATIONS: DimensionCombination[] = [
  ["query"],
  ["query", "page"],
  ["query", "country"],
  ["page"],
];
