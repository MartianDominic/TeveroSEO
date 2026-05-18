/**
 * Input Sanitizer for AI Prompts
 * Phase 102-06: Security - AI prompt injection prevention
 *
 * Sanitizes user input before embedding in AI prompts to prevent:
 * - Prompt injection attacks
 * - System/assistant role hijacking
 * - Variable injection attacks
 * - Code fence escapes
 * - Unicode bypass attacks (homoglyphs, zero-width characters)
 *
 * Reference: OWASP LLM Top 10 - LLM01: Prompt Injection
 * Pattern count: 57+ patterns covering 8 attack categories
 */

import { logger } from "@/lib/logger";

// =============================================================================
// Zero-Width and Special Unicode Characters
// =============================================================================

/**
 * Characters that should be stripped before pattern matching.
 * These can be used to evade text-based filters.
 */
const ZERO_WIDTH_CHARS = /[​-‍⁠﻿­]/g;

/**
 * RTL override characters that can be used for text obfuscation.
 */
const RTL_OVERRIDE_CHARS = /[‪-‮⁦-⁩]/g;

/**
 * Common homoglyph mappings (confusables).
 * Maps visually similar characters from other scripts to ASCII equivalents.
 * Based on Unicode confusables list (TR39).
 */
const CONFUSABLES: Map<string, string> = new Map([
  // Cyrillic to Latin
  ["а", "a"], // U+0430 Cyrillic Small Letter A
  ["е", "e"], // U+0435 Cyrillic Small Letter Ie
  ["о", "o"], // U+043E Cyrillic Small Letter O
  ["р", "p"], // U+0440 Cyrillic Small Letter Er
  ["с", "c"], // U+0441 Cyrillic Small Letter Es
  ["у", "y"], // U+0443 Cyrillic Small Letter U
  ["х", "x"], // U+0445 Cyrillic Small Letter Ha
  ["А", "A"], // U+0410 Cyrillic Capital Letter A
  ["В", "B"], // U+0412 Cyrillic Capital Letter Ve
  ["Е", "E"], // U+0415 Cyrillic Capital Letter Ie
  ["К", "K"], // U+041A Cyrillic Capital Letter Ka
  ["М", "M"], // U+041C Cyrillic Capital Letter Em
  ["Н", "H"], // U+041D Cyrillic Capital Letter En
  ["О", "O"], // U+041E Cyrillic Capital Letter O
  ["Р", "P"], // U+0420 Cyrillic Capital Letter Er
  ["С", "C"], // U+0421 Cyrillic Capital Letter Es
  ["Т", "T"], // U+0422 Cyrillic Capital Letter Te
  ["Х", "X"], // U+0425 Cyrillic Capital Letter Ha
  // Greek to Latin
  ["ο", "o"], // U+03BF Greek Small Letter Omicron
  ["α", "a"], // U+03B1 Greek Small Letter Alpha (when used deceptively)
  // Fullwidth to ASCII (NFKC handles these but adding for completeness)
  ["ａ", "a"],
  ["ｂ", "b"],
  ["ｃ", "c"],
  ["ｄ", "d"],
  ["ｅ", "e"],
]);

// =============================================================================
// Injection Patterns
// =============================================================================

/**
 * Patterns that indicate prompt injection attempts.
 * Exported for external validation and logging purposes.
 *
 * Categories:
 * 1. Chat ML markers (6 patterns)
 * 2. XML delimiters (10 patterns)
 * 3. Instruction override (12 patterns)
 * 4. Role-playing attempts (8 patterns)
 * 5. Jailbreak attempts (8 patterns)
 * 6. Prompt extraction (8 patterns)
 * 7. Role markers (5 patterns)
 * 8. Delimiter/encoding attacks (8+ patterns)
 */
