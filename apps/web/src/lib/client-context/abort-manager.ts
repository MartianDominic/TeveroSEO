/**
 * AbortManager for Client Context Switching
 *
 * Phase 68-02: Client Context Security
 * HIGH-01 FIX: Abort in-flight requests when client context changes
 *
 * This prevents race conditions where responses from a previous client
 * context could be processed after switching to a new client.
 *
 * Usage:
 * 1. Get an AbortController for the current client before making requests
 * 2. Pass controller.signal to fetch() calls
 * 3. Call abortClient() when switching to a new client
 *
 * @example
 * ```ts
 * // In API call
 * const controller = abortManager.getController(clientId);
 * const response = await fetch(url, { signal: controller.signal });
 *
 * // In client store when switching
 * abortManager.abortClient(previousClientId);
 * ```
 */

/**
 * Manages AbortControllers for client-scoped requests.
 * Singleton instance exported for application-wide use.
 */
class AbortManager {
  private controllers = new Map<string, AbortController>();

  /**
   * Get or create an AbortController for a client.
   * Returns existing controller if one exists, otherwise creates new.
   *
   * @param clientId - The client ID to get a controller for
   * @returns AbortController for the client
   */
  getController(clientId: string): AbortController {
    let controller = this.controllers.get(clientId);
    if (!controller) {
      controller = new AbortController();
      this.controllers.set(clientId, controller);
    }
    return controller;
  }

  /**
   * Get the AbortSignal for a client.
   * Convenience method that returns just the signal.
   *
   * @param clientId - The client ID to get signal for
   * @returns AbortSignal for the client
   */
  getSignal(clientId: string): AbortSignal {
    return this.getController(clientId).signal;
  }

  /**
   * Abort all in-flight requests for a client.
   * Call this when switching away from a client.
   *
   * @param clientId - The client ID to abort requests for
   */
  abortClient(clientId: string): void {
    const controller = this.controllers.get(clientId);
    if (controller) {
      controller.abort();
      this.controllers.delete(clientId);
    }
  }

  /**
   * Abort all in-flight requests for all clients.
   * Call this on logout or app cleanup.
   */
  abortAll(): void {
    this.controllers.forEach((controller) => controller.abort());
    this.controllers.clear();
  }

  /**
   * Check if a client has an active controller.
   * Useful for debugging and testing.
   *
   * @param clientId - The client ID to check
   * @returns true if client has an active (non-aborted) controller
   */
  hasActiveController(clientId: string): boolean {
    const controller = this.controllers.get(clientId);
    return controller !== undefined && !controller.signal.aborted;
  }

  /**
   * Get count of active controllers.
   * Useful for debugging and testing.
   *
   * @returns Number of active controllers
   */
  getActiveCount(): number {
    let count = 0;
    this.controllers.forEach((controller) => {
      if (!controller.signal.aborted) {
        count++;
      }
    });
    return count;
  }

  /**
   * Reset the abort manager.
   * For testing purposes only.
   */
  _reset(): void {
    this.controllers.clear();
  }
}

/**
 * Singleton instance of AbortManager.
 * Use this throughout the application.
 */
export const abortManager = new AbortManager();

/**
 * Helper to check if an error is an abort error.
 * Use this in catch blocks to handle aborted requests gracefully.
 *
 * @param error - The error to check
 * @returns true if the error is due to request abort
 */
export function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }
  if (error instanceof Error) {
    return error.name === "AbortError" || error.message.includes("aborted");
  }
  return false;
}
