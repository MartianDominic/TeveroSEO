/**
 * LLM safety utilities for TypeScript.
 *
 * Provides comprehensive protection against:
 * 1. Prompt injection attacks
 * 2. DoS attacks via excessive input
 * 3. XSS vulnerabilities in LLM output
 * 4. Control character injection
 * 5. System prompt manipulation
 */

// --- Constants ---

const MAX_INPUT_LENGTH = 50000;
const MAX_CONTEXT_LENGTH = 100000;
const MAX_OUTPUT_LENGTH = 200000;
const MAX_SYSTEM_PROMPT_LENGTH = 10000;

export const MODEL_TOKEN_LIMITS: Record<string, number> = {
  "gemini-pro": 30000,
  "gemini-1.5-pro": 100000,
  "gemini-2.0-flash-lite": 30000,
  "gemini-2.5-flash": 100000,
  "gpt-4": 8000,
  "gpt-4-turbo": 128000,
  "gpt-4o": 128000,
  "claude-3-sonnet": 200000,
  "claude-3-opus": 200000,
  "claude-3-haiku": 200000,
};

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(previous|all|above|prior)\s+(instructions?|prompts?|rules?|guidelines?)/i,
  /disregard\s+(previous|all|above|prior)/i,
  /forget\s+(everything|all|previous|prior|about)/i,
  /override\s+(previous|system|all)/i,
  /bypass\s+(security|restrictions?|rules?|guidelines?)/i,
  /new\s+instructions?:/i,
  /updated?\s+instructions?:/i,
  /actual\s+instructions?:/i,
  /system\s*:\s*/i,
  /<\|?(system|assistant|user|human)\|?>/i,
  /\[INST\]/i,
  /###\s*(instruction|system|human|assistant|user)/i,
  /you\s+are\s+now\s+/i,
  /pretend\s+(you|to)\s+/i,
  /act\s+as\s+if\s+/i,
  /roleplay\s+as\s+/i,
  /DAN\s*mode/i,
  /developer\s+mode/i,
  /jailbreak/i,
  /sudo\s+mode/i,
  /ignore\s+safety/i,
  /ignore\s+guidelines/i,
];

// --- Types ---

export interface SanitizationResult {
  text: string;
  wasModified: boolean;
  warnings: string[];
  blocked: boolean;
  blockReason?: string;
  injectionDetected: boolean;
  matchedPatterns: string[];
}

export interface SanitizationOptions {
  maxLength?: number;
  checkInjection?: boolean;
  escapeHtml?: boolean;
  blockOnInjection?: boolean;
  stripControlChars?: boolean;
  normalizeWhitespace?: boolean;
}

export interface OutputValidationOptions {
  maxLength?: number;
  allowedTags?: string[] | null;
  stripScripts?: boolean;
  stripEventHandlers?: boolean;
  stripJavascriptUrls?: boolean;
}

export interface PromptSafetyCheck {
  safe: boolean;
  warnings: string[];
  injectionRisk: boolean;
  lengthOk: boolean;
  estimatedTokens: number;
}

// --- Functions ---

export function sanitizeUserInput(
  text: string,
  options: SanitizationOptions = {}
): SanitizationResult {
  const {
    maxLength = MAX_INPUT_LENGTH,
    checkInjection = true,
    escapeHtml = false,
    blockOnInjection = false,
    stripControlChars = true,
    normalizeWhitespace = true,
  } = options;

  if (typeof text !== "string") {
    text = text != null ? String(text) : "";
  }

  const warnings: string[] = [];
  const matchedPatterns: string[] = [];
  let wasModified = false;
  let injectionDetected = false;
  let result = text;

  if (result.length > maxLength) {
    result = result.slice(0, maxLength);
    warnings.push(`Input truncated to ${maxLength} characters`);
    wasModified = true;
  }

  if (checkInjection) {
    for (const pattern of INJECTION_PATTERNS) {
      const match = result.match(pattern);
      if (match) {
        injectionDetected = true;
        matchedPatterns.push(pattern.source);
        warnings.push(`Potential injection pattern detected`);
      }
    }
  }

  if (injectionDetected && blockOnInjection) {
    return {
      text: "",
      wasModified: true,
      warnings,
      blocked: true,
      blockReason: `Input blocked due to potential prompt injection`,
      injectionDetected: true,
      matchedPatterns,
    };
  }

  if (stripControlChars) {
    const originalLength = result.length;
    result = result.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");
    if (result.length !== originalLength) {
      warnings.push("Control characters removed");
      wasModified = true;
    }
  }

  if (normalizeWhitespace) {
    const originalText = result;
    result = result.replace(/[ \t]+/g, " ");
    result = result.replace(/\n{3,}/g, "\n\n");
    result = result.trim();
    if (result !== originalText) {
      wasModified = true;
    }
  }

  if (escapeHtml) {
    const originalText = result;
    result = escapeHtmlChars(result);
    if (result !== originalText) {
      wasModified = true;
    }
  }

  return { text: result, wasModified, warnings, blocked: false, injectionDetected, matchedPatterns };
}

