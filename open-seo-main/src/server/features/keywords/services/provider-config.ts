/**
 * LLM Provider Configuration
 * Phase 86: Multi-Backend Support
 *
 * Supports routing models through different backends:
 * - Direct API (xAI, Google, Anthropic, Groq)
 * - Azure AI (for xAI Grok models)
 * - OpenRouter (unified gateway to all models)
 *
 * Configuration via environment variables allows:
 * 1. Per-model-family backend selection
 * 2. Global OpenRouter override
 * 3. Fallback chain for resilience
 */

import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "ProviderConfig" });

// ============================================================================
// Types
// ============================================================================

export type ProviderBackend = "direct" | "azure" | "openrouter";

export type ModelFamily = "grok" | "gemini" | "claude" | "groq" | "openai";

export interface ProviderEndpoint {
  baseURL: string;
  apiKey: string;
  modelName: string; // May differ from canonical name (e.g., OpenRouter prefixes)
  headers?: Record<string, string>;
}

export interface ProviderConfig {
  family: ModelFamily;
  backend: ProviderBackend;
  endpoint: ProviderEndpoint;
}

// ============================================================================
// OpenRouter Model Mapping
// ============================================================================

const OPENROUTER_MODEL_MAP: Record<string, string> = {
  // Grok models
  "grok-4.1-fast": "x-ai/grok-4.1-fast",
  "grok-4.1": "x-ai/grok-4.1",
  "grok-2-mini": "x-ai/grok-2-mini",

  // Gemini models
  "gemini-2.5-pro": "google/gemini-2.5-pro",
  "gemini-2.5-flash": "google/gemini-2.5-flash",
  "gemini-2.5-flash-lite": "google/gemini-2.5-flash-lite",
  "gemini-3.1-pro": "google/gemini-3.1-pro",

  // Claude models
  "claude-sonnet-4": "anthropic/claude-sonnet-4",
  "claude-sonnet-4-20250514": "anthropic/claude-sonnet-4",
  "claude-opus-4": "anthropic/claude-opus-4",
  "claude-haiku-4": "anthropic/claude-haiku-4",

  // Llama models (Groq)
  "llama-3.1-8b-instant": "meta-llama/llama-3.1-8b-instant",
  "llama-3.3-70b": "meta-llama/llama-3.3-70b-instruct",
  "llama-3.3-70b-versatile": "meta-llama/llama-3.3-70b-instruct",
};

// ============================================================================
// Environment Configuration
// ============================================================================

interface EnvConfig {
  // Global override
  useOpenRouter: boolean;

  // Per-family backend selection
  grokBackend: ProviderBackend;
  geminiBackend: ProviderBackend;
  claudeBackend: ProviderBackend;
  groqBackend: ProviderBackend;

  // Direct provider keys
  xaiApiKey?: string;
  googleAiApiKey?: string;
  anthropicApiKey?: string;
  groqApiKey?: string;
  openaiApiKey?: string;

  // Azure AI
  azureAiEndpoint?: string;
  azureAiApiKey?: string;
  azureGrokDeployment?: string;

  // OpenRouter
  openrouterApiKey?: string;
  openrouterSiteUrl?: string;
  openrouterAppName?: string;
}

function loadEnvConfig(): EnvConfig {
  const useOpenRouter = process.env.USE_OPENROUTER === "true";

  return {
    useOpenRouter,

    // Per-family backend (default to 'direct' unless USE_OPENROUTER is set)
    grokBackend: useOpenRouter
      ? "openrouter"
      : (process.env.GROK_BACKEND as ProviderBackend) || "direct",
    geminiBackend: useOpenRouter
      ? "openrouter"
      : (process.env.GEMINI_BACKEND as ProviderBackend) || "direct",
    claudeBackend: useOpenRouter
      ? "openrouter"
      : (process.env.CLAUDE_BACKEND as ProviderBackend) || "direct",
    groqBackend: useOpenRouter
      ? "openrouter"
      : (process.env.GROQ_BACKEND as ProviderBackend) || "direct",

    // Direct provider keys
    xaiApiKey: process.env.XAI_API_KEY,
    googleAiApiKey: process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    groqApiKey: process.env.GROQ_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,

    // Azure AI
    azureAiEndpoint: process.env.AZURE_AI_ENDPOINT,
    azureAiApiKey: process.env.AZURE_AI_API_KEY,
    azureGrokDeployment: process.env.AZURE_GROK_DEPLOYMENT || "grok-4-1-fast",

    // OpenRouter
    openrouterApiKey: process.env.OPENROUTER_API_KEY,
    openrouterSiteUrl: process.env.OPENROUTER_SITE_URL || "https://teveroseo.com",
    openrouterAppName: process.env.OPENROUTER_APP_NAME || "TeveroSEO",
  };
}

// ============================================================================
// Provider Resolution
// ============================================================================

function getModelFamily(modelId: string): ModelFamily {
  if (modelId.startsWith("grok")) return "grok";
  if (modelId.startsWith("gemini")) return "gemini";
  if (modelId.startsWith("claude")) return "claude";
  if (modelId.startsWith("llama")) return "groq";
  if (modelId.startsWith("gpt")) return "openai";
  throw new Error(`Unknown model family for: ${modelId}`);
}

