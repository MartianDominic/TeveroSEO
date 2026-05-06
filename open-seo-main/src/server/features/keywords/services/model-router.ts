/**
 * ModelRouter: Progressive model selection for cost optimization.
 * Phase 83 Wave 4: Cost Controls
 * Phase 86: Multi-backend support (direct, Azure AI, OpenRouter)
 *
 * Routes tasks to the cheapest model that can handle them.
 * Supports multiple provider backends per model family.
 */

import { CircuitBreaker } from "./CircuitBreaker";
import { resolveProvider, type ProviderConfig } from "./provider-config";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "ModelRouter" });

export interface ModelConfig {
  id: string;
  provider: "groq" | "grok" | "openai" | "gemini" | "claude";
  costPerMToken: { input: number; output: number };
  capabilities: Set<string>;
  maxBatchSize: number;
  rateLimit: number; // RPM
}

export interface TokenUsage {
  input: number;
  output: number;
}

export interface ModelCallResult {
  result: string;
  model: string;
  cost: number;
  usage: TokenUsage;
}

export type TaskType = "classification" | "labeling" | "reasoning" | "lithuanian_complex";

const MODELS: ModelConfig[] = [
  {
    id: "llama-3.1-8b-instant",
    provider: "groq",
    costPerMToken: { input: 0.05, output: 0.08 },
    capabilities: new Set(["classification", "simple_labeling"]),
    maxBatchSize: 200,
    rateLimit: 6000,
  },
  {
    id: "llama-3.3-70b",
    provider: "groq",
    costPerMToken: { input: 0.59, output: 0.79 },
    capabilities: new Set(["classification", "labeling", "reasoning", "lithuanian_complex"]),
    maxBatchSize: 100,
    rateLimit: 1000,
  },
  {
    id: "grok-2-mini",
    provider: "grok",
    costPerMToken: { input: 0.3, output: 1.0 },
    capabilities: new Set(["classification", "labeling", "reasoning"]),
    maxBatchSize: 50,
    rateLimit: 60,
  },
];

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export class ModelRouter {
  private circuitBreakers = new Map<string, CircuitBreaker>();

  selectModel(task: TaskType, batchSize: number): ModelConfig {
    // Filter by capability and batch size
    const candidates = MODELS.filter(
      (m) =>
        m.capabilities.has(task) &&
        m.maxBatchSize >= batchSize &&
        !this.getOrCreateBreaker(m.id).isOpen
    );

    if (candidates.length === 0) {
      throw new Error(`No model available for task: ${task}`);
    }

    // Sort by cost (cheapest first)
    candidates.sort(
      (a, b) =>
        a.costPerMToken.input +
        a.costPerMToken.output -
        (b.costPerMToken.input + b.costPerMToken.output)
    );

    log.debug("Model selected", {
      task,
      batchSize,
      model: candidates[0].id,
      candidateCount: candidates.length,
    });

    return candidates[0];
  }

  async call(
    task: TaskType,
    messages: Message[],
    batchSize: number = 1
  ): Promise<ModelCallResult> {
    const model = this.selectModel(task, batchSize);
    const breaker = this.getOrCreateBreaker(model.id);

    return breaker.execute(async () => {
      const response = await this.callProvider(model, messages);
      const cost = this.calculateCost(model, response.usage);

      breaker.recordSuccess();

      log.info("Model call completed", {
        model: model.id,
        task,
        cost: cost.toFixed(6),
        inputTokens: response.usage.input,
        outputTokens: response.usage.output,
      });

      return {
        result: response.content,
        model: model.id,
        cost,
        usage: response.usage,
      };
    });
  }

  private async callProvider(
    model: ModelConfig,
    messages: Message[]
  ): Promise<{ content: string; usage: TokenUsage }> {
    // Resolve provider backend (direct, azure, or openrouter)
    const providerConfig = resolveProvider(model.id);
    return this.callWithConfig(providerConfig, messages);
  }

  /**
   * Unified call method using provider configuration.
   * Supports direct APIs, Azure AI, and OpenRouter.
   */
  private async callWithConfig(
    config: ProviderConfig,
    messages: Message[]
  ): Promise<{ content: string; usage: TokenUsage }> {
    const { endpoint } = config;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...endpoint.headers,
    };

    // Azure uses api-key header, others use Bearer token
    if (config.backend === "azure") {
      headers["api-key"] = endpoint.apiKey;
    } else {
      headers["Authorization"] = `Bearer ${endpoint.apiKey}`;
    }

    const response = await fetch(`${endpoint.baseURL}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: endpoint.modelName,
        messages,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      log.error(
        `Provider API error: ${config.backend} ${endpoint.modelName} status=${response.status}`
      );
      throw new Error(
        `${config.backend} API error: ${response.status} - ${errorText.slice(0, 100)}`
      );
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage: { prompt_tokens: number; completion_tokens: number };
    };

    return {
      content: data.choices[0]?.message?.content ?? "",
      usage: {
        input: data.usage.prompt_tokens,
        output: data.usage.completion_tokens,
      },
    };
  }

  private calculateCost(model: ModelConfig, usage: TokenUsage): number {
    return (
      (usage.input / 1_000_000) * model.costPerMToken.input +
      (usage.output / 1_000_000) * model.costPerMToken.output
    );
  }

  private getOrCreateBreaker(modelId: string): CircuitBreaker {
    let breaker = this.circuitBreakers.get(modelId);
    if (!breaker) {
      breaker = new CircuitBreaker({
        name: `model-${modelId}`,
        failureThreshold: 5,
        resetTimeout: 60000,
      });
      this.circuitBreakers.set(modelId, breaker);
    }
    return breaker;
  }

  getAvailableModels(): ModelConfig[] {
    return MODELS.filter((m) => !this.getOrCreateBreaker(m.id).isOpen);
  }

  resetCircuits(): void {
    this.circuitBreakers.forEach((breaker) => breaker.reset());
    log.info("Model router circuits reset");
  }
}

export const modelRouter = new ModelRouter();
