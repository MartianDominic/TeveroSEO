import { describe, test, expect } from "vitest";
import { resolveExecutionOrder } from "./dependency-resolver";
import type { PhaseNode } from "./types";
import { PipelineError } from "./types";

describe("resolveExecutionOrder", () => {
  test("returns phases in valid topological order", () => {
    const phases: PhaseNode[] = [
      {
        number: 1,
        name: "First",
        slug: "first",
        dependencies: [],
        requirements: [],
        status: "not_started",
        planCount: 1,
      },
      {
        number: 2,
        name: "Second",
        slug: "second",
        dependencies: [1],
        requirements: [],
        status: "not_started",
        planCount: 1,
      },
      {
        number: 3,
        name: "Third",
        slug: "third",
        dependencies: [2],
        requirements: [],
        status: "not_started",
        planCount: 1,
      },
    ];

    const result = resolveExecutionOrder(phases);

    expect(result.phases).toEqual([1, 2, 3]);
  });

  test("phase with no dependencies appears in earliest possible wave", () => {
    const phases: PhaseNode[] = [
      {
        number: 1,
        name: "First",
        slug: "first",
        dependencies: [],
        requirements: [],
        status: "not_started",
        planCount: 1,
      },
      {
        number: 2,
        name: "Second",
        slug: "second",
        dependencies: [],
        requirements: [],
        status: "not_started",
        planCount: 1,
      },
    ];

    const result = resolveExecutionOrder(phases);

    // Both should be in wave 1 since they have no dependencies
    expect(result.waves.get(1)).toEqual([1, 2]);
  });

  test("phase depending on Phase X appears after Phase X", () => {
    const phases: PhaseNode[] = [
      {
        number: 1,
        name: "First",
        slug: "first",
        dependencies: [],
        requirements: [],
        status: "not_started",
        planCount: 1,
      },
      {
        number: 2,
        name: "Second",
        slug: "second",
        dependencies: [1],
        requirements: [],
        status: "not_started",
        planCount: 1,
      },
    ];

    const result = resolveExecutionOrder(phases);

    expect(result.phases).toEqual([1, 2]);
    expect(result.waves.get(1)).toEqual([1]);
    expect(result.waves.get(2)).toEqual([2]);
  });

  test("independent phases can appear in same wave", () => {
    const phases: PhaseNode[] = [
      {
        number: 1,
        name: "First",
        slug: "first",
        dependencies: [],
        requirements: [],
        status: "not_started",
        planCount: 1,
      },
      {
        number: 2,
        name: "Second",
        slug: "second",
        dependencies: [1],
        requirements: [],
        status: "not_started",
        planCount: 1,
      },
      {
        number: 3,
        name: "Third",
        slug: "third",
        dependencies: [1],
        requirements: [],
        status: "not_started",
        planCount: 1,
      },
    ];

    const result = resolveExecutionOrder(phases);

    // Phase 1 in wave 1, phases 2 and 3 both depend only on 1, so they're in wave 2 together
    expect(result.waves.get(1)).toEqual([1]);
    expect(result.waves.get(2)).toContain(2);
    expect(result.waves.get(2)).toContain(3);
    expect(result.waves.get(2)?.length).toBe(2);
  });

  test("circular dependency throws PipelineError with CIRCULAR_DEPENDENCY code", () => {
    const phases: PhaseNode[] = [
      {
        number: 1,
        name: "First",
        slug: "first",
        dependencies: [2],
        requirements: [],
        status: "not_started",
        planCount: 1,
      },
      {
        number: 2,
        name: "Second",
        slug: "second",
        dependencies: [1],
        requirements: [],
        status: "not_started",
        planCount: 1,
      },
    ];

    expect(() => resolveExecutionOrder(phases)).toThrow(PipelineError);

    try {
      resolveExecutionOrder(phases);
      expect.fail("Should have thrown PipelineError");
    } catch (error) {
      expect(error).toBeInstanceOf(PipelineError);
      expect((error as PipelineError).code).toBe("CIRCULAR_DEPENDENCY");
    }
  });

  test("unknown dependency reference throws PipelineError with UNKNOWN_DEPENDENCY code", () => {
    const phases: PhaseNode[] = [
      {
        number: 1,
        name: "First",
        slug: "first",
        dependencies: [99], // Phase 99 doesn't exist
        requirements: [],
        status: "not_started",
        planCount: 1,
      },
    ];

    expect(() => resolveExecutionOrder(phases)).toThrow(PipelineError);

    try {
      resolveExecutionOrder(phases);
      expect.fail("Should have thrown PipelineError");
    } catch (error) {
      expect(error).toBeInstanceOf(PipelineError);
      expect((error as PipelineError).code).toBe("UNKNOWN_DEPENDENCY");
    }
  });

  test("diamond dependency pattern", () => {
    // A depends on nothing
    // B depends on A
    // C depends on A
    // D depends on B and C
    const phases: PhaseNode[] = [
      {
        number: 1,
        name: "A",
        slug: "a",
        dependencies: [],
        requirements: [],
        status: "not_started",
        planCount: 1,
      },
      {
        number: 2,
        name: "B",
        slug: "b",
        dependencies: [1],
        requirements: [],
        status: "not_started",
        planCount: 1,
      },
      {
        number: 3,
        name: "C",
        slug: "c",
        dependencies: [1],
        requirements: [],
        status: "not_started",
        planCount: 1,
      },
      {
        number: 4,
        name: "D",
        slug: "d",
        dependencies: [2, 3],
        requirements: [],
        status: "not_started",
        planCount: 1,
      },
    ];

    const result = resolveExecutionOrder(phases);

    // Wave 1: A
    // Wave 2: B, C (parallel)
    // Wave 3: D
    expect(result.waves.get(1)).toEqual([1]);
    expect(result.waves.get(2)).toContain(2);
    expect(result.waves.get(2)).toContain(3);
    expect(result.waves.get(3)).toEqual([4]);
  });
});