export const INJECTION_PATTERNS: RegExp[] = [
  // ==========================================================================
  // Category 1: Chat ML role markers (OpenAI, Anthropic style)
  // ==========================================================================
  /<\|system\|>/gi,
  /<\|assistant\|>/gi,
  /<\|user\|>/gi,
  /<\|end\|>/gi,
  /<\|im_start\|>/gi,
  /<\|im_end\|>/gi,

  // ==========================================================================
  // Category 2: XML-style prompt delimiters
  // ==========================================================================
  /<prompt>/gi,
  /<\/prompt>/gi,
  /<system>/gi,
  /<\/system>/gi,
  /<instructions>/gi,
  /<\/instructions>/gi,
  /<context>/gi,
  /<\/context>/gi,
  /<role>/gi,
  /<\/role>/gi,

  // ==========================================================================
  // Category 3: Instruction override attempts
  // ==========================================================================
  /ignore\s+(all\s+)?(previous|prior|the\s+above)\s+(instructions?|prompts?|rules?)/gi,
  /forget\s+(all\s+)?(your|the|previous)?\s*(instructions?|prompts?|rules?|everything)/gi,
  /disregard\s+(all\s+)?(previous|prior|the\s+above|your)/gi,
  /override\s+(previous|all|the)/gi,
  /new\s+instructions?:/gi,
  /ignore\s+the\s+above/gi,
  /ignore\s+everything\s+(above|before)/gi,
  /forget\s+everything\s+(above|before|you\s+know)/gi,
  /do\s+not\s+follow\s+(previous|prior|your)/gi,
  /stop\s+following\s+(previous|your|the)/gi,
  /reset\s+(your|all)\s+(instructions?|context|memory)/gi,
  /clear\s+(your|all)\s+(instructions?|context|memory)/gi,

  // ==========================================================================
  // Category 4: Role-playing attempts
  // ==========================================================================
  /you\s+are\s+now\s+(a|an|the)?/gi,
  /act\s+(as\s+if|like)\s+(you|a|an)/gi,
  /pretend\s+(you\s+are|to\s+be|you're)/gi,
  /roleplay\s+(as|like)/gi,
  /imagine\s+(you\s+are|you're|being)/gi,
  /behave\s+(like|as\s+if|as)/gi,
  /from\s+now\s+on\s+(you\s+are|act\s+as|be)/gi,
  /switch\s+(to|into)\s+(a|an|the)?\s*(new|different)?\s*(role|mode|persona)/gi,

  // ==========================================================================
  // Category 5: Jailbreak attempts
  // ==========================================================================
  /\bDAN\s*(mode|prompt|jailbreak)?/gi,
  /developer\s+mode/gi,
  /\bjailbreak\b/gi,
  /bypass\s+(all\s+)?(filters?|safety|restrictions?|guidelines?)/gi,
  /enable\s+(unrestricted|unfiltered|uncensored)/gi,
  /remove\s+(all\s+)?(safety|restrictions?|filters?|guidelines?)/gi,
  /disable\s+(all\s+)?(safety|restrictions?|filters?|guidelines?)/gi,
  /unlock\s+(hidden|full|all)\s*(capabilities?|features?|mode)?/gi,

  // ==========================================================================
  // Category 6: Prompt extraction/leak attempts
  // ==========================================================================
  /repeat\s+(your|the)\s+(instructions?|prompts?|system\s+message)/gi,
  /what\s+are\s+your\s+(instructions?|rules?|guidelines?)/gi,
  /show\s+(me\s+)?(your|the)\s+(system\s+)?(prompt|instructions?)/gi,
  /reveal\s+(your|the)\s+(system|config|prompt|instructions?)/gi,
  /print\s+(your|the)\s+(config|prompt|instructions?|system)/gi,
  /output\s+(your|the)\s+(instructions?|prompt|system)/gi,
  /display\s+(your|the)\s+(instructions?|prompt|system)/gi,
  /tell\s+me\s+(your|the)\s+(instructions?|prompt|system\s+message)/gi,

  // ==========================================================================
  // Category 7: Role override markers
  // ==========================================================================
  /^SYSTEM:/gim,
  /^ASSISTANT:/gim,
  /^USER:/gim,
  /^AI:/gim,
  /^HUMAN:/gim,

  // ==========================================================================
  // Category 8: Delimiter and encoding attacks
  // ==========================================================================
  /```/g,
  /===\s*(END|START|BEGIN)\s*(===)?/gi,
  /---\s*(END|START|BEGIN)\s*(---)?/gi,
  /\[END\s*(INSTRUCTIONS?|SYSTEM|PROMPT|CONTEXT)\]/gi,
  /\[START\s*(INSTRUCTIONS?|SYSTEM|PROMPT|CONTEXT)\]/gi,
  /\[\[\s*(SYSTEM|ADMIN|ROOT)\s*\]\]/gi,

  // Template variable injection
  /\{\{[^}]*\}\}/g,
  /\{[a-z_][a-z0-9_]*\}/gi,

  // Base64/encoding/eval attempts (code execution vectors)
  /\bbase64\s*(decode|encode)?/gi,
  /\beval\s*\(/gi,
  /\bexec\s*\(/gi,
  /\bfunction\s*\(\s*\)\s*\{/gi,
  /new\s+Function\s*\(/gi,
];

/**
 * Patterns to remove completely (dangerous content).
 */
const REMOVE_PATTERNS: RegExp[] = [
  // Chat ML markers
  /<\|[^|>]+\|>/g,

  // XML delimiters that could escape context
  /<\/?(?:prompt|system|instructions|context|role|override)>/gi,

  // Code fences
  /```[\s\S]*?```/g,
  /```/g,

  // Template variables
  /\{\{[^}]*\}\}/g,

  // Delimiter attacks
  /===\s*(END|START|BEGIN)\s*(===)?/gi,
  /---\s*(END|START|BEGIN)\s*(---)?/gi,
  /\[END\s*[A-Z]+\]/gi,
  /\[START\s*[A-Z]+\]/gi,
];

// =============================================================================
// Unicode Normalization
// =============================================================================

/**
 * Normalize text to catch homoglyph attacks.
 * Cyrillic 'е' (U+0435) looks like Latin 'e' (U+0065).
 * NFKC normalization converts compatible characters to canonical form.
 * Confusables table converts visually similar characters from other scripts.
 *
 * @param text - Input text
 * @returns Normalized text with homoglyphs converted and zero-width chars removed
 */
function normalizeForDetection(text: string): string {
  // Step 1: Unicode NFKC normalization (catches fullwidth chars, ligatures)
  let normalized = text.normalize("NFKC");

  // Step 2: Apply confusables mapping (catches Cyrillic/Greek homoglyphs)
  normalized = [...normalized]
    .map((char) => CONFUSABLES.get(char) || char)
    .join("");

  // Step 3: Remove zero-width characters
  normalized = normalized.replace(ZERO_WIDTH_CHARS, "");

  // Step 4: Remove RTL override characters
  normalized = normalized.replace(RTL_OVERRIDE_CHARS, "");

  return normalized;
}

/**
 * Patterns that should be escaped (made safe) rather than removed.
 */
const ESCAPE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // Single curly braces to square brackets
  { pattern: /\{([a-z_][a-z0-9_]*)\}/gi, replacement: "[$1]" },

  // Double curly braces
  { pattern: /\{\{([^}]*)\}\}/g, replacement: "[[$1]]" },
];

