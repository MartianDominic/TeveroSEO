/**
 * Saga pattern for cross-service operations.
 * Phase 69-01: Transaction Wrappers
 *
 * Implements the Saga pattern for distributed transactions where
 * multiple independent services/systems need to be coordinated.
 *
 * Key concepts:
 * - Each step has an execute() and compensate() function
 * - If any step fails, previous steps are compensated in reverse order
 * - Compensation failures are captured but don't stop other compensations
 *
 * When to use Saga vs withTransaction:
 * - withTransaction: Single database operations (ACID within one DB)
 * - Saga: Cross-service operations (API calls, multiple DBs, external systems)
 *
 * @example
 * ```typescript
 * const result = await executeSaga([
 *   {
 *     name: 'create-payment',
 *     execute: async () => await paymentService.create(amount),
 *     compensate: async (payment) => await paymentService.refund(payment.id),
 *   },
 *   {
 *     name: 'send-confirmation',
 *     execute: async () => await emailService.sendConfirmation(userId),
 *     compensate: async () => { /* email sent, cannot undo */ /* },
 *   },
 * ]);
 *
 * if (!result.success) {
 *   console.error('Saga failed at step:', result.failedStep);
 * }
 * ```
 */

import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "saga" });

/**
 * A single step in a saga.
 *
 * @typeParam T - The return type of the execute function
 */
export interface SagaStep<T> {
  /** Unique name for logging and error identification */
  name: string;

  /**
   * Execute the forward operation.
   * Should be idempotent when possible.
   */
  execute: () => Promise<T>;

  /**
   * Compensate (undo) the operation.
   * Receives the result from execute() to know what to undo.
   * Should be idempotent - may be called multiple times on retry.
   */
  compensate: (result: T) => Promise<void>;
}

/**
 * Result of saga execution.
 *
 * @typeParam T - The return type of saga steps
 */
export interface SagaResult<T> {
  /** Whether all steps completed successfully */
  success: boolean;

  /** Results from each completed step (in order) */
  results: T[];

  /** Name of the step that failed (only if success=false) */
  failedStep?: string;

  /** Error from the failed step (only if success=false) */
  error?: Error;

  /** Steps that failed compensation (may be empty) */
  compensationFailures?: Array<{
    step: string;
    error: Error;
  }>;
}

/**
 * Callback for handling compensation failures.
 * Called when a compensation step fails during rollback.
 *
 * Use this to:
 * - Log to external monitoring (Sentry, etc.)
 * - Send alerts for manual intervention
 * - Queue for retry via dead-letter queue
 */
export type CompensationFailureHandler = (
  stepName: string,
  error: Error,
  stepResult: unknown,
) => Promise<void>;

/**
 * Execute a saga (sequence of compensatable steps).
 *
 * Algorithm:
 * 1. Execute steps in order, collecting results
 * 2. If a step fails, run compensations in reverse order
 * 3. Compensation failures are logged but don't stop other compensations
 * 4. Return success/failure status with collected results
 *
 * @param steps - Ordered list of saga steps to execute
 * @param onCompensationFailure - Optional handler for compensation failures
 * @returns SagaResult indicating success/failure and collected results
 *
 * @example
 * ```typescript
 * const { success, results, failedStep } = await executeSaga([
 *   {
 *     name: 'reserve-inventory',
 *     execute: async () => await inventory.reserve(items),
 *     compensate: async (reservation) => await inventory.release(reservation.id),
 *   },
 *   {
 *     name: 'charge-payment',
 *     execute: async () => await payments.charge(amount),
 *     compensate: async (charge) => await payments.refund(charge.id),
 *   },
 *   {
 *     name: 'create-order',
 *     execute: async () => await orders.create(orderData),
 *     compensate: async (order) => await orders.cancel(order.id),
 *   },
 * ]);
 *
 * if (!success) {
 *   // Order creation failed, inventory was released, payment was refunded
 *   throw new Error(`Order failed at: ${failedStep}`);
 * }
 * ```
 */
