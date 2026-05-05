/**
 * MemoryMonitor: Memory pressure monitoring using v8 heap stats.
 * Phase 83 Wave 3: Performance & Caching
 */

import v8 from "v8";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "MemoryMonitor" });

export interface MemoryStatus {
  heapUsed: number;
  heapTotal: number;
  usagePercent: number;
  status: "ok" | "warning" | "critical";
}

const THRESHOLDS = {
  warning: 0.7, // 70% heap used
  critical: 0.85, // 85% heap used
};

export class MemoryMonitor {
  private interval: NodeJS.Timeout | null = null;
  private listeners: ((status: MemoryStatus) => void)[] = [];

  start(intervalMs: number = 5000): void {
    if (this.interval) {
      return;
    }

    this.interval = setInterval(() => {
      const status = this.check();
      if (status.status !== "ok") {
        log.warn("Memory pressure detected", {
          status: status.status,
          usagePercent: Math.round(status.usagePercent * 100),
          heapUsedMB: Math.round(status.heapUsed / 1024 / 1024),
        });
        this.listeners.forEach((l) => l(status));
      }
    }, intervalMs);

    log.info("Memory monitor started", { intervalMs });
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      log.info("Memory monitor stopped");
    }
  }

  check(): MemoryStatus {
    const heap = v8.getHeapStatistics();
    const usagePercent = heap.used_heap_size / heap.heap_size_limit;

    let status: MemoryStatus["status"] = "ok";
    if (usagePercent > THRESHOLDS.critical) status = "critical";
    else if (usagePercent > THRESHOLDS.warning) status = "warning";

    return {
      heapUsed: heap.used_heap_size,
      heapTotal: heap.heap_size_limit,
      usagePercent,
      status,
    };
  }

  onPressure(callback: (status: MemoryStatus) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const idx = this.listeners.indexOf(callback);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  forceGC(): void {
    if (global.gc) {
      global.gc();
      log.info("Forced garbage collection");
    } else {
      log.warn("GC not exposed. Run node with --expose-gc flag");
    }
  }
}

export const memoryMonitor = new MemoryMonitor();
