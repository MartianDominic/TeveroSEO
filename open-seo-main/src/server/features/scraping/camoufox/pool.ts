/**
 * CamoufoxPool - Production browser pool for TeveroSEO scraping infrastructure
 *
 * Manages a pool of Camoufox browser instances with:
 * - Automatic instance recycling (requests, age, memory)
 * - Health monitoring and auto-recovery
 * - Weighted load balancing
 * - Geonode proxy integration
 * - Graceful shutdown
 *
 * @see .planning/phases/95-scraping-infrastructure/CAMOUFOX-VPS-INFRASTRUCTURE.md
 *
 * IMPLEMENTATION NOTE: This file is a specification created during Phase 95 planning.
 * Before implementation, install required dependencies:
 *   pnpm add playwright-core camoufox-js
 *   npx camoufox-js fetch
 */

// @ts-expect-error - Dependencies installed during implementation phase
import { Browser, BrowserContext, Page } from "playwright-core";
import { EventEmitter } from "events";

// Re-export for external use
export type { Browser, BrowserContext, Page };

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface PoolConfig {
  // Pool sizing
  minInstances: number;
  maxInstances: number;

  // Instance lifecycle
  maxRequestsPerInstance: number;
  maxInstanceAgeMinutes: number;
  maxMemoryMB: number;
  maxConsecutiveFailures: number;

  // Concurrency
  maxPagesPerInstance: number;

  // Timeouts
  instanceLaunchTimeoutMs: number;
  pageCreationTimeoutMs: number;
  operationTimeoutMs: number;

  // Health checking
  healthCheckIntervalMs: number;
  healthCheckTimeoutMs: number;

  // Camoufox options
  camoufoxOptions: CamoufoxOptions;

  // Proxy factory (for rotation)
  proxyFactory?: () => ProxyConfig | undefined;
}

export interface CamoufoxOptions {
  headless: "virtual" | boolean;
  os?: Array<"windows" | "macos" | "linux">;
  geoip?: boolean;
  humanize?: number;
  blockImages?: boolean;
  blockWebrtc?: boolean;
  allowWebgl?: boolean;
  proxy?: ProxyConfig;
}

export interface ProxyConfig {
  server: string;
  username?: string;
  password?: string;
}

export interface InstanceState {
  id: string;
  browser: Browser;
  createdAt: Date;
  requestCount: number;
  activePages: number;
  consecutiveFailures: number;
  lastHealthCheck: Date;
  healthStatus: "healthy" | "degraded" | "unhealthy";
  memoryMB: number;
  state: "warming" | "ready" | "busy" | "recycling" | "dead";
}

export interface PoolMetrics {
  totalInstances: number;
  healthyInstances: number;
  activeRequests: number;
  queueDepth: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTimeMs: number;
  memoryUsedGB: number;
}

export interface PageHandle {
  instanceId: string;
  page: Page;
  context: BrowserContext;
  acquiredAt: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_POOL_CONFIG: PoolConfig = {
  minInstances: 10,
  maxInstances: 50,
  maxRequestsPerInstance: 100,
  maxInstanceAgeMinutes: 30,
  maxMemoryMB: 400,
  maxConsecutiveFailures: 3,
  maxPagesPerInstance: 5,
  instanceLaunchTimeoutMs: 30000,
  pageCreationTimeoutMs: 5000,
  operationTimeoutMs: 60000,
  healthCheckIntervalMs: 30000,
  healthCheckTimeoutMs: 5000,
  camoufoxOptions: {
    headless: "virtual",
    os: ["windows", "macos"],
    geoip: true,
    humanize: 2.0,
    blockImages: true,
    blockWebrtc: true,
    allowWebgl: false,
  },
};

// ============================================================================
// Semaphore Implementation
// ============================================================================

class Semaphore {
  private permits: number;
  private queue: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
    timeoutId?: NodeJS.Timeout;
  }> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  get available(): number {
    return this.permits;
  }

