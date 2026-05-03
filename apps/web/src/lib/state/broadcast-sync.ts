/**
 * BroadcastChannel State Synchronization
 *
 * Phase 68-04: State Management Migration
 * HIGH-STATE-02 FIX: Multi-tab state synchronization
 *
 * This module provides cross-tab communication for critical state changes:
 * - Client context switches (all tabs show same active client)
 * - Logout events (logout in one tab logs out all tabs)
 * - Cache invalidation (data refresh propagates across tabs)
 *
 * Uses the BroadcastChannel API (supported in all modern browsers).
 * Falls back gracefully when running in SSR or unsupported environments.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel
 */

// ============================================================================
// Message Types
// ============================================================================

/**
 * Messages that can be broadcast between tabs.
 */
export type SyncMessage =
  | { type: "CLIENT_CHANGED"; clientId: string }
  | { type: "LOGOUT" }
  | { type: "CACHE_INVALIDATE"; keys: string[] };

/**
 * Handler function for sync messages.
 */
export type SyncMessageHandler = (message: SyncMessage) => void;

// ============================================================================
// BroadcastSync Class
// ============================================================================

/**
 * Channel name for Tevero state sync.
 * Unique to this application to avoid conflicts.
 */
const CHANNEL_NAME = "tevero-state-sync";

/**
 * BroadcastSync manages cross-tab communication.
 *
 * Singleton pattern - use the exported `broadcastSync` instance.
 *
 * @example
 * ```ts
 * // Initialize on app mount
 * broadcastSync.init();
 *
 * // Subscribe to messages
 * const unsubscribe = broadcastSync.subscribe('myComponent', (msg) => {
 *   if (msg.type === 'CLIENT_CHANGED') {
 *     // Handle client change
 *   }
 * });
 *
 * // Broadcast changes
 * broadcastSync.broadcastClientChange('client-123');
 *
 * // Cleanup on unmount
 * unsubscribe();
 * ```
 */
class BroadcastSync {
  private channel: BroadcastChannel | null = null;
  private handlers = new Map<string, SyncMessageHandler>();
  private isInitialized = false;

  /**
   * Initialize the broadcast channel.
   * Safe to call multiple times - will only initialize once.
   * Does nothing in SSR or unsupported browsers.
   */
  init(): void {
    // Skip if already initialized or not in browser
    if (this.isInitialized || typeof window === "undefined") {
      return;
    }

    // Check BroadcastChannel support
    if (typeof BroadcastChannel === "undefined") {
      console.warn("[BroadcastSync] BroadcastChannel not supported");
      return;
    }

    try {
      this.channel = new BroadcastChannel(CHANNEL_NAME);

      this.channel.onmessage = (event: MessageEvent<SyncMessage>) => {
        const message = event.data;

        // Validate message structure
        if (!message || typeof message.type !== "string") {
          return;
        }

        // Dispatch to all handlers
        this.handlers.forEach((handler) => {
          try {
            handler(message);
          } catch (error) {
            console.error("[BroadcastSync] Handler error:", error);
          }
        });
      };

      this.channel.onmessageerror = (event) => {
        console.error("[BroadcastSync] Message error:", event);
      };

      this.isInitialized = true;
    } catch (error) {
      console.error("[BroadcastSync] Failed to initialize:", error);
    }
  }

  /**
   * Subscribe to sync messages.
   *
   * @param id - Unique identifier for this subscription (for unsubscribing)
   * @param handler - Function to call when messages are received
   * @returns Unsubscribe function
   */
  subscribe(id: string, handler: SyncMessageHandler): () => void {
    this.handlers.set(id, handler);

    return () => {
      this.handlers.delete(id);
    };
  }

  /**
   * Broadcast a message to all other tabs.
   * Does nothing if channel is not initialized.
   *
   * @param message - The message to broadcast
   */
  broadcast(message: SyncMessage): void {
    if (!this.channel) {
      return;
    }

    try {
      this.channel.postMessage(message);
    } catch (error) {
      console.error("[BroadcastSync] Failed to broadcast:", error);
    }
  }

  /**
   * Broadcast a client change event.
   * Other tabs will update their active client.
   *
   * @param clientId - The new active client ID
   */
  broadcastClientChange(clientId: string): void {
    this.broadcast({ type: "CLIENT_CHANGED", clientId });
  }

  /**
   * Broadcast a logout event.
   * Other tabs will redirect to sign-out.
   */
  broadcastLogout(): void {
    this.broadcast({ type: "LOGOUT" });
  }

  /**
   * Broadcast a cache invalidation event.
   * Other tabs will invalidate the specified query keys.
   *
   * @param keys - Query keys to invalidate (as strings)
   */
  broadcastCacheInvalidate(keys: string[]): void {
    this.broadcast({ type: "CACHE_INVALIDATE", keys });
  }

  /**
   * Check if the broadcast channel is initialized.
   *
   * @returns true if channel is ready to use
   */
  isReady(): boolean {
    return this.channel !== null;
  }

  /**
   * Close the broadcast channel.
   * Call this on app unmount to clean up.
   */
  close(): void {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.handlers.clear();
    this.isInitialized = false;
  }

  /**
   * Reset the sync manager.
   * For testing purposes only.
   */
  _reset(): void {
    this.close();
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

/**
 * Singleton instance of BroadcastSync.
 * Use this throughout the application.
 */
export const broadcastSync = new BroadcastSync();