function getDirectEndpoint(
  family: ModelFamily,
  modelId: string,
  env: EnvConfig
): ProviderEndpoint {
  switch (family) {
    case "grok":
      if (!env.xaiApiKey) throw new Error("XAI_API_KEY not configured");
      return {
        baseURL: "https://api.x.ai/v1",
        apiKey: env.xaiApiKey,
        modelName: modelId,
      };

    case "gemini":
      if (!env.googleAiApiKey)
        throw new Error("GOOGLE_AI_API_KEY not configured");
      return {
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
        apiKey: env.googleAiApiKey,
        modelName: modelId,
      };

    case "claude":
      if (!env.anthropicApiKey)
        throw new Error("ANTHROPIC_API_KEY not configured");
      return {
        baseURL: "https://api.anthropic.com/v1",
        apiKey: env.anthropicApiKey,
        modelName: modelId,
        headers: {
          "anthropic-version": "2024-06-01",
        },
      };

    case "groq":
      if (!env.groqApiKey) throw new Error("GROQ_API_KEY not configured");
      return {
        baseURL: "https://api.groq.com/openai/v1",
        apiKey: env.groqApiKey,
        modelName: modelId,
      };

    case "openai":
      if (!env.openaiApiKey) throw new Error("OPENAI_API_KEY not configured");
      return {
        baseURL: "https://api.openai.com/v1",
        apiKey: env.openaiApiKey,
        modelName: modelId,
      };

    default:
      throw new Error(`No direct endpoint for family: ${family}`);
  }
}

function getAzureEndpoint(
  family: ModelFamily,
  modelId: string,
  env: EnvConfig
): ProviderEndpoint {
  if (family !== "grok") {
    throw new Error(`Azure AI backend only supports Grok models, got: ${family}`);
  }

  if (!env.azureAiEndpoint) throw new Error("AZURE_AI_ENDPOINT not configured");
  if (!env.azureAiApiKey) throw new Error("AZURE_AI_API_KEY not configured");

  return {
    baseURL: env.azureAiEndpoint,
    apiKey: env.azureAiApiKey,
    modelName: env.azureGrokDeployment || modelId,
    headers: {
      "api-key": env.azureAiApiKey,
    },
  };
}

function getOpenRouterEndpoint(
  _family: ModelFamily,
  modelId: string,
  env: EnvConfig
): ProviderEndpoint {
  if (!env.openrouterApiKey)
    throw new Error("OPENROUTER_API_KEY not configured");

  const openrouterModel = OPENROUTER_MODEL_MAP[modelId];
  if (!openrouterModel) {
    log.warn("Model not in OpenRouter map, using as-is", { modelId });
  }

  return {
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: env.openrouterApiKey,
    modelName: openrouterModel || modelId,
    headers: {
      "HTTP-Referer": env.openrouterSiteUrl || "",
      "X-Title": env.openrouterAppName || "",
    },
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Resolve provider configuration for a model.
 *
 * Priority:
 * 1. USE_OPENROUTER=true → all models via OpenRouter
 * 2. {FAMILY}_BACKEND=azure|openrouter → specific backend
 * 3. Default: direct API
 *
 * @param modelId - The canonical model ID (e.g., "grok-4.1-fast")
 * @returns Provider configuration with endpoint details
 */
export function resolveProvider(modelId: string): ProviderConfig {
  const env = loadEnvConfig();
  const family = getModelFamily(modelId);

  // Determine backend for this model family
  let backend: ProviderBackend;
  switch (family) {
    case "grok":
      backend = env.grokBackend;
      break;
    case "gemini":
      backend = env.geminiBackend;
      break;
    case "claude":
      backend = env.claudeBackend;
      break;
    case "groq":
      backend = env.groqBackend;
      break;
    case "openai":
      backend = "direct"; // OpenAI always direct (no Azure/OpenRouter override)
      break;
    default:
      backend = "direct";
  }

  // Resolve endpoint based on backend
  let endpoint: ProviderEndpoint;
  switch (backend) {
    case "azure":
      endpoint = getAzureEndpoint(family, modelId, env);
      break;
    case "openrouter":
      endpoint = getOpenRouterEndpoint(family, modelId, env);
      break;
    case "direct":
    default:
      endpoint = getDirectEndpoint(family, modelId, env);
      break;
  }

  log.debug("Provider resolved", {
    modelId,
    family,
    backend,
    baseURL: endpoint.baseURL,
    resolvedModel: endpoint.modelName,
  });

  return { family, backend, endpoint };
}

/**
 * Get all configured backends and their status.
 */
export function getProviderStatus(): Record<
  string,
  { configured: boolean; backend: ProviderBackend }
> {
  const env = loadEnvConfig();

  return {
    grok: {
      configured: !!(
        env.xaiApiKey ||
        env.azureAiApiKey ||
        env.openrouterApiKey
      ),
      backend: env.grokBackend,
    },
    gemini: {
      configured: !!(env.googleAiApiKey || env.openrouterApiKey),
      backend: env.geminiBackend,
    },
    claude: {
      configured: !!(env.anthropicApiKey || env.openrouterApiKey),
      backend: env.claudeBackend,
    },
    groq: {
      configured: !!(env.groqApiKey || env.openrouterApiKey),
      backend: env.groqBackend,
    },
  };
}

/**
 * Validate that required credentials are configured for a model.
 * Throws descriptive error if missing.
 */
export function validateProviderConfig(modelId: string): void {
  try {
    resolveProvider(modelId);
  } catch (error) {
    const family = getModelFamily(modelId);
    const env = loadEnvConfig();
    const backend =
      family === "grok"
        ? env.grokBackend
        : family === "gemini"
          ? env.geminiBackend
          : family === "claude"
            ? env.claudeBackend
            : "direct";

    throw new Error(
      `Missing credentials for ${modelId} (backend: ${backend}). ` +
        `Check environment variables for ${backend === "azure" ? "AZURE_AI_*" : backend === "openrouter" ? "OPENROUTER_API_KEY" : `${family.toUpperCase()}_API_KEY`}`
    );
  }
}
