/**
 * Shared open-seo Project entity. Mirrors open-seo-main's project table.
 * Used by apps/web when the SEO routes are absorbed in Phase 10.
 */
export interface Project {
  id: string;
  name: string;
  domain: string;
  clientId: string;
  createdAt: string; // ISO-8601; server-serialized
}
