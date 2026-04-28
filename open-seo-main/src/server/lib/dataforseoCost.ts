export type DataforseoApiCallCost = {
  path: string[];
  costUsd: number;
  resultCount: number | null;
};

export type DataforseoApiResponse<T> = {
  data: T;
  billing: DataforseoApiCallCost;
};

/**
 * Calculate API call cost from DataForSEO task response.
 * @param path - API endpoint path segments
 * @param cost - Cost returned by DataForSEO in the task
 * @param resultCount - Optional result count from the task
 */
export function calculateApiCallCost(
  path: string[],
  cost: number,
  resultCount?: number | null
): DataforseoApiCallCost {
  return {
    path,
    costUsd: cost,
    resultCount: resultCount ?? null,
  };
}