// =============================================================================
// Core Sanitization Functions
// =============================================================================

/**
 * Sanitize user input for safe embedding in AI prompts.
 *
 * This is the primary function to use before including any user input
 * in a prompt to an LLM. It:
 * 1. Removes dangerous injection patterns
 * 2. Escapes template variables
 * 3. Preserves legitimate content
 *
 * @param input - Raw user input
 * @returns Sanitized string safe for prompt embedding
 *
 * @example
 * ```ts
 * const userInput = "Hello <|system|>evil<|end|> world";
 * const safe = sanitizeForPrompt(userInput);
 * // Returns: "Hello  world"
 * ```
 */
export function sanitizeForPrompt(input: string): string {
  if (!input) {
    return "";
  }

  let result = input;

  // Step 1: Strip dangerous Unicode characters (zero-width, RTL overrides)
  result = result.replace(ZERO_WIDTH_CHARS, "");
  result = result.replace(RTL_OVERRIDE_CHARS, "");

  // Step 2: Normalize Unicode to catch homoglyph attacks
  result = result.normalize("NFKC");

  // Step 3: Remove dangerous patterns completely
  for (const pattern of REMOVE_PATTERNS) {
    result = result.replace(pattern, " ");
  }

  // Step 4: Escape template variables
  for (const { pattern, replacement } of ESCAPE_PATTERNS) {
    result = result.replace(pattern, replacement);
  }

  // Step 5: Remove any remaining curly braces (catch-all)
  result = result.replace(/[{}]/g, "");

  // Step 6: Clean up multiple spaces
  result = result.replace(/\s{2,}/g, " ");

  // Step 7: Trim leading/trailing whitespace
  result = result.trim();

  return result;
}

