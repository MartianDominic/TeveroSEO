/**
 * Webhook event registry service.
 * Phase 18.5: Defines and manages available webhook events.
 */
import { db } from "@/db";
import { webhookEvents } from "@/db/webhook-schema";

interface EventDefinition {
  type: string;
  category: string;
  tier: number;
  description: string;
  samplePayload: Record<string, unknown>;
}

const TIER_1_EVENTS: EventDefinition[] = [
  // Ranking (6 events)
  {
    type: "ranking.drop",
    category: "ranking",
    tier: 1,
    description: "Keyword position dropped significantly",
    samplePayload: {
      keyword: "seo services",
      previousPosition: 5,
      currentPosition: 15,
      dropAmount: 10,
    },
  },
  {
    type: "ranking.gain",
    category: "ranking",
    tier: 1,
    description: "Keyword position improved significantly",
    samplePayload: {
      keyword: "seo services",
      previousPosition: 15,
      currentPosition: 5,
      gainAmount: 10,
    },
  },
  {
    type: "ranking.entered_top_10",
    category: "ranking",
    tier: 1,
    description: "Keyword entered Top 10",
    samplePayload: {
      keyword: "seo services",
      previousPosition: 12,
      currentPosition: 8,
    },
  },
  {
    type: "ranking.exited_top_10",
    category: "ranking",
    tier: 1,
    description: "Keyword dropped out of Top 10",
    samplePayload: {
      keyword: "seo services",
      previousPosition: 9,
      currentPosition: 14,
    },
  },
  {
    type: "ranking.position_1",
    category: "ranking",
    tier: 1,
    description: "Keyword reached position 1",
    samplePayload: {
      keyword: "seo services",
      previousPosition: 3,
      currentPosition: 1,
    },
  },
  {
    type: "ranking.lost_position_1",
    category: "ranking",
    tier: 1,
    description: "Keyword lost position 1",
    samplePayload: {
      keyword: "seo services",
      previousPosition: 1,
      currentPosition: 2,
    },
  },

  // Backlinks (4 events)
  {
    type: "backlink.new",
    category: "backlinks",
    tier: 1,
    description: "New backlink detected",
    samplePayload: {
      sourceUrl: "https://example.com/blog/post",
      targetUrl: "https://yoursite.com/page",
      domainRating: 45,
    },
  },
  {
    type: "backlink.lost",
    category: "backlinks",
    tier: 1,
    description: "Backlink lost",
    samplePayload: {
      sourceUrl: "https://example.com/blog/post",
      targetUrl: "https://yoursite.com/page",
      domainRating: 45,
    },
  },
  {
    type: "backlink.high_authority_new",
    category: "backlinks",
    tier: 1,
    description: "High authority backlink detected (DR 60+)",
    samplePayload: {
      sourceUrl: "https://authority.com/resource",
      targetUrl: "https://yoursite.com/page",
      domainRating: 72,
    },
  },
  {
    type: "backlink.high_authority_lost",
    category: "backlinks",
    tier: 1,
    description: "High authority backlink lost (DR 60+)",
    samplePayload: {
      sourceUrl: "https://authority.com/resource",
      targetUrl: "https://yoursite.com/page",
      domainRating: 72,
    },
  },

  // Traffic (2 events)
  {
    type: "traffic.anomaly_up",
    category: "traffic",
    tier: 1,
    description: "Significant traffic increase detected",
    samplePayload: {
      changePercent: 45,
      period: "week",
      currentValue: 15000,
      previousValue: 10345,
    },
  },
  {
    type: "traffic.anomaly_down",
    category: "traffic",
    tier: 1,
    description: "Significant traffic decrease detected",
    samplePayload: {
      changePercent: -32,
      period: "week",
      currentValue: 7000,
      previousValue: 10294,
    },
  },

  // Technical (3 events)
  {
    type: "audit.completed",
    category: "technical",
    tier: 1,
    description: "Site audit completed",
    samplePayload: {
      auditId: "audit_abc123",
      issuesFound: 45,
      criticalIssues: 3,
    },
  },
  {
    type: "audit.critical_found",
    category: "technical",
    tier: 1,
    description: "Critical issue found in audit",
    samplePayload: {
      auditId: "audit_abc123",
      issueType: "broken_page",
      affectedUrls: 12,
    },
  },
  {
    type: "audit.issue_resolved",
    category: "technical",
    tier: 1,
    description: "Previously detected issue has been resolved",
    samplePayload: {
      issueType: "missing_meta_description",
      resolvedCount: 5,
    },
  },

  // Reports (3 events)
  {
    type: "report.generated",
    category: "reports",
    tier: 1,
    description: "Report generated successfully",
    samplePayload: {
      reportId: "rpt_xyz789",
      reportType: "monthly",
      period: "2026-03",
    },
  },
  {
    type: "report.delivered",
    category: "reports",
    tier: 1,
    description: "Report delivered via email",
    samplePayload: {
      reportId: "rpt_xyz789",
      recipients: ["client@example.com"],
    },
  },
  {
    type: "report.failed",
    category: "reports",
    tier: 1,
    description: "Report generation failed",
    samplePayload: {
      reportId: "rpt_xyz789",
      error: "Timeout generating PDF",
    },
  },

  // Connections (3 events)
  {
    type: "connection.new",
    category: "connections",
    tier: 1,
    description: "New OAuth connection established",
    samplePayload: {
      provider: "google",
      properties: ["Search Console", "Analytics"],
    },
  },
  {
    type: "connection.expired",
    category: "connections",
    tier: 1,
    description: "OAuth connection expired",
    samplePayload: {
      provider: "google",
      expiredAt: "2026-04-19T00:00:00Z",
    },
  },
  {
    type: "connection.refresh_failed",
    category: "connections",
    tier: 1,
    description: "OAuth token refresh failed",
    samplePayload: {
      provider: "google",
      error: "Invalid grant",
    },
  },

  // Alerts (3 events)
  {
    type: "alert.triggered",
    category: "alerts",
    tier: 1,
    description: "Alert triggered",
    samplePayload: {
      alertId: "alt_def456",
      alertType: "ranking_drop",
      severity: "warning",
    },
  },
  {
    type: "alert.acknowledged",
    category: "alerts",
    tier: 1,
    description: "Alert acknowledged by user",
    samplePayload: {
      alertId: "alt_def456",
      acknowledgedBy: "user@example.com",
    },
  },
  {
    type: "alert.resolved",
    category: "alerts",
    tier: 1,
    description: "Alert resolved",
    samplePayload: {
      alertId: "alt_def456",
      resolvedBy: "user@example.com",
    },
  },

  // Sync (2 events)
  {
    type: "sync.completed",
    category: "sync",
    tier: 1,
    description: "Data sync completed",
    samplePayload: {
      syncType: "gsc",
      recordsSynced: 1500,
    },
  },
  {
    type: "sync.failed",
    category: "sync",
    tier: 1,
    description: "Data sync failed",
    samplePayload: {
      syncType: "gsc",
      error: "API rate limit exceeded",
    },
  },
];

