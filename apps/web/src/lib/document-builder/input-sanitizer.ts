/**
 * Input Sanitizer for AI Prompts
 * Phase 102-06: Security - AI prompt injection prevention
 *
 * Sanitizes user input before embedding in AI prompts to prevent:
 * - Prompt injection attacks
 * - System/assistant role hijacking
 * - Variable injection attacks
 * - Code fence escapes
 *
 * Reference: OWASP LLM Top 10 - LLM01: Prompt Injection
 */

// =============================================================================
// Injection Patterns
// =============================================================================

/**
 * Patterns that indicate prompt injection attempts.
 * Exported for external validation and logging purposes.
 */
export const INJECTION_PATTERNS: RegExp[] = [
  // Chat ML role markers (OpenAI, Anthropic style)
  /<\|system\|>/gi,
  /<\|assistant\|>/gi,
  /<\|user\|>/gi,
  /<\|end\|>/gi,
  /<\|im_start\|>/gi,
  /<\|im_end\|>/gi,

  // XML-style prompt delimiters
  /<prompt>/gi,
  /<\/prompt>/gi,
  /<system>/gi,
  /<\/system>/gi,
  /<instructions>/gi,
  /<\/instructions>/gi,
  /<context>/gi,
  /<\/context>/gi,

  // Natural language injection attempts
  /ignore all previous instructions/gi,
  /forget your instructions/gi,
  /disregard all prior/gi,
  /override previous/gi,
  /new instructions:/gi,
  /you are now/gi,
  /act as if/gi,

  // Role override attempts
  /^SYSTEM:/gim,
  /^ASSISTANT:/gim,
  /^USER:/gim,
  /^AI:/gim,
  /^HUMAN:/gim,

  // Code fence escapes
  /```/g,

  // Template variable injection
  /\{\{[^}]*\}\}/g,
  /\{[a-z_][a-z0-9_]*\}/gi,
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
];

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

  // Step 1: Remove dangerous patterns completely
  for (const pattern of REMOVE_PATTERNS) {
    result = result.replace(pattern, " ");
  }

  // Step 2: Escape template variables
  for (const { pattern, replacement } of ESCAPE_PATTERNS) {
    result = result.replace(pattern, replacement);
  }

  // Step 3: Remove any remaining curly braces (catch-all)
  result = result.replace(/[{}]/g, "");

  // Step 4: Clean up multiple spaces
  result = result.replace(/\s{2,}/g, " ");

  // Step 5: Trim leading/trailing whitespace
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
 *
 * @param input - Input to check
 * @returns True if injection patterns are detected
 */
export function containsInjectionPatterns(input: string): boolean {
  if (!input) {
    return false;
  }

  return INJECTION_PATTERNS.some((pattern) => {
    // Reset lastIndex for stateful regex patterns
    pattern.lastIndex = 0;
    return pattern.test(input);
  });
}

/**
 * Get detected injection patterns for logging.
 *
 * @param input - Input to analyze
 * @returns Array of matched pattern descriptions
 */
export function detectInjectionPatterns(input: string): string[] {
  if (!input) {
    return [];
  }

  const detected: string[] = [];

  for (const pattern of INJECTION_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(input)) {
      // Extract pattern name from the regex source
      const patternName = pattern.source.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 30);
      detected.push(patternName);
    }
  }

  return detected;
}
