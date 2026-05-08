/**
 * Visibility Middleware
 * Phase 96-05: API-layer visibility enforcement
 *
 * Express-compatible middleware that:
 * 1. Extracts clientId from request params or body
 * 2. Validates workspace access (client belongs to user's workspace)
 * 3. Fetches visibility configuration
 * 4. Attaches config to request for downstream use
 * 5. Wraps res.json to filter response data automatically
 */
import { getClientVisibilityService } from "../services/ClientVisibilityService";
import {
  DEFAULT_VISIBILITY,
  type VisibilityConfig,
} from "@/db/analytics-extended-schema";

/**
 * Extended request interface with visibility config
 */
export interface VisibilityRequest {
  params: Record<string, string>;
  body: Record<string, unknown>;
  headers: Map<string, string> | Headers | { get: (key: string) => string | null };
  visibilityConfig?: VisibilityConfig;
}

/**
 * Response interface for middleware
 */
export interface VisibilityResponse {
  status: (code: number) => VisibilityResponse;
  json: (data: unknown) => VisibilityResponse;
}

/**
 * Extract workspace ID from request headers
 */
function getWorkspaceFromHeaders(
  headers: Map<string, string> | Headers | { get: (key: string) => string | null }
): string | null {
  if (headers instanceof Map) {
    return headers.get("x-workspace-id") ?? null;
  }
  if (typeof headers.get === "function") {
    return headers.get("x-workspace-id");
  }
  return null;
}

/**
 * Apply visibility filter to any data structure.
 * Exported for use outside middleware context.
 */
export async function applyVisibilityFilter<T>(
  data: T,
  config: VisibilityConfig
): Promise<T> {
  if (data === null || data === undefined) {
    return data;
  }

  const service = await getClientVisibilityService();
  return service.filterByVisibility(
    data as Record<string, unknown>,
    config
  ) as T;
}

/**
 * Visibility middleware factory.
 * Returns middleware function that enforces visibility at API layer.
 *
 * Usage:
 * ```typescript
 * // In route handler
 * const middleware = visibilityMiddleware();
 * await middleware(req, res, next);
 * // Now req.visibilityConfig is available
 * // And res.json automatically filters response
 * ```
 */
export function visibilityMiddleware() {
  return async (
    req: VisibilityRequest,
    res: VisibilityResponse,
    next: () => void
  ): Promise<void> => {
    try {
      // Extract clientId from params or body
      const clientId = req.params.clientId || (req.body.clientId as string);
      if (!clientId) {
        // No client context - proceed without filtering
        req.visibilityConfig = DEFAULT_VISIBILITY;
        next();
        return;
      }

      // Extract workspace from auth context
      const workspaceId = getWorkspaceFromHeaders(req.headers);
      if (!workspaceId) {
        res.status(401).json({
          error: "UNAUTHORIZED",
          message: "Workspace ID required",
        });
        return;
      }

      const service = await getClientVisibilityService();

      // Validate workspace owns this client
      const hasAccess = await service.validateWorkspaceAccess(
        clientId,
        workspaceId
      );
      if (!hasAccess) {
        res.status(403).json({
          error: "ACCESS_DENIED",
          message: "Client not in your workspace",
        });
        return;
      }

      // Get visibility config
      const config = await service.getVisibilityConfig(clientId, workspaceId);
      req.visibilityConfig = config;

      // Wrap res.json to filter response
      const originalJson = res.json.bind(res);
      res.json = (data: unknown) => {
        if (data && typeof data === "object") {
          const filtered = service.filterByVisibility(
            data as Record<string, unknown>,
            config
          );
          return originalJson(filtered);
        }
        return originalJson(data);
      };

      next();
    } catch (error) {
      console.error("[visibilityMiddleware] Error:", error);
      res.status(500).json({
        error: "INTERNAL_ERROR",
        message: "Failed to apply visibility filter",
      });
    }
  };
}

/**
 * Helper to check if a specific feature is visible.
 * Use in route handlers to conditionally include data.
 */
export function isFeatureVisible(
  config: VisibilityConfig | undefined,
  feature: keyof VisibilityConfig
): boolean {
  if (!config) return DEFAULT_VISIBILITY[feature];
  return config[feature];
}

/**
 * Helper to check if export is allowed.
 */
export function canExport(config: VisibilityConfig | undefined): boolean {
  return isFeatureVisible(config, "canExport");
}

/**
 * Helper to check if growing pages view is allowed.
 */
export function canViewGrowing(config: VisibilityConfig | undefined): boolean {
  return isFeatureVisible(config, "canViewGrowing");
}

/**
 * Helper to check if decaying pages view is allowed.
 */
export function canViewDecaying(config: VisibilityConfig | undefined): boolean {
  return isFeatureVisible(config, "canViewDecaying");
}

/**
 * Helper to check if cannibalization view is allowed.
 */
export function canViewCannibalization(
  config: VisibilityConfig | undefined
): boolean {
  return isFeatureVisible(config, "canViewCannibalization");
}