/**
 * Seed all Tier 1 events into the database.
 */
export async function seedEventRegistry(): Promise<void> {
  for (const event of TIER_1_EVENTS) {
    await db
      .insert(webhookEvents)
      .values({
        type: event.type,
        category: event.category,
        tier: event.tier,
        description: event.description,
        samplePayload: event.samplePayload,
      })
      .onConflictDoUpdate({
        target: webhookEvents.type,
        set: {
          category: event.category,
          description: event.description,
          samplePayload: event.samplePayload,
        },
      });
  }
}

/**
 * Get all unique event categories.
 */
export function getEventCategories(): string[] {
  return [...new Set(TIER_1_EVENTS.map((e) => e.category))];
}

/**
 * Get events filtered by category.
 */
export function getEventsByCategory(category: string): EventDefinition[] {
  return TIER_1_EVENTS.filter((e) => e.category === category);
}

/**
 * Get all available events.
 */
export function getAllEvents(): EventDefinition[] {
  return TIER_1_EVENTS;
}

/**
 * Get event definition by type.
 */
export function getEventByType(type: string): EventDefinition | undefined {
  return TIER_1_EVENTS.find((e) => e.type === type);
}

/**
 * Check if an event type matches a subscription pattern.
 * Supports exact match and wildcard patterns like "ranking.*"
 */
export function matchesEventPattern(
  eventType: string,
  pattern: string,
): boolean {
  if (pattern === "*") return true;
  if (pattern.endsWith(".*")) {
    const category = pattern.slice(0, -2);
    return eventType.startsWith(category + ".");
  }
  return eventType === pattern;
}

/**
 * Check if an event type matches any of the subscription patterns.
 */
export function matchesAnyPattern(
  eventType: string,
  patterns: string[],
): boolean {
  return patterns.some((pattern) => matchesEventPattern(eventType, pattern));
}
