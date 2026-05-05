/**
 * IndexedDB checkpoint manager for keyword analysis progress.
 *
 * Persists analysis state to browser storage, enabling:
 * - Resume after browser refresh/crash
 * - Recovery from network interruptions
 * - Partial results preservation
 *
 * @module client/features/keywords/lib/checkpoint-manager
 */

import { openDB, type IDBPDatabase } from "idb";

export interface PartialKeyword {
  keyword: string;
  volume?: number | null;
  difficulty?: number | null;
  cpc?: number | null;
  intent?: string;
}

export interface PartialCluster {
  id: string;
  label: string;
  keywords: PartialKeyword[];
}

export interface PartialScore {
  clusterId: string;
  priorityScore: number;
  opportunityScore?: number;
}

export interface PartialResults {
  keywords?: PartialKeyword[];
  clusters?: PartialCluster[];
  scores?: PartialScore[];
}

export interface AnalysisCheckpoint {
  sessionId: string;
  timestamp: number;
  stage: "constraints" | "embedding" | "clustering" | "scoring" | "labeling" | "complete";
  progress: number;
  keywords: Array<{ keyword: string }>;
  context?: string;
  partialResults?: PartialResults;
}

const DB_NAME = "keyword-analysis";
const DB_VERSION = 1;
const STORE_NAME = "checkpoints";
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

class CheckpointManager {
  private db: IDBPDatabase | null = null;
  private initPromise: Promise<void> | null = null;

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
            const store = db.createObjectStore(STORE_NAME, { keyPath: "sessionId" });
            store.createIndex("timestamp", "timestamp");
          }
        },
      });
    } catch (error) {
      console.error("Failed to initialize IndexedDB for checkpoints:", error);
      throw error;
    }
  }

  async saveCheckpoint(checkpoint: AnalysisCheckpoint): Promise<void> {
    await this.ensureInit();

    const checkpointWithTimestamp: AnalysisCheckpoint = {
      ...checkpoint,
      timestamp: Date.now(),
    };

    await this.db!.put(STORE_NAME, checkpointWithTimestamp);
  }

  async getCheckpoint(sessionId: string): Promise<AnalysisCheckpoint | null> {
    await this.ensureInit();

    const checkpoint = await this.db!.get(STORE_NAME, sessionId);
    return checkpoint ?? null;
  }

  async getLatestCheckpoint(): Promise<AnalysisCheckpoint | null> {
    await this.ensureInit();

    const all = await this.db!.getAll(STORE_NAME);
    if (all.length === 0) return null;

    // Filter out old checkpoints and completed ones
    const validCheckpoints = all.filter(
      (cp: AnalysisCheckpoint) => cp.timestamp > Date.now() - MAX_AGE_MS && cp.stage !== "complete"
    );

    if (validCheckpoints.length === 0) return null;

    // Return most recent
    return validCheckpoints.sort((a: AnalysisCheckpoint, b: AnalysisCheckpoint) => b.timestamp - a.timestamp)[0];
  }

  async getAllCheckpoints(): Promise<AnalysisCheckpoint[]> {
    await this.ensureInit();
    return this.db!.getAll(STORE_NAME);
  }

  async clearCheckpoint(sessionId: string): Promise<void> {
    await this.ensureInit();
    await this.db!.delete(STORE_NAME, sessionId);
  }

  async clearOldCheckpoints(maxAgeMs: number = MAX_AGE_MS): Promise<number> {
    await this.ensureInit();

    const all = await this.db!.getAll(STORE_NAME);
    const cutoff = Date.now() - maxAgeMs;
    let cleared = 0;

    for (const checkpoint of all) {
      if (checkpoint.timestamp < cutoff) {
        await this.db!.delete(STORE_NAME, checkpoint.sessionId);
        cleared++;
      }
    }

    return cleared;
  }

  async clearAllCheckpoints(): Promise<void> {
    await this.ensureInit();
    await this.db!.clear(STORE_NAME);
  }
}

export const checkpointManager = new CheckpointManager();
