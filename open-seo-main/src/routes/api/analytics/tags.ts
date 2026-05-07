/**
 * Tags API Route
 * Phase 96-02: GET /api/analytics/tags
 *
 * Returns all unique tags for filtering dropdown.
 */
import { createFileRoute } from '@tanstack/react-router';
import { getDb } from '@/server/db';
import { SiteTagsRepository } from '@/server/features/analytics/repositories/SiteTagsRepository';

export const Route = createFileRoute('/api/analytics/tags')({
  loader: async ({ request }) => {
    try {
      // TODO: Get workspace from auth context for scoping
      const workspaceId = request.headers.get('X-Workspace-ID');
      if (!workspaceId) {
        return Response.json(
          { success: false, error: 'Workspace ID required' },
          { status: 401 }
        );
      }

      const db = getDb();
      const repo = new SiteTagsRepository(db);

      // Get all unique tags with counts
      const tags = await repo.getAllUniqueTags();

      return Response.json({ success: true, data: tags });
    } catch (error) {
      console.error('Tags fetch error:', error);
      return Response.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
        },
        { status: 500 }
      );
    }
  },
});
