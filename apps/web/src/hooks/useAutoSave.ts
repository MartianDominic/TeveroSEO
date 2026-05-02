/**
 * useAutoSave Hook - Auto-save with debounce and offline queue
 * Phase 57-06: Auto-Save + Version History
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useDebouncedCallback } from "use-debounce";

export type SaveStatus = "saved" | "saving" | "error" | "idle";

interface OfflineQueueItem {
  proposalId: string;
  content: unknown;
  timestamp: number;
}

// Offline queue storage key
const OFFLINE_QUEUE_KEY = "proposal_autosave_queue";

/**
 * Get offline queue from localStorage
 */
function getOfflineQueue(): OfflineQueueItem[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save offline queue to localStorage
 */
function saveOfflineQueue(queue: OfflineQueueItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Storage full or unavailable
  }
}

/**
 * Add item to offline queue
 */
function queueOfflineSave(proposalId: string, content: unknown): void {
  const queue = getOfflineQueue();
  // Replace existing entry for same proposal
  const filtered = queue.filter((item) => item.proposalId !== proposalId);
  filtered.push({ proposalId, content, timestamp: Date.now() });
  // Keep only last 10 items
  saveOfflineQueue(filtered.slice(-10));
}

/**
 * Remove item from offline queue
 */
function removeFromOfflineQueue(proposalId: string): void {
  const queue = getOfflineQueue();
  const filtered = queue.filter((item) => item.proposalId !== proposalId);
  saveOfflineQueue(filtered);
}

export interface UseAutoSaveOptions {
  /** Debounce delay in milliseconds (default: 2000) */
  debounceMs?: number;
  /** Save function that persists the content */
  onSave: (proposalId: string, content: unknown) => Promise<void>;
  /** Called when save succeeds */
  onSuccess?: () => void;
  /** Called when save fails */
  onError?: (error: Error) => void;
  /** Whether auto-save is enabled (default: true) */
  enabled?: boolean;
}

export interface UseAutoSaveReturn {
  /** Current save status */
  saveStatus: SaveStatus;
  /** Last successful save timestamp */
  lastSavedAt: Date | null;
  /** Manually trigger save */
  saveNow: () => Promise<void>;
  /** Number of items in offline queue */
  offlineQueueCount: number;
  /** Retry failed offline saves */
  retryOfflineSaves: () => Promise<void>;
}

/**
 * Auto-save hook with 2 second debounce, status tracking, and offline queue
 */
export function useAutoSave(
  proposalId: string,
  content: unknown,
  options: UseAutoSaveOptions
): UseAutoSaveReturn {
  const {
    debounceMs = 2000,
    onSave,
    onSuccess,
    onError,
    enabled = true,
  } = options;

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);

  // Track initial content to avoid saving on mount
  const initialContentRef = useRef<string | null>(null);
  const contentStringRef = useRef<string>("");

  // Serialize content for comparison
  const contentString = JSON.stringify(content);

  // Update offline queue count
  useEffect(() => {
    setOfflineQueueCount(getOfflineQueue().length);
  }, []);

  // Core save function
  const performSave = useCallback(
    async (contentToSave: unknown) => {
      if (!proposalId) return;

      setSaveStatus("saving");

      try {
        await onSave(proposalId, contentToSave);
        setSaveStatus("saved");
        setLastSavedAt(new Date());
        removeFromOfflineQueue(proposalId);
        setOfflineQueueCount(getOfflineQueue().length);
        onSuccess?.();
      } catch (err) {
        setSaveStatus("error");
        queueOfflineSave(proposalId, contentToSave);
        setOfflineQueueCount(getOfflineQueue().length);
        onError?.(err instanceof Error ? err : new Error("Save failed"));
      }
    },
    [proposalId, onSave, onSuccess, onError]
  );

  // Debounced save
  const debouncedSave = useDebouncedCallback(performSave, debounceMs);

  // Track content changes and trigger auto-save
  useEffect(() => {
    // Set initial content on first render
    if (initialContentRef.current === null) {
      initialContentRef.current = contentString;
      contentStringRef.current = contentString;
      return;
    }

    // Skip if content hasn't changed
    if (contentString === contentStringRef.current) {
      return;
    }

    contentStringRef.current = contentString;

    // Skip if disabled
    if (!enabled) return;

    // Trigger debounced save
    debouncedSave(content);
  }, [contentString, content, enabled, debouncedSave]);

  // Manual save function
  const saveNow = useCallback(async () => {
    debouncedSave.cancel();
    await performSave(content);
  }, [content, performSave, debouncedSave]);

  // Retry offline saves
  const retryOfflineSaves = useCallback(async () => {
    const queue = getOfflineQueue();
    if (queue.length === 0) return;

    for (const item of queue) {
      try {
        await onSave(item.proposalId, item.content);
        removeFromOfflineQueue(item.proposalId);
      } catch {
        // Keep in queue for next retry
      }
    }

    setOfflineQueueCount(getOfflineQueue().length);
  }, [onSave]);

  // Attempt to process offline queue when online
  useEffect(() => {
    const handleOnline = () => {
      retryOfflineSaves();
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [retryOfflineSaves]);

  return {
    saveStatus,
    lastSavedAt,
    saveNow,
    offlineQueueCount,
    retryOfflineSaves,
  };
}
