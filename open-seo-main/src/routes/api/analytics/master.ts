/**
 * Master Dashboard API Route
 * Phase 96-02: GET /api/analytics/master
 *
 * Returns aggregated metrics for all sites in workspace with tag filtering and comparison.
 */
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { db } from '@/db';
import { getMasterDashboardService } from '@/server/features/analytics/services/MasterDashboardService';
import { SiteTagsRepository } from '@/server/features/analytics/repositories/SiteTagsRepository';

const querySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  comparison: z.enum(['WoW', 'MoM', 'YoY']).optional(),
  tags: z.string().optional(), // Comma-separated
  siteIds: z.string().optional(), // Comma-separated UUIDs
});

// Route types regenerated on build - suppress until then
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)('/api/analytics/master')({
  loader: async ({ request }: any) => {
    try {
      const url = new URL(request.url);
      const params = Object.fromEntries(url.searchParams);

      // Validate query parameters
      const parsed = querySchema.safeParse(params);
      if (!parsed.success) {
        return Response.json(
          {
            success: false,
            error: 'Invalid parameters',
            details: parsed.error.flatten(),
          },
          { status: 400 }
        );
      }

      // TODO: Get workspace from auth context
      // For now, extract from header or use placeholder
      const workspaceId = request.headers.get('X-Workspace-ID');
      if (!workspaceId) {
        return Response.json(
          { success: false, error: 'Workspace ID required' },
          { status: 401 }
        );
      }

      // Build filters
      const filters = {
        dateRange: {
          startDate: parsed.data.startDate,
          endDate: parsed.data.endDate,
        },
        comparison: parsed.data.comparison,
        tags: parsed.data.tags?.split(',').filter(Boolean),
        siteIds: parsed.data.siteIds?.split(',').filter(Boolean),
      };

      // Get service and fetch data
      const siteTagsRepo = new SiteTagsRepository(db);
      const dashboardService = getMasterDashboardService(db, siteTagsRepo);

      const data = await dashboardService.getAggregatedMetrics(workspaceId, filters);

      return Response.json({ success: true, data });
    } catch (error) {
      console.error('Master dashboard error:', error);
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
