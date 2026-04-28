import type { PhaseNode, ExecutionOrder } from "./types";
import { PipelineError } from "./types";

/**
 * Resolve phase execution order using Kahn's algorithm (topological sort).
 * Returns phases in dependency-respecting order with wave assignments for parallelism.
 */
export function resolveExecutionOrder(phases: PhaseNode[]): ExecutionOrder {
  const phaseMap = new Map(phases.map((p) => [p.number, p]));
  const inDegree = new Map<number, number>();
  const adjList = new Map<number, number[]>();

  // Initialize
  for (const phase of phases) {
    inDegree.set(phase.number, 0);
    adjList.set(phase.number, []);
  }

  // Build adjacency list and in-degree count
  for (const phase of phases) {
    for (const dep of phase.dependencies) {
      if (!phaseMap.has(dep)) {
        throw new PipelineError(
          `Phase ${phase.number} depends on unknown phase ${dep}`,
          "UNKNOWN_DEPENDENCY"
        );
      }
      adjList.get(dep)!.push(phase.number);
      inDegree.set(phase.number, inDegree.get(phase.number)! + 1);
    }
  }

  // Queue nodes with in-degree 0 (no dependencies)
  const queue: number[] = [];
  for (const [phaseNum, degree] of inDegree.entries()) {
    if (degree === 0) queue.push(phaseNum);
  }

  const sorted: number[] = [];
  const waves = new Map<number, number[]>();

  while (queue.length > 0) {
    const batch = [...queue];
    queue.length = 0;

    // All phases in this batch can run in parallel (same wave)
    const waveNum = waves.size + 1;
    waves.set(waveNum, batch);

    for (const current of batch) {
      sorted.push(current);

      // Reduce in-degree for neighbors
      for (const neighbor of adjList.get(current)!) {
        const newDegree = inDegree.get(neighbor)! - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      }
    }
  }

  // Cycle detection: if sorted.length < phases.length, cycle exists
  if (sorted.length !== phases.length) {
    const remaining = phases.filter((p) => !sorted.includes(p.number));
    throw new PipelineError(
      `Circular dependency detected involving phases: ${remaining.map((p) => p.number).join(", ")}`,
      "CIRCULAR_DEPENDENCY"
    );
  }

  return { phases: sorted, waves };
}