export function validateOutput(
  text: string,
  options: OutputValidationOptions = {}
): SanitizationResult {
  const {
    maxLength = MAX_OUTPUT_LENGTH,
    allowedTags = null,
    stripScripts = true,
    stripEventHandlers = true,
    stripJavascriptUrls = true,
  } = options;

  if (typeof text !== "string") {
    text = text != null ? String(text) : "";
  }

  const warnings: string[] = [];
  let wasModified = false;
  let result = text;
  const originalText = text;

  if (result.length > maxLength) {
    result = result.slice(0, maxLength);
    warnings.push(`Output truncated to ${maxLength} characters`);
    wasModified = true;
  }

  if (stripScripts) {
    result = result.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
    result = result.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "");
  }

  if (stripEventHandlers) {
    result = result.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "");
    result = result.replace(/\s+on\w+\s*=\s*[^\s>]+/gi, "");
  }

  if (stripJavascriptUrls) {
    result = result.replace(/javascript\s*:/gi, "");
    result = result.replace(/vbscript\s*:/gi, "");
  }

  if (allowedTags === null) {
    result = result.replace(/<[^>]+>/g, "");
  } else if (allowedTags.length > 0) {
    const allowedPattern = allowedTags.map((tag) => escapeRegExp(tag)).join("|");
    const disallowedTagRegex = new RegExp(`<(?!/?\\s*(?:${allowedPattern})\\b)[^>]*>`, "gi");
    result = result.replace(disallowedTagRegex, "");
  }

  result = result.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  if (result !== originalText) {
    wasModified = true;
    warnings.push("Potentially unsafe content removed from output");
  }

  return { text: result, wasModified, warnings, blocked: false, injectionDetected: false, matchedPatterns: [] };
}

export function buildSafePrompt(
  systemPrompt: string,
  userInput: string,
  context?: string,
  options: { delimiter?: string; sanitizeInputs?: boolean; escapeHtml?: boolean } = {}
): string {
  const { delimiter = "---", sanitizeInputs = true, escapeHtml = false } = options;
  const parts: string[] = [systemPrompt.trim()];
  if (context) {
    let safeContext = context;
    if (sanitizeInputs) {
      const contextResult = sanitizeUserInput(context, { maxLength: MAX_CONTEXT_LENGTH, escapeHtml });
      safeContext = contextResult.text;
    }
    parts.push(`\n\n${delimiter} CONTEXT ${delimiter}`);
    parts.push(safeContext);
  }

  let safeUserInput = userInput;
  if (sanitizeInputs) {
    const userResult = sanitizeUserInput(userInput, { maxLength: MAX_INPUT_LENGTH, escapeHtml });
    safeUserInput = userResult.text;
  }

  parts.push(`\n\n${delimiter} USER REQUEST ${delimiter}`);
  parts.push(safeUserInput);
  parts.push(`\n${delimiter} END REQUEST ${delimiter}`);

  return parts.join("\n");
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function enforceTokenLimit(text: string, maxTokens: number, truncateFrom: "start" | "end" = "end", model?: string): string {
  if (!text) return text;
  if (model && MODEL_TOKEN_LIMITS[model]) {
    maxTokens = Math.min(maxTokens, MODEL_TOKEN_LIMITS[model]);
  }
  const estimatedTokens = estimateTokens(text);
  if (estimatedTokens <= maxTokens) return text;
  const targetChars = maxTokens * 4;
  if (truncateFrom === "start") { return "..." + text.slice(-targetChars); } else { return text.slice(0, targetChars) + "..."; }
}

export function getSafeModelLimit(model: string, requestedTokens: number): number {
  const modelMax = MODEL_TOKEN_LIMITS[model] ?? 8000;
  return Math.min(requestedTokens, modelMax);
}

export function checkPromptSafety(prompt: string, userPortions?: string[]): PromptSafetyCheck {
  const warnings: string[] = [];
  let injectionRisk = false;
  let lengthOk = true;

  if (prompt.length > MAX_INPUT_LENGTH + MAX_SYSTEM_PROMPT_LENGTH + MAX_CONTEXT_LENGTH) {
    lengthOk = false;
    warnings.push("Prompt exceeds maximum safe length");
  }

  if (userPortions) {
    for (let i = 0; i < userPortions.length; i++) {
      const checkResult = sanitizeUserInput(userPortions[i], { checkInjection: true });
      if (checkResult.injectionDetected) {
        injectionRisk = true;
        warnings.push(`Injection risk in user portion ${i + 1}`);
      }
    }
  }

  return { safe: !injectionRisk && lengthOk, warnings, injectionRisk, lengthOk, estimatedTokens: estimateTokens(prompt) };
}

export function sanitizeForLogging(text: string, maxLength = 200): string {
  if (!text) return "[empty]";
  let result = text;
  if (result.length > maxLength) result = result.slice(0, maxLength) + "...";
  result = result.replace(/\n/g, "\\n").replace(/\r/g, "\\r");
  result = result.replace(/[\x00-\x1f\x7f]/g, "");
  return result;
}

function escapeHtmlChars(text: string): string {
  const htmlEscapes: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char] ?? char);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
