/**
 * Slack Webhook Utility with Error Handling
 *
 * Provides resilient Slack webhook delivery with:
 * - 10 second timeout
 * - Circuit breaker protection
 * - Retry with exponential backoff
 * - Structured error responses
 *
 * @example
 * ```typescript
 * const result = await sendSlackNotification(webhookUrl, {
 *   text: 'Alert: Ranking dropped',
 *   blocks: [...]
 * });
 *
 * if (!result.success) {
 *   logger.error('Slack notification failed', { error: result.error });
 * }
 * ```
 */

import { getCircuitBreaker, CircuitOpenError } from './circuit-breaker';
import { withRetry } from './backoff';

import { logger } from '@/lib/logger';
/** Slack webhook timeout in milliseconds */
const SLACK_TIMEOUT_MS = 10_000;

/** Maximum retries for transient failures */
const SLACK_MAX_RETRIES = 2;

/** Slack message block types */
export interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  elements?: unknown[];
  accessory?: unknown;
  fields?: Array<{
    type: string;
    text: string;
  }>;
  [key: string]: unknown;
}

/** Slack message attachment */
export interface SlackAttachment {
  color?: string;
  fallback?: string;
  pretext?: string;
  author_name?: string;
  author_link?: string;
  author_icon?: string;
  title?: string;
  title_link?: string;
  text?: string;
  fields?: Array<{
    title: string;
    value: string;
    short?: boolean;
  }>;
  footer?: string;
  footer_icon?: string;
  ts?: number;
}

/** Slack message payload */
export interface SlackMessage {
  text?: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
  thread_ts?: string;
  mrkdwn?: boolean;
  unfurl_links?: boolean;
  unfurl_media?: boolean;
}

/** Result of a Slack notification attempt */
export interface SlackNotificationResult {
  success: boolean;
  error?: string;
  /** Whether the circuit breaker is open */
  circuitOpen?: boolean;
}

/** Circuit breaker instance for Slack webhooks */
const slackCircuitBreaker = getCircuitBreaker('slack-webhook', {
  failureThreshold: 5,
  resetTimeout: 60_000, // 1 minute
  onStateChange: (state, name) => {
    if (state === 'open') {
      logger.error(`[${name}] Circuit breaker opened - Slack unavailable`);
    } else if (state === 'closed') {
      console.info(`[${name}] Circuit breaker closed - Slack recovered`);
    }
  },
});

/**
 * Send a notification to a Slack webhook URL.
 *
 * Features:
 * - 10 second timeout to prevent hanging
 * - Circuit breaker to avoid hammering failing endpoints
 * - Retry with exponential backoff for transient failures
 * - Structured error response (never throws)
 *
 * @param webhookUrl - Slack incoming webhook URL
 * @param message - Message payload
 * @returns Result object with success status and optional error
 */
export async function sendSlackNotification(
  webhookUrl: string,
  message: SlackMessage
): Promise<SlackNotificationResult> {
  // Validate webhook URL format
  if (!webhookUrl || !webhookUrl.startsWith('https://hooks.slack.com/')) {
    return {
      success: false,
      error: 'Invalid Slack webhook URL',
    };
  }

  // Validate message has content
  if (!message.text && !message.blocks?.length && !message.attachments?.length) {
    return {
      success: false,
      error: 'Message must have text, blocks, or attachments',
    };
  }

  try {
    await slackCircuitBreaker.execute(async () => {
      await withRetry(
        async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), SLACK_TIMEOUT_MS);

          try {
            const response = await fetch(webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(message),
              signal: controller.signal,
            });

            if (!response.ok) {
              const text = await response.text().catch(() => 'Unknown error');
              const error = new Error(`Slack error: ${response.status} - ${text}`);
              (error as Error & { status: number }).status = response.status;
              throw error;
            }
          } finally {
            clearTimeout(timeoutId);
          }
        },
        {
          maxRetries: SLACK_MAX_RETRIES,
          baseDelay: 1000,
          shouldRetry: (error) => {
            // Retry on 5xx errors and network failures
            if (typeof error === 'object' && error !== null && 'status' in error) {
              const status = (error as { status: number }).status;
              return status >= 500 || status === 429;
            }
            // Retry on timeout/network errors
            if (error instanceof Error) {
              return (
                error.name === 'AbortError' ||
                error.message.includes('fetch') ||
                error.message.includes('network')
              );
            }
            return false;
          },
          onRetry: (attempt, delay, error) => {
            console.warn(
              `[slack-webhook] Retry ${attempt} in ${delay}ms: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`
            );
          },
        }
      );
    });

    return { success: true };
  } catch (e) {
    // Handle circuit breaker open
    if (e instanceof CircuitOpenError) {
      logger.warn(`[slack-webhook] Circuit open: ${e.message}`);
      return {
        success: false,
        error: 'Slack service temporarily unavailable',
        circuitOpen: true,
      };
    }

    // Handle other errors
    const error = e instanceof Error ? e.message : 'Unknown error';
    logger.error(`[slack-webhook] Failed: ${error}`);
    return { success: false, error };
  }
}

/**
 * Send a simple text message to Slack.
 *
 * @param webhookUrl - Slack incoming webhook URL
 * @param text - Message text (supports mrkdwn formatting)
 */
export async function sendSlackText(
  webhookUrl: string,
  text: string
): Promise<SlackNotificationResult> {
  return sendSlackNotification(webhookUrl, { text, mrkdwn: true });
}

/**
 * Send an alert notification to Slack.
 *
 * @param webhookUrl - Slack incoming webhook URL
 * @param params - Alert parameters
 */
export async function sendSlackAlert(
  webhookUrl: string,
  params: {
    title: string;
    message: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    fields?: Array<{ title: string; value: string }>;
    link?: { text: string; url: string };
  }
): Promise<SlackNotificationResult> {
  const colorMap = {
    info: '#2196F3',
    warning: '#FFC107',
    error: '#F44336',
    critical: '#9C27B0',
  };

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: params.title,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: params.message,
      },
    },
  ];

  if (params.fields?.length) {
    blocks.push({
      type: 'section',
      fields: params.fields.map((f) => ({
        type: 'mrkdwn',
        text: `*${f.title}*\n${f.value}`,
      })),
    });
  }

  if (params.link) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: params.link.text,
          },
          url: params.link.url,
        },
      ],
    });
  }

  return sendSlackNotification(webhookUrl, {
    blocks,
    attachments: [
      {
        color: colorMap[params.severity],
        fallback: `${params.title}: ${params.message}`,
      },
    ],
  });
}

/**
 * Get the current state of the Slack circuit breaker.
 */
export function getSlackCircuitBreakerState() {
  return slackCircuitBreaker.getState();
}

/**
 * Reset the Slack circuit breaker (for recovery/testing).
 */
export function resetSlackCircuitBreaker() {
  slackCircuitBreaker.reset();
}
