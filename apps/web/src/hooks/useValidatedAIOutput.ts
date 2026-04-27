import { useMemo } from 'react';

/**
 * Result of client-side AI output validation.
 */
interface ValidationResult {
  /** The validated/sanitized content */
  content: string;
  /** Whether the content passed all validation checks */
  isValid: boolean;
  /** List of warnings about the content */
  warnings: string[];
  /** Whether the content was modified during validation */
  wasModified: boolean;
}

/**
 * Suspicious patterns that indicate potentially malicious content.
 * These patterns are checked on the client side as a defense-in-depth measure.
 * The primary validation should happen on the server.
 */
const SUSPICIOUS_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /<script/i, message: 'Script tag detected' },
  { pattern: /javascript:/i, message: 'JavaScript URL detected' },
  { pattern: /on\w+\s*=/i, message: 'Event handler detected' },
  { pattern: /<iframe/i, message: 'Iframe detected' },
  { pattern: /<object/i, message: 'Object tag detected' },
  { pattern: /<embed/i, message: 'Embed tag detected' },
  { pattern: /<form/i, message: 'Form tag detected' },
  { pattern: /data:\s*text\/html/i, message: 'Data URL with HTML detected' },
  { pattern: /vbscript:/i, message: 'VBScript URL detected' },
  { pattern: /expression\s*\(/i, message: 'CSS expression detected' },
];

/**
 * Patterns that may indicate PII in the content.
 * Used for warning only - actual redaction should happen on the server.
 */
const PII_WARNING_PATTERNS: Array<{ pattern: RegExp; type: string }> = [
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, type: 'email' },
  { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, type: 'phone number' },
  { pattern: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/, type: 'SSN-like pattern' },
];

/**
 * Maximum content length before truncation warning.
 */
const MAX_CONTENT_LENGTH = 100000;

/**
 * Hook to validate AI output on the client side.
 *
 * This provides a defense-in-depth layer for AI-generated content.
 * Primary validation should still occur on the server side.
 *
 * @param rawContent - The raw AI-generated content to validate
 * @param options - Validation options
 * @returns ValidationResult with validated content and any warnings
 *
 * @example
 * ```tsx
 * function AIResponseDisplay({ response }: { response: string }) {
 *   const { content, isValid, warnings } = useValidatedAIOutput(response);
 *
 *   return (
 *     <div>
 *       {!isValid && (
 *         <Alert variant="warning">
 *           Content was modified for safety: {warnings.join(', ')}
 *         </Alert>
 *       )}
 *       <SafeAIOutput content={content} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useValidatedAIOutput(
  rawContent: string,
  options: {
    /** Maximum content length (default: 100000) */
    maxLength?: number;
    /** Whether to check for PII patterns and warn (default: false) */
    checkPII?: boolean;
    /** Whether to strip suspicious patterns (default: true) */
    stripSuspicious?: boolean;
  } = {}
): ValidationResult {
  const {
    maxLength = MAX_CONTENT_LENGTH,
    checkPII = false,
    stripSuspicious = true,
  } = options;

  return useMemo(() => {
    const warnings: string[] = [];
    let content = rawContent ?? '';
    let wasModified = false;

    // Check for empty content
    if (!content) {
      return {
        content: '',
        isValid: true,
        warnings: [],
        wasModified: false,
      };
    }

    // Length check
    if (content.length > maxLength) {
      content = content.slice(0, maxLength);
      warnings.push(`Content truncated to ${maxLength} characters`);
      wasModified = true;
    }

    // Check for and optionally strip suspicious patterns
    for (const { pattern, message } of SUSPICIOUS_PATTERNS) {
      if (pattern.test(content)) {
        warnings.push(message);
        if (stripSuspicious) {
          // Remove the suspicious content
          content = content.replace(new RegExp(pattern.source, 'gi'), '');
          wasModified = true;
        }
      }
    }

    // Check for PII patterns (warning only, no modification)
    if (checkPII) {
      for (const { pattern, type } of PII_WARNING_PATTERNS) {
        if (pattern.test(content)) {
          warnings.push(`Potential ${type} detected in content`);
        }
      }
    }

    return {
      content,
      isValid: warnings.length === 0,
      warnings,
      wasModified,
    };
  }, [rawContent, maxLength, checkPII, stripSuspicious]);
}

/**
 * Simple synchronous validation function for use outside of React components.
 *
 * @param content - The content to validate
 * @returns Whether the content appears safe
 */
export function isAIOutputSafe(content: string): boolean {
  if (!content) {
    return true;
  }

  return !SUSPICIOUS_PATTERNS.some(({ pattern }) => pattern.test(content));
}

/**
 * Strip suspicious patterns from content synchronously.
 *
 * @param content - The content to sanitize
 * @returns Sanitized content
 */
export function sanitizeAIOutput(content: string): string {
  if (!content) {
    return '';
  }

  let result = content;
  for (const { pattern } of SUSPICIOUS_PATTERNS) {
    result = result.replace(new RegExp(pattern.source, 'gi'), '');
  }
  return result;
}
