/**
 * Centralized Query Key Factory
 *
 * HIGH-STATE-04 FIX: Provides consistent query key patterns across all hooks.
 * Uses factory pattern to ensure type-safe, hierarchical query keys.
 *
 * Pattern: [entity, ...context, ...filters]
 * - Entity: The main resource type (clients, audits, goals, etc.)
 * - Context: Related identifiers (workspaceId, clientId, projectId)
 * - Filters: Optional filtering/sorting parameters
 *
 * @example
 * ```tsx
 * // In a hook
 * const { data } = useQuery({
 *   queryKey: queryKeys.clients.list(workspaceId, { status: 'active' }),
 *   queryFn: () => fetchClients(workspaceId, { status: 'active' }),
 * });
 *
 * // For invalidation
 * queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
 * ```
 */

// ----------------------------------------------------------------------------
// Filter Types
// ----------------------------------------------------------------------------

export interface ClientFilters {
  status?: string | string[];
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  goalAttainmentMin?: number;
  goalAttainmentMax?: number;
  hasAlerts?: boolean;
  alertSeverity?: string[];
  ownerId?: string;
  tags?: string[];
}

export interface AuditFilters {
  status?: string;
  tier?: number;
}

export interface KeywordFilters {
  status?: string;
  difficulty?: "low" | "medium" | "high";
  search?: string;
}

