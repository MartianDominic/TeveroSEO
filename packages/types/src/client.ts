/**
 * Shared Client entity as exposed by AI-Writer's clients API.
 * All apps/web pages and open-seo absorbed routes (Phase 10) read this shape.
 */
export interface Client {
  id: string;
  name: string;
  website_url: string | null;
  is_archived: boolean;
}
