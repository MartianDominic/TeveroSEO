/**
 * ConstraintExtractor Service
 *
 * Extracts structured AnalysisConstraints from unstructured client conversations
 * using Claude Sonnet 4.6.
 *
 * This is the brain of the keyword intelligence system - everything downstream
 * depends on accurate constraint extraction.
 */

import Anthropic from "@anthropic-ai/sdk";
import { withRetry } from "@/server/lib/retry";
import { buildExtractionPrompt } from "./prompts";
import {
  ExtractionResult,
  ExtractionResultSchema,
  AnalysisConstraintsSchema,
  ConfidenceScoresSchema,
} from "./types";

/**
 * Extractor configuration options.
 */
export interface ExtractorConfig {
  /** Claude model to use (default: claude-sonnet-4-20250514) */
  model?: string;
  /** Maximum tokens for response (default: 4096) */
  maxTokens?: number;
  /** Sampling temperature (default: 0.1 for consistency) */
  temperature?: number;
}

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: Required<ExtractorConfig> = {
  model: "claude-sonnet-4-20250514",
  maxTokens: 4096,
  temperature: 0.1,
};

/**
 * Maximum conversation content length (50k chars per ConversationExtractor pattern).
 * Prevents DoS via excessive input (T-75-04).
 */
const MAX_CONTENT_LENGTH = 50_000;

/**
 * ConstraintExtractor class - extracts constraints from conversations.
 */
export class ConstraintExtractor {
  private config: Required<ExtractorConfig>;
  private client: Anthropic;

  constructor(config?: ExtractorConfig) {
    // Validate API key present (T-75-01)
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY environment variable is required for ConstraintExtractor"
      );
    }

    this.config = { ...DEFAULT_CONFIG, ...config };
    this.client = new Anthropic({ apiKey });
  }

  /**
   * Extract structured constraints from a client conversation.
   *
   * @param conversation - Natural language conversation text
   * @param instruction - Optional additional extraction instruction
   * @returns ExtractionResult with constraints or error
   *
   * @throws Error if extraction fails after retries
   *
   * @example
   * const extractor = new ConstraintExtractor();
   * const result = await extractor.extract(
   *   "I need SEO for my car wash in Vilnius"
   * );
   *
   * if (result.success) {
   *   console.log(result.constraints.business.type); // "local"
   * }
   */
  async extract(
    conversation: string,
    instruction?: string
  ): Promise<ExtractionResult> {
    // DoS protection: check content length (T-75-04)
    if (conversation.length > MAX_CONTENT_LENGTH) {
      return {
        success: false,
        constraints: null,
        confidence: null,
        clarificationNeeded: [],
        error: `Conversation too long (${conversation.length} chars, max ${MAX_CONTENT_LENGTH})`,
      };
    }

    try {
      // Build prompt with conversation
      const prompt = buildExtractionPrompt(conversation, instruction);

      // Call Claude API with retry logic
      const response = await withRetry(
        async () => {
          return await this.client.messages.create({
            model: this.config.model,
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature,
            messages: [
              {
                role: "user",
                content: prompt,
              },
            ],
          });
        },
        {
          maxRetries: 3,
          baseDelayMs: 1000,
        }
      );

      // Extract text content from response
      const textContent = response.content
        .filter((block) => block.type === "text")
        .map((block) => (block as { text: string }).text)
        .join("\n");

      // Parse JSON from response (handle markdown code blocks)
      const jsonString = this.extractJSON(textContent);
      const parsedResponse = JSON.parse(jsonString);

      // Validate extraction result structure
      const validationResult = ExtractionResultSchema.safeParse({
        success: true,
        constraints: parsedResponse.constraints,
        confidence: parsedResponse.confidence,
        clarificationNeeded: parsedResponse.clarificationNeeded || [],
        error: null,
      });

      if (!validationResult.success) {
        return {
          success: false,
          constraints: null,
          confidence: null,
          clarificationNeeded: [],
          error: `Invalid extraction format: ${validationResult.error.message}`,
          rawResponse: textContent.substring(0, 500), // Truncate for privacy (T-75-03)
        };
      }

      return validationResult.data;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Never log full conversation (T-75-03)
      const truncatedConversation = conversation.substring(0, 100);

      return {
        success: false,
        constraints: null,
        confidence: null,
        clarificationNeeded: [],
        error: `Extraction failed: ${errorMessage} (conversation: "${truncatedConversation}...")`,
      };
    }
  }

  /**
   * Extract JSON from Claude response, handling markdown code blocks.
   *
   * @param text - Response text from Claude
   * @returns Extracted JSON string
   * @throws Error if no valid JSON found
   */
  private extractJSON(text: string): string {
    // Try to find JSON in markdown code block
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    // Try to find JSON object directly
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }

    throw new Error("No JSON found in response");
  }
}

/**
 * Factory function to create a new ConstraintExtractor instance.
 *
 * @param config - Optional extractor configuration
 * @returns New ConstraintExtractor instance
 *
 * @example
 * const extractor = createConstraintExtractor({
 *   model: "claude-opus-4-20250514",
 *   maxTokens: 8192
 * });
 */
export function createConstraintExtractor(
  config?: ExtractorConfig
): ConstraintExtractor {
  return new ConstraintExtractor(config);
}

/**
 * Singleton default extractor instance.
 */
let defaultExtractor: ConstraintExtractor | null = null;

/**
 * Get the default singleton ConstraintExtractor instance.
 *
 * @returns Shared ConstraintExtractor instance
 *
 * @example
 * const extractor = getDefaultExtractor();
 * const result = await extractor.extract("conversation text");
 */
export function getDefaultExtractor(): ConstraintExtractor {
  if (!defaultExtractor) {
    defaultExtractor = new ConstraintExtractor();
  }
  return defaultExtractor;
}
