/**
 * Structural replacement for Cloudflare Workflows' WorkflowStep type.
 *
 * Phase 2 stubs out CF Workflows. The audit crawl/phase modules keep using
 * `step.do(name, fn)` syntax against this local interface so we don't have
 * to rewrite their logic in Phase 2 — Phase 3 will replace the caller with
 * a BullMQ processor that provides a compatible-shaped `step` object.
 */
export interface WorkflowStep {
  do<T>(name: string, fn: () => Promise<T>): Promise<T>;
}

/** Minimal inline implementation: calls fn directly without retries. */
export const inlineStep: WorkflowStep = {
  async do(_name, fn) {
    return fn();
  },
};