  async acquire(timeoutMs?: number): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise((resolve, reject) => {
      const item = {
        resolve,
        reject,
        timeoutId: undefined as NodeJS.Timeout | undefined,
      };

      if (timeoutMs) {
        item.timeoutId = setTimeout(() => {
          const index = this.queue.indexOf(item);
          if (index >= 0) {
            this.queue.splice(index, 1);
            reject(new Error("Semaphore acquire timeout"));
          }
        }, timeoutMs);
      }

      this.queue.push(item);
    });
  }

  release(): void {
    if (this.queue.length > 0) {
      const item = this.queue.shift()!;
      if (item.timeoutId) {
        clearTimeout(item.timeoutId);
      }
      item.resolve();
    } else {
      this.permits++;
    }
  }
}

// ============================================================================
// CamoufoxPool Implementation
// ============================================================================

export class CamoufoxPool extends EventEmitter {
  private config: PoolConfig;
  private instances: Map<string, InstanceState> = new Map();
  private pageQueue: Array<{
    resolve: (handle: PageHandle) => void;
    reject: (error: Error) => void;
    queuedAt: number;
  }> = [];

  // Semaphores for concurrency control
  private instanceSemaphore: Semaphore;
  private pageSemaphore: Semaphore;

  // Metrics
  private metrics: PoolMetrics = {
    totalInstances: 0,
    healthyInstances: 0,
    activeRequests: 0,
    queueDepth: 0,
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    avgResponseTimeMs: 0,
    memoryUsedGB: 0,
  };

  // Background tasks
  private healthCheckInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  private isShuttingDown = false;

  // Camoufox launcher (lazy loaded)
  private camoufoxModule: { Camoufox: (options: CamoufoxOptions) => Promise<Browser> } | null = null;