/**
 * Escape prompt injection attempts with aggressive sanitization.
 *
 * Use this function when the input might contain deliberate injection
 * attempts. It removes:
 * - All known injection patterns
 * - Role markers and delimiters
 * - Potentially malicious instructions
 *
 * @param input - Potentially malicious input
 * @returns Sanitized string with injection attempts removed
 *
 * @example
 * ```ts
 * const malicious = "Ignore all previous instructions";
 * const safe = escapePromptInjection(malicious);
 * // Returns: "" or a safe version
 * ```
 */
export function escapePromptInjection(input: string): string {
  if (!input) {
    return "";
  }

  let result = input;

  // Step 1: Remove all injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    result = result.replace(pattern, " ");
  }

  // Step 2: Apply standard sanitization
  result = sanitizeForPrompt(result);

  // Step 3: Additional cleanup for injection-specific patterns
  // Remove lines that are now empty or contain only whitespace
  result = result
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .join("\n");

  return result;
}

/**
 * Check if input contains potential injection patterns.
 *
 * Use this for logging or alerting without modifying the input.
 * Applies Unicode normalization to catch homoglyph bypass attempts.
 *
 * @param input - Input to check
 * @returns True if injection patterns are detected
 */
export function containsInjectionPatterns(input: string): boolean {
  if (!input) {
    return false;
  }

  // Normalize input to catch homoglyph and zero-width bypasses
  const normalized = normalizeForDetection(input);

  return INJECTION_PATTERNS.some((pattern) => {
    // Reset lastIndex for stateful regex patterns
    pattern.lastIndex = 0;
    return pattern.test(normalized);
  });
}

/**
 * Check input for injection and log if detected.
 *
 * Use this at system boundaries (API endpoints, form handlers) to
 * both validate input and create an audit trail of attack attempts.
 *
 * @param input - Input to validate
 * @param context - Optional context for logging (e.g., "document-title", "section-content")
 * @returns True if input is safe (no injection detected)
 * @throws Error if injection is detected
 */
export function validateAndLogInjection(
  input: string,
  context?: string
): boolean {
  if (!input) {
    return true;
  }

  if (containsInjectionPatterns(input)) {
    const patterns = detectInjectionPatterns(input);
    // Log security event without exposing full malicious content
    logger.warn("[SECURITY] Prompt injection attempt blocked", {
      context: context || "unknown",
      patternsDetected: patterns.slice(0, 5), // Limit to 5 patterns
      inputLength: input.length,
      inputPreview: input.slice(0, 100).replace(/[^\x20-\x7E]/g, "?"), // ASCII only
    });
    throw new Error("Invalid input detected: potentially malicious content");
  }

  return true;
}

/**
 * Get detected injection patterns for logging.
 * Applies Unicode normalization to catch bypass attempts.
 *
 * @param input - Input to analyze
 * @returns Array of matched pattern descriptions
 */
export function detectInjectionPatterns(input: string): string[] {
  if (!input) {
    return [];
  }

  // Normalize input to catch homoglyph and zero-width bypasses
  const normalized = normalizeForDetection(input);
  const detected: string[] = [];

  for (const pattern of INJECTION_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(normalized)) {
      // Extract pattern name from the regex source
      const patternName = pattern.source
        .replace(/[^a-zA-Z0-9_]/g, "_")
        .slice(0, 30);
      detected.push(patternName);
    }
  }

  return detected;
}

/**
 * Strip dangerous Unicode characters from input.
 * Call this before any text processing to remove hidden characters.
 *
 * @param input - Raw input
 * @returns Input with zero-width and RTL override characters removed
 */
export function stripDangerousUnicode(input: string): string {
  if (!input) {
    return "";
  }

  let result = input;
  result = result.replace(ZERO_WIDTH_CHARS, "");
  result = result.replace(RTL_OVERRIDE_CHARS, "");
  return result;
}
