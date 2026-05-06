/**
 * Portal Data API Endpoint
 * Phase 86-10: Final Integration (STUB)
 *
 * GET /portal/:token/data
 *
 * STUB: Structure defined, production implementation in Phase 90.
 */

import { createAPIFileRoute } from '@tanstack/start/api';
import { json } from '@tanstack/start';
import type { PortalDataResponse } from '../../../../server/features/portal/types';

export const Route = createAPIFileRoute('/api/portal/$token/data')({
  GET: async ({ params }) => {
    const { token } = params;

    if (!token) {
      return json({ error: 'Token required' }, { status: 400 });
    }

    // STUB: Return structure with clusters field
    const data: PortalDataResponse = {
      client: { name: 'Stub Client', domain: 'stub.com' },
      agency: { name: 'Stub Agency', logoUrl: null },
      goal: { metric: 'top_10', target: 30, deadline: '', currentCount: 0, achievementPct: 0 },
      achievement: { current: 0, target: 30, percentage: 0, daysAhead: 0 },
      clusters: [],
      keywords: [],
      calendar: [],
      lastUpdated: new Date().toISOString(),
    };

    return json(data, {
      headers: {
        'Cache-Control': 'private, max-age=300',
      },
    });
  },
});