  constructor(config: Partial<PoolConfig> = {}) {
    super();
    this.config = { ...DEFAULT_POOL_CONFIG, ...config };

    this.instanceSemaphore = new Semaphore(this.config.maxInstances);
    this.pageSemaphore = new Semaphore(
      this.config.maxInstances * this.config.maxPagesPerInstance
    );
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Initialize the pool with pre-warmed instances
   */
  async initialize(): Promise<void> {
    console.log(
      `[CamoufoxPool] Initializing with ${this.config.minInstances} instances...`
    );

    // Lazy load camoufox-js
    try {
      // @ts-expect-error - camoufox-js installed during implementation phase
      this.camoufoxModule = await import("camoufox-js");
    } catch (error) {
      throw new Error(
        `Failed to load camoufox-js: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }

    // Pre-warm minimum instances
    const warmupPromises: Promise<void>[] = [];

    for (let i = 0; i < this.config.minInstances; i++) {
      warmupPromises.push(
        this.createInstance().then(() => {}).catch((err) => {
          console.error(`[CamoufoxPool] Failed to create instance ${i}:`, err);
        })
      );

      // Stagger creation to avoid CPU spike
      if (warmupPromises.length % 4 === 0) {
        await Promise.all(warmupPromises);
        warmupPromises.length = 0;
        await this.sleep(500);
      }
    }

    await Promise.all(warmupPromises);

    // Start background tasks
    this.startHealthChecks();
    this.startCleanupTask();

    console.log(
      `[CamoufoxPool] Initialized with ${this.instances.size} instances`
    );
    this.emit("initialized", this.getMetrics());
  }

  /**
   * Acquire a page from the pool
   */
  async acquirePage(timeoutMs?: number): Promise<PageHandle> {
    const timeout = timeoutMs ?? this.config.operationTimeoutMs;

    // Check if shutting down
    if (this.isShuttingDown) {
      throw new Error("Pool is shutting down");
    }

    // Increment queue metrics
    this.metrics.queueDepth++;
    this.metrics.totalRequests++;

    try {
      // Wait for page semaphore
      await this.pageSemaphore.acquire(timeout);

      // Find best instance
      const instance = await this.selectBestInstance();

      if (!instance) {
        // Create new instance if possible
        if (this.instances.size < this.config.maxInstances) {
          await this.createInstance();
          return this.acquirePage(timeout);
        }
        throw new Error("No instances available");
      }

      // Create page in instance
      const context = await instance.browser.newContext();
      const page = await context.newPage();

      instance.activePages++;
      instance.requestCount++;
      instance.state = instance.activePages > 0 ? "busy" : "ready";

      this.metrics.activeRequests++;

      return {
        instanceId: instance.id,
        page,
        context,
        acquiredAt: Date.now(),
      };
    } catch (error) {
      this.metrics.failedRequests++;
      throw error;
    } finally {
      this.metrics.queueDepth--;
    }
  }

  /**
   * Release a page back to the pool
   */
  async releasePage(handle: PageHandle, success = true): Promise<void> {
    const instance = this.instances.get(handle.instanceId);

    // Close page and context
    try {
      await handle.page.close();
      await handle.context.close();
    } catch {
      // Page already closed
    }

    // Update instance state
    if (instance) {
      instance.activePages--;
      instance.state = instance.activePages > 0 ? "busy" : "ready";

      if (!success) {
        instance.consecutiveFailures++;
      } else {
        instance.consecutiveFailures = 0;
        this.metrics.successfulRequests++;
      }

      // Check if instance needs recycling
      if (this.shouldRecycleInstance(instance)) {
        this.scheduleRecycle(instance);
      }
    }

    // Update metrics
    this.metrics.activeRequests--;
    const responseTime = Date.now() - handle.acquiredAt;
    this.updateAvgResponseTime(responseTime);

    // Release semaphore
    this.pageSemaphore.release();

    // Process queue
    this.processQueue();
  }

  /**
   * Get current pool metrics
   */
  getMetrics(): PoolMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Gracefully shutdown the pool
   */
  async shutdown(timeoutMs = 30000): Promise<void> {
    console.log("[CamoufoxPool] Shutting down...");
    this.isShuttingDown = true;

    // Stop background tasks
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Reject queued requests
    for (const queued of this.pageQueue) {
      queued.reject(new Error("Pool is shutting down"));
    }
    this.pageQueue = [];

    // Close all instances
    const shutdownPromises = Array.from(this.instances.values()).map(
      (instance) => this.destroyInstance(instance, timeoutMs / 2)
    );

    await Promise.allSettled(shutdownPromises);

    // Cleanup orphan processes
    await this.cleanupOrphanProcesses();

    console.log("[CamoufoxPool] Shutdown complete");
    this.emit("shutdown");
  }

  // --------------------------------------------------------------------------
  // Instance Management
  // --------------------------------------------------------------------------

  private async createInstance(): Promise<InstanceState> {
    if (!this.camoufoxModule) {
      throw new Error("Camoufox module not loaded");
    }

    const id = this.generateInstanceId();
    console.log(`[CamoufoxPool] Creating instance ${id}...`);

    const options: CamoufoxOptions = {
      ...this.config.camoufoxOptions,
    };

    // Apply proxy if factory provided
    if (this.config.proxyFactory) {
      const proxy = this.config.proxyFactory();
      if (proxy) {
        options.proxy = proxy;
      }
    }

    const browser = (await Promise.race([
      this.camoufoxModule.Camoufox(options),
      this.timeoutPromise(
        this.config.instanceLaunchTimeoutMs,
        `Instance ${id} launch timeout`
      ),
    ])) as Browser;

    const instance: InstanceState = {
      id,
      browser,
      createdAt: new Date(),
      requestCount: 0,
      activePages: 0,
      consecutiveFailures: 0,
      lastHealthCheck: new Date(),
      healthStatus: "healthy",
      memoryMB: 200, // Initial estimate
      state: "ready",
    };

    this.instances.set(id, instance);
    this.metrics.totalInstances++;

    console.log(`[CamoufoxPool] Instance ${id} created`);
    this.emit("instanceCreated", id);

    return instance;
  }

  private async destroyInstance(
    instance: InstanceState,
    timeoutMs = 10000
  ): Promise<void> {
    console.log(`[CamoufoxPool] Destroying instance ${instance.id}...`);
    instance.state = "dead";

    try {
      // Close all contexts
      const contexts = instance.browser.contexts();
      for (const context of contexts) {
        try {
          await Promise.race([context.close(), this.sleep(2000)]);
        } catch {
          // Context close failed
        }
      }

      // Close browser
      await Promise.race([instance.browser.close(), this.sleep(5000)]);
    } catch {
      // Force kill
      const pid = instance.browser.process()?.pid;
      if (pid) {
        try {
          process.kill(pid, "SIGKILL");
        } catch {
          // Process already dead
        }
      }
    }

    this.instances.delete(instance.id);
    this.metrics.totalInstances--;

    console.log(`[CamoufoxPool] Instance ${instance.id} destroyed`);
    this.emit("instanceDestroyed", instance.id);
  }

  private shouldRecycleInstance(instance: InstanceState): boolean {
    // Too many requests
    if (instance.requestCount >= this.config.maxRequestsPerInstance) {
      return true;
    }

    // Too old
    const ageMinutes = (Date.now() - instance.createdAt.getTime()) / 60000;
    if (ageMinutes >= this.config.maxInstanceAgeMinutes) {
      return true;
    }

    // Memory pressure
    if (instance.memoryMB >= this.config.maxMemoryMB) {
      return true;
    }

    // Too many failures
    if (instance.consecutiveFailures >= this.config.maxConsecutiveFailures) {
      return true;
    }

    return false;
  }

  private async scheduleRecycle(instance: InstanceState): Promise<void> {
    // Don't recycle if already recycling or has active pages
    if (instance.state === "recycling" || instance.activePages > 0) {
      return;
    }

    instance.state = "recycling";

    // Destroy and recreate
    await this.destroyInstance(instance);

    // Create replacement if below minimum
    if (this.instances.size < this.config.minInstances) {
      await this.createInstance();
    }
  }

  // --------------------------------------------------------------------------
  // Instance Selection
  // --------------------------------------------------------------------------

  private async selectBestInstance(): Promise<InstanceState | null> {
    let bestInstance: InstanceState | null = null;
    let bestScore = Infinity;

    for (const instance of this.instances.values()) {
      // Skip unavailable instances
      if (instance.state !== "ready" && instance.state !== "busy") {
        continue;
      }

      // Skip at capacity
      if (instance.activePages >= this.config.maxPagesPerInstance) {
        continue;
      }

      // Calculate score (lower = better)
      const score = this.calculateInstanceScore(instance);

      if (score < bestScore) {
        bestScore = score;
        bestInstance = instance;
      }
    }

    return bestInstance;
  }

  private calculateInstanceScore(instance: InstanceState): number {
    // Load factor (0-1)
    const loadFactor = instance.activePages / this.config.maxPagesPerInstance;

    // Age factor (0-1, older = higher)
    const ageMinutes = (Date.now() - instance.createdAt.getTime()) / 60000;
    const ageFactor = Math.min(
      1,
      ageMinutes / this.config.maxInstanceAgeMinutes
    );

    // Request factor (0-1, more requests = higher)
    const requestFactor = Math.min(
      1,
      instance.requestCount / this.config.maxRequestsPerInstance
    );

    // Health factor (0, 0.5, or 1)
    const healthFactor =
      instance.healthStatus === "healthy"
        ? 0
        : instance.healthStatus === "degraded"
          ? 0.5
          : 1;

    // Weighted score
    return (
      loadFactor * 0.4 + ageFactor * 0.2 + requestFactor * 0.2 + healthFactor * 0.2
    );
  }

  // --------------------------------------------------------------------------
  // Health Checking
  // --------------------------------------------------------------------------

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(
      () => this.runHealthChecks(),
      this.config.healthCheckIntervalMs
    );
  }

  private async runHealthChecks(): Promise<void> {
    const checks = Array.from(this.instances.values()).map((instance) =>
      this.healthCheckInstance(instance)
    );

    await Promise.allSettled(checks);
    this.updateMetrics();
  }

  private async healthCheckInstance(instance: InstanceState): Promise<void> {
    // Skip if busy or already checking
    if (instance.activePages > 0) {
      return;
    }

    try {
      const context = (await Promise.race([
        instance.browser.newContext(),
        this.timeoutPromise(this.config.healthCheckTimeoutMs, "Health check timeout"),
      ])) as BrowserContext;

      const page = await context.newPage();

      await page.evaluate(() => ({ healthy: true, timestamp: Date.now() }));

      await page.close();
      await context.close();

      instance.healthStatus = "healthy";
      instance.lastHealthCheck = new Date();
    } catch {
      instance.healthStatus = "unhealthy";
      instance.consecutiveFailures++;

      if (instance.consecutiveFailures >= this.config.maxConsecutiveFailures) {
        this.scheduleRecycle(instance);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Cleanup Tasks
  // --------------------------------------------------------------------------

  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(() => this.runCleanup(), 60000);
  }

  private async runCleanup(): Promise<void> {
    // Find instances that need recycling
    for (const instance of this.instances.values()) {
      if (this.shouldRecycleInstance(instance) && instance.activePages === 0) {
        await this.scheduleRecycle(instance);
      }
    }

    // Cleanup orphan processes
    await this.cleanupOrphanProcesses();
  }

  private async cleanupOrphanProcesses(): Promise<void> {
    const processNames = ["firefox", "firefox-esr", "camoufox"];

    for (const name of processNames) {
      try {
        const { exec } = await import("child_process");
        const { promisify } = await import("util");
        const execAsync = promisify(exec);

        // Find orphaned processes (PPID = 1, older than 5 minutes)
        const { stdout } = await execAsync(
          `pgrep -P 1 -x ${name} 2>/dev/null || true`
        );

        const pids = stdout.trim().split("\n").filter(Boolean);

        for (const pid of pids) {
          try {
            const { stdout: etime } = await execAsync(
              `ps -o etimes= -p ${pid} 2>/dev/null || echo 0`
            );

            const ageSeconds = parseInt(etime.trim(), 10);

            if (ageSeconds > 300) {
              // 5 minutes
              process.kill(parseInt(pid, 10), "SIGKILL");
              console.log(`[CamoufoxPool] Killed orphan ${name} process ${pid}`);
            }
          } catch {
            // Process already dead
          }
        }
      } catch {
        // pgrep not available
      }
    }
  }

  // --------------------------------------------------------------------------
  // Queue Management
  // --------------------------------------------------------------------------

  private processQueue(): void {
    while (this.pageQueue.length > 0 && this.pageSemaphore.available > 0) {
      const queued = this.pageQueue.shift();
      if (queued) {
        this.acquirePage().then(queued.resolve).catch(queued.reject);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Metrics
  // --------------------------------------------------------------------------

  private updateMetrics(): void {
    let healthyCount = 0;
    let totalMemory = 0;

    for (const instance of this.instances.values()) {
      if (instance.healthStatus === "healthy") {
        healthyCount++;
      }
      totalMemory += instance.memoryMB;
    }

    this.metrics.healthyInstances = healthyCount;
    this.metrics.memoryUsedGB = totalMemory / 1024;
  }

  private updateAvgResponseTime(latencyMs: number): void {
    // Exponential moving average
    const alpha = 0.1;
    this.metrics.avgResponseTimeMs =
      alpha * latencyMs + (1 - alpha) * this.metrics.avgResponseTimeMs;
  }

  // --------------------------------------------------------------------------
  // Utility Methods
  // --------------------------------------------------------------------------

  private generateInstanceId(): string {
    return `cf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private timeoutPromise(ms: number, message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a CamoufoxPool with Geonode proxy integration
 */
export function createGeonodePool(config?: Partial<PoolConfig>): CamoufoxPool {
  const geonodeHost = process.env.GEONODE_HOST || "proxy.geonode.io";
  const geonodePort = process.env.GEONODE_PORT_ROTATING || "9000";
  const geonodeUsername = process.env.GEONODE_USERNAME;
  const geonodePassword = process.env.GEONODE_PASSWORD;

  if (!geonodeUsername || !geonodePassword) {
    console.warn(
      "[CamoufoxPool] GEONODE_USERNAME or GEONODE_PASSWORD not set. Running without proxy."
    );
  }

  return new CamoufoxPool({
    ...config,
    proxyFactory:
      geonodeUsername && geonodePassword
        ? () => ({
            server: `http://${geonodeHost}:${geonodePort}`,
            username: geonodeUsername,
            password: geonodePassword,
          })
        : undefined,
  });
}

/**
 * Create a minimal pool for development/testing
 */
export function createDevPool(): CamoufoxPool {
  return new CamoufoxPool({
    minInstances: 2,
    maxInstances: 5,
    maxPagesPerInstance: 3,
    camoufoxOptions: {
      headless: true,
      blockImages: true,
      blockWebrtc: true,
      allowWebgl: false,
    },
  });
}
