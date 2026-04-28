/**
 * Click depth computation using BFS from homepage.
 * Phase 35-02: Opportunity Detection
 *
 * Uses breadth-first search to calculate the minimum number of clicks
 * required to reach each page from the homepage.
 */

/**
 * Represents a directed link edge in the site graph.
 */
export interface LinkEdge {
  sourceUrl: string;
  targetUrl: string;
}

/**
 * Parameters for click depth computation.
 */
export interface ComputeClickDepthsParams {
  /** All link edges in the site graph */
  edges: LinkEdge[];
  /** Homepage URL (starting point for BFS) */
  homepageUrl: string;
  /** All page URLs to compute depth for */
  allPageUrls: string[];
  /** Maximum depth to explore (default: 10) */
  maxDepth?: number;
  /** Maximum BFS iterations (default: 10000, DoS protection T-35-08) */
  maxIterations?: number;
  /** Whether to normalize URLs by removing trailing slashes */
  normalizeUrls?: boolean;
}

/**
 * Result of click depth computation.
 */
export interface ClickDepthResult {
  /** Map from page URL to click depth (Infinity if unreachable) */
  depths: Map<string, number>;
  /** URLs that could not be reached from homepage */
  unreachableUrls: string[];
  /** Total number of pages analyzed */
  totalPages: number;
  /** Number of pages reachable from homepage */
  reachablePages: number;
  /** Maximum depth found among reachable pages */
  maxDepthFound: number;
  /** Number of BFS iterations used */
  iterationsUsed: number;
  /** Whether computation was stopped due to iteration limit */
  cappedAtIterations: boolean;
}

/**
 * Normalizes a URL by removing trailing slash.
 */
function normalizeUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

/**
 * Compute click depths for all pages using BFS from homepage.
 *
 * BFS guarantees shortest path, which corresponds to minimum clicks.
 * Capped at maxIterations (default 10000) and maxDepth (default 10)
 * for DoS protection per threat model T-35-08.
 *
 * @param params - Computation parameters
 * @returns Click depth results including unreachable pages
 */
export function computeClickDepths(
  params: ComputeClickDepthsParams
): ClickDepthResult {
  const {
    edges,
    homepageUrl,
    allPageUrls,
    maxDepth = 10,
    maxIterations = 10000,
    normalizeUrls: shouldNormalize = false,
  } = params;

  // Handle empty input
  if (allPageUrls.length === 0) {
    return {
      depths: new Map(),
      unreachableUrls: [],
      totalPages: 0,
      reachablePages: 0,
      maxDepthFound: 0,
      iterationsUsed: 0,
      cappedAtIterations: false,
    };
  }

  // Normalize URLs if requested
  const normalize = shouldNormalize ? normalizeUrl : (url: string) => url;
  const normalizedHomepage = normalize(homepageUrl);

  // Build adjacency list for outbound links
  const adjacencyList = new Map<string, Set<string>>();

  for (const edge of edges) {
    const source = normalize(edge.sourceUrl);
    const target = normalize(edge.targetUrl);

    if (!adjacencyList.has(source)) {
      adjacencyList.set(source, new Set());
    }
    adjacencyList.get(source)!.add(target);
  }

  // Initialize depths map with all pages set to Infinity
  const depths = new Map<string, number>();
  const normalizedUrls = new Set<string>();

  for (const url of allPageUrls) {
    const normalizedUrl = normalize(url);
    normalizedUrls.add(normalizedUrl);
    depths.set(normalizedUrl, Infinity);
  }

  // BFS from homepage
  const queue: Array<{ url: string; depth: number }> = [];
  const visited = new Set<string>();

  // Start from homepage
  if (normalizedUrls.has(normalizedHomepage)) {
    queue.push({ url: normalizedHomepage, depth: 0 });
    depths.set(normalizedHomepage, 0);
    visited.add(normalizedHomepage);
  }

  let iterations = 0;
  let maxDepthFound = 0;
  let cappedAtIterations = false;

  while (queue.length > 0) {
    // Check iteration limit
    if (iterations >= maxIterations) {
      cappedAtIterations = true;
      break;
    }
    iterations++;

    const current = queue.shift()!;

    // Check depth limit
    if (current.depth >= maxDepth) {
      continue; // Don't explore deeper
    }

    // Update max depth found
    if (current.depth > maxDepthFound) {
      maxDepthFound = current.depth;
    }

    // Get outbound links from current page
    const outboundLinks = adjacencyList.get(current.url);
    if (!outboundLinks) {
      continue;
    }

    // Process each outbound link
    for (const targetUrl of outboundLinks) {
      // Skip if already visited with shorter path
      if (visited.has(targetUrl)) {
        continue;
      }

      // Skip if not in our page list
      if (!normalizedUrls.has(targetUrl)) {
        continue;
      }

      // Mark as visited and set depth
      visited.add(targetUrl);
      const newDepth = current.depth + 1;
      depths.set(targetUrl, newDepth);

      // Add to queue for further exploration
      queue.push({ url: targetUrl, depth: newDepth });
    }
  }

  // Collect unreachable URLs
  const unreachableUrls: string[] = [];
  for (const [url, depth] of depths) {
    if (depth === Infinity) {
      unreachableUrls.push(url);
    }
  }

  // Count reachable pages
  const reachablePages = depths.size - unreachableUrls.length;

  return {
    depths,
    unreachableUrls,
    totalPages: depths.size,
    reachablePages,
    maxDepthFound,
    iterationsUsed: iterations,
    cappedAtIterations,
  };
}
