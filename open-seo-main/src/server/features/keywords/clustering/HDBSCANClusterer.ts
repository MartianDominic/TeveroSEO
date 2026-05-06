/**
 * HDBSCAN Clusterer
 * Phase 86-02: Semantic Intelligence Pipeline
 *
 * TypeScript wrapper for Python HDBSCAN clustering service.
 * Calls AI-Writer microservice and maps results to TypeScript types.
 *
 * CRITICAL: Uses 60s timeout via AbortSignal.timeout() to prevent hanging.
 */

import type {
  ClusteringInput,
  ClusteringConfig,
  ClusteringResult,
  ClusteringStats,
  KeywordCluster,
} from './types';
import { DEFAULT_CLUSTERING_CONFIG } from './types';

/**
 * Python API response shape.
 */
interface PythonClusterResponse {
  labels: number[];
  centroids: number[][];
  vis_coords: Array<{ x: number; y: number }>;
  cluster_count: number;
  noise_count: number;
}

/**
 * HTTP timeout for clustering requests (60 seconds).
 * Clustering 2000 keywords with UMAP + HDBSCAN can take 30-45s.
 */
const CLUSTERING_TIMEOUT_MS = 60000;

/**
 * HDBSCAN Clusterer using Python microservice.
 */
export class HDBSCANClusterer {
  private config: ClusteringConfig;
  private apiUrl: string;

  constructor(
    config: Partial<ClusteringConfig> = {},
    apiUrl?: string
  ) {
    this.config = { ...DEFAULT_CLUSTERING_CONFIG, ...config };
    this.apiUrl = apiUrl || process.env.AI_WRITER_URL || 'http://localhost:8000';
  }

  /**
   * Cluster keywords using HDBSCAN via Python API.
   */
  async clusterKeywords(inputs: ClusteringInput[]): Promise<ClusteringResult> {
    const startTime = Date.now();

    // Handle empty input
    if (inputs.length === 0) {
      return {
        clusters: [],
        noise: [],
        stats: {
          inputCount: 0,
          clusterCount: 0,
          noiseCount: 0,
          avgClusterSize: 0,
          processingTimeMs: 0,
        },
      };
    }

    // Extract embeddings for Python API
    const embeddings = inputs.map(i => i.embedding);

    // Call Python clustering service
    const response = await this.callPythonApi(embeddings);

    // Map results back to TypeScript types
    const result = this.mapResponse(inputs, response);

    // Calculate stats
    const processingTimeMs = Date.now() - startTime;
    result.stats = {
      inputCount: inputs.length,
      clusterCount: response.cluster_count,
      noiseCount: response.noise_count,
      avgClusterSize: response.cluster_count > 0
        ? (inputs.length - response.noise_count) / response.cluster_count
        : 0,
      processingTimeMs,
    };

    return result;
  }

  /**
   * Call Python clustering API.
   *
   * CRITICAL: Uses AbortSignal.timeout(60000) to prevent hanging requests.
   * Clustering can take 30-45s for large datasets.
   */
  private async callPythonApi(
    embeddings: number[][]
  ): Promise<PythonClusterResponse> {
    const url = `${this.apiUrl}/api/clustering/cluster`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeddings,
        min_cluster_size: this.config.minClusterSize,
        min_samples: this.config.minSamples,
        umap_dimensions: this.config.umapDimensions,
        umap_vis_dimensions: this.config.umapVisDimensions,
      }),
      // CRITICAL: 60s timeout to prevent hanging requests
      signal: AbortSignal.timeout(CLUSTERING_TIMEOUT_MS),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Clustering API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Map Python response to TypeScript ClusteringResult.
   */
  private mapResponse(
    inputs: ClusteringInput[],
    response: PythonClusterResponse
  ): ClusteringResult {
    // Group inputs by cluster label
    const clusterGroups = new Map<number, ClusteringInput[]>();
    const noise: ClusteringInput[] = [];

    for (let i = 0; i < inputs.length; i++) {
      const label = response.labels[i];
      const input = {
        ...inputs[i],
        visCoords: response.vis_coords[i],
      } as ClusteringInput & { visCoords: { x: number; y: number } };

      if (label === -1) {
        noise.push(input);
      } else {
        if (!clusterGroups.has(label)) {
          clusterGroups.set(label, []);
        }
        clusterGroups.get(label)!.push(input);
      }
    }

    // Build cluster objects
    const clusters: KeywordCluster[] = [];
    let centroidIndex = 0;

    for (const [clusterId, keywords] of Array.from(clusterGroups.entries())) {
      const cluster = this.buildCluster(
        clusterId,
        keywords,
        response.centroids[centroidIndex]
      );
      clusters.push(cluster);
      centroidIndex++;
    }

    return {
      clusters,
      noise,
      stats: {} as ClusteringStats, // Filled by caller
    };
  }

  /**
   * Build KeywordCluster from grouped keywords.
   */
  private buildCluster(
    clusterId: number,
    keywords: ClusteringInput[],
    centroid: number[]
  ): KeywordCluster {
    // Calculate aggregates
    const totalVolume = keywords.reduce((sum, k) => sum + k.volume, 0);
    const averageDifficulty = keywords.reduce((sum, k) => sum + k.difficulty, 0) / keywords.length;

    // Calculate funnel breakdown
    const funnelBreakdown = { bofu: 0, mofu: 0, tofu: 0 };
    for (const k of keywords) {
      funnelBreakdown[k.funnelStage]++;
    }

    // Determine dominant funnel
    const dominantFunnel = Object.entries(funnelBreakdown)
      .sort(([, a], [, b]) => b - a)[0][0] as 'bofu' | 'mofu' | 'tofu';

    return {
      clusterId,
      keywords,
      centroid,
      totalVolume,
      averageDifficulty,
      dominantFunnel,
      funnelBreakdown,
    };
  }
}

/**
 * Factory function for quick clustering.
 */
export async function clusterKeywords(
  inputs: ClusteringInput[],
  config?: Partial<ClusteringConfig>,
  apiUrl?: string
): Promise<ClusteringResult> {
  const clusterer = new HDBSCANClusterer(config, apiUrl);
  return clusterer.clusterKeywords(inputs);
}
