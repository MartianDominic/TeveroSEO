/**
 * Tags API Route
 * Phase 96-02: GET /api/analytics/tags
 *
 * Returns all unique tags for filtering dropdown.
 */
import { createFileRoute } from '@tanstack/react-router';
import { db } from '@/db';
import { SiteTagsRepository } from '@/server/features/analytics/repositories/SiteTagsRepository';

// Route types regenerated on build - suppress until then
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)('/api/analytics/tags')({
  loader: async ({ request }: any) => {
    try {
      // TODO: Get workspace from auth context for scoping
      const workspaceId = request.headers.get('X-Workspace-ID');
      if (!workspaceId) {
        return Response.json(
          { success: false, error: 'Workspace ID required' },
          { status: 401 }
        );
      }

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