export interface ArticleFilters {
  status?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export interface GoalFilters {
  status?: string;
  type?: string;
}

export interface AlertFilters {
  severity?: "critical" | "high" | "medium" | "low";
  activeOnly?: boolean;
}

// ----------------------------------------------------------------------------
// Query Key Factory
// ----------------------------------------------------------------------------

export const queryKeys = {
  // -------------------------------------------------------------------------
  // Clients
  // -------------------------------------------------------------------------
  clients: {
    all: ["clients"] as const,
    lists: () => [...queryKeys.clients.all, "list"] as const,
    list: (workspaceId: string, filters?: ClientFilters) =>
      [...queryKeys.clients.lists(), workspaceId, filters] as const,
    paginated: (
      workspaceId: string,
      sortBy?: string,
      sortDir?: "asc" | "desc",
      filters?: ClientFilters
    ) =>
      [
        ...queryKeys.clients.all,
        "paginated",
        workspaceId,
        sortBy,
        sortDir,
        filters,
      ] as const,
    details: () => [...queryKeys.clients.all, "detail"] as const,
    detail: (clientId: string) =>
      [...queryKeys.clients.details(), clientId] as const,
  },

  // -------------------------------------------------------------------------
  // Goals
  // -------------------------------------------------------------------------
  goals: {
    all: ["goals"] as const,
    lists: () => [...queryKeys.goals.all, "list"] as const,
    list: (clientId: string, filters?: GoalFilters) =>
      [...queryKeys.goals.lists(), clientId, filters] as const,
    byClient: (clientId: string) =>
      ["clients", "goals", clientId] as const, // Legacy pattern for compatibility
    details: () => [...queryKeys.goals.all, "detail"] as const,
    detail: (goalId: string) =>
      [...queryKeys.goals.details(), goalId] as const,
    projections: (goalId: string) =>
      [...queryKeys.goals.detail(goalId), "projections"] as const,
  },

  // -------------------------------------------------------------------------
  // Audits
  // -------------------------------------------------------------------------
  audits: {
    all: ["audits"] as const,
    lists: () => [...queryKeys.audits.all, "list"] as const,
    list: (projectId: string, filters?: AuditFilters) =>
      [...queryKeys.audits.lists(), projectId, filters] as const,
    byClient: (clientId: string) =>
      [...queryKeys.audits.all, "client", clientId] as const,
    details: () => [...queryKeys.audits.all, "detail"] as const,
    detail: (auditId: string) =>
      [...queryKeys.audits.details(), auditId] as const,
    issues: (auditId: string) =>
      [...queryKeys.audits.detail(auditId), "issues"] as const,
    pages: (auditId: string) =>
      [...queryKeys.audits.detail(auditId), "pages"] as const,
  },

  // -------------------------------------------------------------------------
  // Keywords
  // -------------------------------------------------------------------------
  keywords: {
    all: ["keywords"] as const,
    lists: () => [...queryKeys.keywords.all, "list"] as const,
    list: (projectId: string, filters?: KeywordFilters) =>
      [...queryKeys.keywords.lists(), projectId, filters] as const,
    details: () => [...queryKeys.keywords.all, "detail"] as const,
    detail: (keywordId: string) =>
      [...queryKeys.keywords.details(), keywordId] as const,
    serp: (keywordId: string) =>
      [...queryKeys.keywords.detail(keywordId), "serp"] as const,
    rankings: (keywordId: string) =>
      [...queryKeys.keywords.detail(keywordId), "rankings"] as const,
    mapping: (projectId: string) =>
      [...queryKeys.keywords.all, "mapping", projectId] as const,
  },

  // -------------------------------------------------------------------------
  // Backlinks
  // -------------------------------------------------------------------------
  backlinks: {
    all: ["backlinks"] as const,
    lists: () => [...queryKeys.backlinks.all, "list"] as const,
    list: (projectId: string) =>
      [...queryKeys.backlinks.lists(), projectId] as const,
    details: () => [...queryKeys.backlinks.all, "detail"] as const,
    detail: (backlinkId: string) =>
      [...queryKeys.backlinks.details(), backlinkId] as const,
  },

  // -------------------------------------------------------------------------
  // Dashboard / Command Center
  // -------------------------------------------------------------------------
  dashboard: {
    all: ["dashboard"] as const,
    metrics: (workspaceId: string) =>
      [...queryKeys.dashboard.all, "metrics", workspaceId] as const,
    needsAttention: (workspaceId: string) =>
      ["needs-attention", workspaceId] as const, // Legacy pattern
    winLoss: (workspaceId: string) =>
      [...queryKeys.dashboard.all, "win-loss", workspaceId] as const,
    patterns: (workspaceId: string) =>
      [...queryKeys.dashboard.all, "patterns", workspaceId] as const,
    opportunities: (workspaceId: string) =>
      [...queryKeys.dashboard.all, "opportunities", workspaceId] as const,
    predictiveAlerts: (workspaceId: string) =>
      [...queryKeys.dashboard.all, "predictive-alerts", workspaceId] as const,
  },

  // -------------------------------------------------------------------------
  // Alerts
  // -------------------------------------------------------------------------
  alerts: {
    all: ["smart-alerts"] as const,
    workspace: (workspaceId: string, filters?: AlertFilters) =>
      [...queryKeys.alerts.all, workspaceId, filters] as const,
    detail: (alertId: string) =>
      [...queryKeys.alerts.all, "detail", alertId] as const,
  },

  // -------------------------------------------------------------------------
  // Views
  // -------------------------------------------------------------------------
  views: {
    all: ["saved-views"] as const,
    workspace: (workspaceId: string) =>
      [...queryKeys.views.all, workspaceId] as const,
    detail: (viewId: string) =>
      [...queryKeys.views.all, "detail", viewId] as const,
  },

  // -------------------------------------------------------------------------
  // Articles (AI-Writer)
  // -------------------------------------------------------------------------
  articles: {
    all: ["articles"] as const,
    lists: () => [...queryKeys.articles.all, "list"] as const,
    list: (clientId: string, filters?: ArticleFilters) =>
      [...queryKeys.articles.lists(), clientId, filters] as const,
    details: () => [...queryKeys.articles.all, "detail"] as const,
    detail: (articleId: string) =>
      [...queryKeys.articles.details(), articleId] as const,
    calendar: (clientId: string, month?: string) =>
      [...queryKeys.articles.all, "calendar", clientId, month] as const,
  },

  // -------------------------------------------------------------------------
  // Analytics
  // -------------------------------------------------------------------------
  analytics: {
    all: ["analytics"] as const,
    client: (clientId: string) =>
      [...queryKeys.analytics.all, "client", clientId] as const,
    publishingLogs: (clientId: string) =>
      [...queryKeys.analytics.client(clientId), "publishing-logs"] as const,
  },

  // -------------------------------------------------------------------------
  // Team / Portfolio
  // -------------------------------------------------------------------------
  team: {
    all: ["team"] as const,
    metrics: (workspaceId: string) =>
      [...queryKeys.team.all, "metrics", workspaceId] as const,
  },

  portfolio: {
    all: ["portfolio"] as const,
    aggregates: (workspaceId: string) =>
      [...queryKeys.portfolio.all, "aggregates", workspaceId] as const,
  },

  // -------------------------------------------------------------------------
  // Connections / Sites
  // -------------------------------------------------------------------------
  connections: {
    all: ["connections"] as const,
    workspace: (workspaceId: string) =>
      [...queryKeys.connections.all, workspaceId] as const,
    site: (siteId: string) =>
      [...queryKeys.connections.all, "site", siteId] as const,
    verification: (siteId: string) =>
      [...queryKeys.connections.site(siteId), "verification"] as const,
  },

  // -------------------------------------------------------------------------
  // Prospects
  // -------------------------------------------------------------------------
  prospects: {
    all: ["prospects"] as const,
    lists: () => [...queryKeys.prospects.all, "list"] as const,
    list: (workspaceId: string) =>
      [...queryKeys.prospects.lists(), workspaceId] as const,
    details: () => [...queryKeys.prospects.all, "detail"] as const,
    detail: (prospectId: string) =>
      [...queryKeys.prospects.details(), prospectId] as const,
    analysis: (prospectId: string) =>
      [...queryKeys.prospects.detail(prospectId), "analysis"] as const,
  },

  // -------------------------------------------------------------------------
  // Domain / Project
  // -------------------------------------------------------------------------
  projects: {
    all: ["projects"] as const,
    byClient: (clientId: string) =>
      [...queryKeys.projects.all, "client", clientId] as const,
    details: () => [...queryKeys.projects.all, "detail"] as const,
    detail: (projectId: string) =>
      [...queryKeys.projects.details(), projectId] as const,
    domain: (projectId: string) =>
      [...queryKeys.projects.detail(projectId), "domain"] as const,
    links: (projectId: string) =>
      [...queryKeys.projects.detail(projectId), "links"] as const,
  },
} as const;

// ----------------------------------------------------------------------------
// Type Helpers
// ----------------------------------------------------------------------------

/** Extract query key type from factory function */
export type QueryKeyOf<
  T extends (...args: unknown[]) => readonly unknown[]
> = ReturnType<T>;

/** Example query key types for common use cases */
export type ClientsQueryKey = ReturnType<typeof queryKeys.clients.list>;
export type GoalsQueryKey = ReturnType<typeof queryKeys.goals.list>;
export type AuditsQueryKey = ReturnType<typeof queryKeys.audits.list>;
export type AlertsQueryKey = ReturnType<typeof queryKeys.alerts.workspace>;
