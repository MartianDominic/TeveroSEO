/**
 * BusinessPriorityParser Service
 *
 * Converts natural language business priorities into structured FocusDirective
 * using LLM (Claude) with the XML prompt template.
 *
 * Usage:
 *   const parser = new BusinessPriorityParser({ clientId: 'uuid' });
 *   const directive = await parser.parse("Focus on Samsung this quarter...");
 *   const weights = toScoringWeights(directive);
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { withRetry } from '@/server/lib/retry';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import {
  FocusDirective,
  isValidFocusDirective,
  requiresReview,
  ScoringWeights,
  toScoringWeights,
} from '../types/focus-directive';

// ============================================================================
// Configuration
// ============================================================================

interface ParserConfig {
  clientId: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  promptPath?: string;
}

interface ParseResult {
  success: boolean;
  directive: FocusDirective | null;
  error: string | null;
  requiresReview: boolean;
  reviewReasons: string[];
  rawResponse?: string;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG = {
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  temperature: 0.1, // Low temperature for consistent extraction
  promptPath: join(__dirname, '../prompts/business-priority-parser.xml'),
};

// ============================================================================
// BusinessPriorityParser Class
// ============================================================================

export class BusinessPriorityParser {
  private config: Required<ParserConfig>;
  private client: Anthropic;
  private promptTemplate: string | null = null;

  constructor(config: ParserConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    this.client = new Anthropic();
  }

  /**
   * Load and cache the XML prompt template.
   */
  private async loadPromptTemplate(): Promise<string> {
    if (this.promptTemplate) {
      return this.promptTemplate;
    }

    try {
      this.promptTemplate = await readFile(this.config.promptPath, 'utf-8');
      return this.promptTemplate;
    } catch (error) {
      throw new Error(`Failed to load prompt template: ${error}`);
    }
  }

  /**
   * Build the full prompt with user input injected.
   */
  private buildPrompt(userInput: string, template: string): string {
    return template.replace('{{USER_INPUT}}', userInput);
  }

  /**
   * Parse raw LLM response to extract JSON.
   */
  private extractJson(response: string): object | null {
    // Try to parse directly first
    try {
      return JSON.parse(response);
    } catch {
      // Response might have markdown code blocks
    }

    // Try to extract from markdown code block
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch {
        // Continue to next strategy
      }
    }

    // Try to find JSON object in response
    const objectMatch = response.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        // Failed to parse
      }
    }

    return null;
  }

  /**
   * Enrich directive with generated metadata.
   */
  private enrichDirective(directive: FocusDirective, rawInput: string): FocusDirective {
    return {
      ...directive,
      directive_id: directive.directive_id || randomUUID(),
      created_at: directive.created_at || new Date().toISOString(),
      raw_input: rawInput,
    };
  }

  /**
   * Parse natural language business priorities into FocusDirective.
   */
  async parse(userInput: string): Promise<ParseResult> {
    if (!userInput || userInput.trim().length === 0) {
      return {
        success: false,
        directive: null,
        error: 'Empty input provided',
        requiresReview: false,
        reviewReasons: [],
      };
    }

    try {
      // Load prompt template
      const template = await this.loadPromptTemplate();
      const fullPrompt = this.buildPrompt(userInput.trim(), template);

      // Call Claude API with retry for transient failures
      const message = await withRetry(
        () =>
          this.client.messages.create({
            model: this.config.model,
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature,
            messages: [
              {
                role: 'user',
                content: fullPrompt,
              },
            ],
          }),
        { maxRetries: 3, baseDelayMs: 1000 }
      );

      // Extract text response
      const textContent = message.content.find((c) => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        return {
          success: false,
          directive: null,
          error: 'No text response from LLM',
          requiresReview: false,
          reviewReasons: [],
        };
      }

      const rawResponse = textContent.text;

      // Parse JSON from response
      const parsed = this.extractJson(rawResponse);
      if (!parsed) {
        return {
          success: false,
          directive: null,
          error: 'Failed to parse JSON from LLM response',
          requiresReview: true,
          reviewReasons: ['Invalid JSON output'],
          rawResponse,
        };
      }

      // Validate structure
      if (!isValidFocusDirective(parsed)) {
        return {
          success: false,
          directive: null,
          error: 'Response does not match FocusDirective schema',
          requiresReview: true,
          reviewReasons: ['Schema validation failed'],
          rawResponse,
        };
      }

      // Enrich with metadata
      const directive = this.enrichDirective(parsed, userInput);
      const needsReview = requiresReview(directive);

      return {
        success: true,
        directive,
        error: null,
        requiresReview: needsReview,
        reviewReasons: directive.metadata.review_reasons,
        rawResponse,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        directive: null,
        error: `Parser error: ${errorMessage}`,
        requiresReview: true,
        reviewReasons: ['Parser exception'],
      };
    }
  }

  /**
   * Parse and convert directly to scoring weights.
   * Convenience method for immediate use in scoring pipeline.
   */
  async parseToWeights(userInput: string): Promise<{
    success: boolean;
    weights: ScoringWeights | null;
    directive: FocusDirective | null;
    error: string | null;
    requiresReview: boolean;
  }> {
    const result = await this.parse(userInput);

    if (!result.success || !result.directive) {
      return {
        success: false,
        weights: null,
        directive: null,
        error: result.error,
        requiresReview: result.requiresReview,
      };
    }

    const weights = toScoringWeights(result.directive);

    return {
      success: true,
      weights,
      directive: result.directive,
      error: null,
      requiresReview: result.requiresReview,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a configured BusinessPriorityParser instance.
 */
export function createBusinessPriorityParser(clientId: string): BusinessPriorityParser {
  return new BusinessPriorityParser({ clientId });
}

// ============================================================================
// Singleton for Reuse
// ============================================================================

let defaultParser: BusinessPriorityParser | null = null;

/**
 * Get or create a default parser instance.
 * Use for simple cases where client context isn't needed.
 */
export function getDefaultParser(): BusinessPriorityParser {
  if (!defaultParser) {
    defaultParser = new BusinessPriorityParser({ clientId: 'default' });
  }
  return defaultParser;
}
