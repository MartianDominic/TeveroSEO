/**
 * IndexedDB offline queue for database operations.
 *
 * Queues operations when offline and replays when connection is restored.
 * Used for saving analysis results during network interruptions.
 *
 * @module client/features/keywords/lib/offline-queue
 */

import { openDB, type IDBPDatabase } from "idb";

export interface QueuedOperation {
  id: string;
  table: string;
  operation: "insert" | "update" | "delete";
  data: unknown;
  timestamp: number;
  retryCount: number;
}

const DB_NAME = "offline-queue";
const DB_VERSION = 1;
const STORE_NAME = "operations";
const MAX_RETRIES = 3;

class OfflineQueue {
  private db: IDBPDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private isOnline: boolean = typeof navigator !== "undefined" ? navigator.onLine : true;
  private flushInProgress: boolean = false;

  private async ensureInit(): Promise<void> {
    if (this.db) return;

    if (!this.initPromise) {
      this.initPromise = this.init();
    }

    await this.initPromise;
  }

  private async init(): Promise<void> {
    try {
      this.db = await openDB(DB_NAME, DB_VERSION, {
        upgrade(db: IDBPDatabase) {
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
            store.createIndex("timestamp", "timestamp");
          }
        },
      });

      // Listen for online/offline events
      if (typeof window !== "undefined") {
        window.addEventListener("online", () => {
          this.isOnline = true;
          this.flush();
        });
        window.addEventListener("offline", () => {
          this.isOnline = false;
        });
      }
    } catch (error) {
      console.error("Failed to initialize IndexedDB for offline queue:", error);
      throw error;
    }
  }

  async enqueue(
    operation: Omit<QueuedOperation, "id" | "timestamp" | "retryCount">
  ): Promise<string> {
    await this.ensureInit();

    const id = crypto.randomUUID();
    const queuedOp: QueuedOperation = {
      ...operation,
      id,
      timestamp: Date.now(),
      retryCount: 0,
    };

    await this.db!.put(STORE_NAME, queuedOp);
    return id;
  }

  async getAll(): Promise<QueuedOperation[]> {
    await this.ensureInit();
    return this.db!.getAll(STORE_NAME);
  }

  async getPending(): Promise<QueuedOperation[]> {
    const all = await this.getAll();
    return all
      .filter((op) => op.retryCount < MAX_RETRIES)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  async remove(id: string): Promise<void> {
    await this.ensureInit();
    await this.db!.delete(STORE_NAME, id);
  }

  async incrementRetry(id: string): Promise<void> {
    await this.ensureInit();
    const op = await this.db!.get(STORE_NAME, id);
    if (op) {
      op.retryCount++;
      await this.db!.put(STORE_NAME, op);
    }
  }

  async flush(): Promise<{ success: number; failed: number }> {
    if (!this.isOnline || this.flushInProgress) {
      return { success: 0, failed: 0 };
    }

    this.flushInProgress = true;
    let success = 0;
    let failed = 0;

    try {
      const operations = await this.getPending();

      for (const op of operations) {
        try {
          await this.executeOperation(op);
          await this.remove(op.id);
          success++;
        } catch (error) {
          console.error("Failed to execute queued operation", op, error);
          await this.incrementRetry(op.id);
          failed++;

          // Stop on first failure to maintain order
          if (op.retryCount >= MAX_RETRIES - 1) {
            // Move to dead letter (keep in queue but stop retrying)
            continue;
          }
          break;
        }
      }
    } finally {
      this.flushInProgress = false;
    }

    return { success, failed };
  }

  private async executeOperation(op: QueuedOperation): Promise<void> {
    const response = await fetch("/api/offline-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        table: op.table,
        operation: op.operation,
        data: op.data,
      }),
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status} ${response.statusText}`);
    }
  }

  async clear(): Promise<void> {
    await this.ensureInit();
    await this.db!.clear(STORE_NAME);
  }

  getOnlineStatus(): boolean {
    return this.isOnline;
  }
}

export const offlineQueue = new OfflineQueue();