export async function executeSaga<T>(
  steps: SagaStep<T>[],
  onCompensationFailure?: CompensationFailureHandler,
): Promise<SagaResult<T>> {
  const results: T[] = [];
  const completedSteps: Array<{ step: SagaStep<T>; result: T }> = [];
  const compensationFailures: Array<{ step: string; error: Error }> = [];

  log.info("Saga started", {
    stepCount: steps.length,
    stepNames: steps.map((s) => s.name),
  });

  // Execute steps in order
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    try {
      log.debug("Executing saga step", {
        step: step.name,
        index: i,
        totalSteps: steps.length,
      });

      const result = await step.execute();
      results.push(result);
      completedSteps.push({ step, result });

      log.debug("Saga step completed", {
        step: step.name,
        index: i,
      });
    } catch (error) {
      const stepError = error instanceof Error ? error : new Error(String(error));

      log.warn("Saga step failed, starting compensation", {
        failedStep: step.name,
        error: stepError.message,
        completedSteps: completedSteps.map((s) => s.step.name),
      });

      // Run compensations in reverse order
      for (const completed of [...completedSteps].reverse()) {
        try {
          log.debug("Running compensation", {
            step: completed.step.name,
          });

          await completed.step.compensate(completed.result);

          log.debug("Compensation completed", {
            step: completed.step.name,
          });
        } catch (compensateError) {
          const compError =
            compensateError instanceof Error
              ? compensateError
              : new Error(String(compensateError));

          log.error("Compensation failed", compError, {
            step: completed.step.name,
          });

          compensationFailures.push({
            step: completed.step.name,
            error: compError,
          });

          // Invoke callback if provided
          if (onCompensationFailure) {
            try {
              await onCompensationFailure(
                completed.step.name,
                compError,
                completed.result,
              );
            } catch (callbackError) {
              // Log but don't throw - continue with remaining compensations
              log.error("Compensation failure handler threw", callbackError as Error, {
                step: completed.step.name,
              });
            }
          }
        }
      }

      log.info("Saga failed and compensated", {
        failedStep: step.name,
        compensatedSteps: completedSteps.length,
        compensationFailures: compensationFailures.length,
      });

      return {
        success: false,
        results,
        failedStep: step.name,
        error: stepError,
        compensationFailures:
          compensationFailures.length > 0 ? compensationFailures : undefined,
      };
    }
  }

  log.info("Saga completed successfully", {
    stepCount: steps.length,
  });

  return {
    success: true,
    results,
  };
}

/**
 * Create a no-op compensation function.
 * Use for steps that cannot be undone (e.g., sending an email).
 *
 * @param reason - Why compensation is not possible (logged)
 * @returns A compensation function that does nothing
 *
 * @example
 * ```typescript
 * {
 *   name: 'send-notification',
 *   execute: async () => await notifyUser(userId),
 *   compensate: noOpCompensation('Notification already sent'),
 * }
 * ```
 */
export function noOpCompensation<T>(reason: string): (result: T) => Promise<void> {
  return async () => {
    log.debug("No-op compensation", { reason });
  };
}

/**
 * Create a saga step with logging.
 * Convenience wrapper that adds structured logging to steps.
 *
 * @param name - Step name
 * @param execute - Execute function
 * @param compensate - Compensate function
 * @param metadata - Optional metadata to include in logs
 * @returns SagaStep with enhanced logging
 */
export function createSagaStep<T>(
  name: string,
  execute: () => Promise<T>,
  compensate: (result: T) => Promise<void>,
  metadata?: Record<string, unknown>,
): SagaStep<T> {
  return {
    name,
    execute: async () => {
      log.info("Step executing", { step: name, ...metadata });
      const result = await execute();
      log.info("Step executed", { step: name, ...metadata });
      return result;
    },
    compensate: async (result: T) => {
      log.info("Step compensating", { step: name, ...metadata });
      await compensate(result);
      log.info("Step compensated", { step: name, ...metadata });
    },
  };
}

/**
 * Saga with automatic dead-letter queue integration.
 *
 * When a compensation fails, the step details are queued for manual
 * intervention or automatic retry.
 *
 * @param steps - Saga steps to execute
 * @param dlqHandler - Function to enqueue failed compensations
 * @returns SagaResult
 */
export async function executeSagaWithDLQ<T>(
  steps: SagaStep<T>[],
  dlqHandler: (stepName: string, error: Error, result: T) => Promise<void>,
): Promise<SagaResult<T>> {
  return executeSaga(steps, async (stepName, error, result) => {
    await dlqHandler(stepName, error, result as T);
  });
}
