/**
 * Blocker detection for pipeline execution.
 * 
 * Detects conditions that require human intervention:
 * - gsd-discuss phase questions
 * - Verification failures
 * - Missing environment variables
 * - Authentication errors
 */
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "blocker-detector" });

export const BLOCKER_TYPE = {
  DISCUSS_REQUIRED: "discuss_required",
  VERIFICATION_FAILED: "verification_failed",
  MISSING_ENV_VAR: "missing_env_var",
  AUTH_ERROR: "auth_error",
  MANUAL_ACTION_REQUIRED: "manual_action_required",
} as const;

export type BlockerType = (typeof BLOCKER_TYPE)[keyof typeof BLOCKER_TYPE];

export interface BlockerInfo {
  type: BlockerType;
  message: string;
  context: Record<string, unknown>;
  recoverable: boolean;
  suggestedAction: string;
}

/**
 * Detect if executor output indicates a blocker condition.
 */
export function detectBlocker(
  executorOutput: string,
  exitCode: number
): BlockerInfo | null {
  // Check for discuss-phase invocation
  if (
    executorOutput.includes("/gsd-discuss") ||
    executorOutput.includes("requires discussion") ||
    executorOutput.includes("checkpoint:decision")
  ) {
    return {
      type: BLOCKER_TYPE.DISCUSS_REQUIRED,
      message: "Phase requires human discussion before continuing",
      context: { pattern: "gsd-discuss detected" },
      recoverable: true,
      suggestedAction: "Run /gsd-discuss-phase to provide input, then resume pipeline",
    };
  }

  // Check for verification failure
  if (
    executorOutput.includes("VERIFICATION FAILED") ||
    executorOutput.includes("verification_status: failed") ||
    (exitCode !== 0 && executorOutput.includes("verify"))
  ) {
    return {
      type: BLOCKER_TYPE.VERIFICATION_FAILED,
      message: "Plan verification failed",
      context: { exitCode },
      recoverable: true,
      suggestedAction: "Review verification output, fix issues, then resume pipeline",
    };
  }

  // Check for missing environment variable
  const envVarMatch = executorOutput.match(
    /Missing required environment variable[:\s]+(\w+)/i
  );
  if (envVarMatch) {
    return {
      type: BLOCKER_TYPE.MISSING_ENV_VAR,
      message: `Missing required environment variable: ${envVarMatch[1]}`,
      context: { envVar: envVarMatch[1] },
      recoverable: true,
      suggestedAction: `Set ${envVarMatch[1]} in environment, then resume pipeline`,
    };
  }

  // Check for auth errors
  if (
    executorOutput.includes("authentication failed") ||
    executorOutput.includes("unauthorized") ||
    executorOutput.includes("401")
  ) {
    return {
      type: BLOCKER_TYPE.AUTH_ERROR,
      message: "Authentication error detected",
      context: {},
      recoverable: true,
      suggestedAction: "Check credentials and authentication, then resume pipeline",
    };
  }

  // Check for manual action checkpoint
  if (
    executorOutput.includes("checkpoint:human-action") ||
    executorOutput.includes("manual action required")
  ) {
    return {
      type: BLOCKER_TYPE.MANUAL_ACTION_REQUIRED,
      message: "Manual action required by user",
      context: {},
      recoverable: true,
      suggestedAction: "Complete manual action, then resume pipeline",
    };
  }

  // No blocker detected
  if (exitCode !== 0) {
    log.warn("Non-zero exit code without detected blocker", {
      exitCode,
      outputLength: executorOutput.length,
    });
  }

  return null;
}

/**
 * Check if a blocker allows automatic retry.
 */
export function isRetryable(blocker: BlockerInfo): boolean {
  // Only retryable if recoverable and not requiring human input
  return (
    blocker.recoverable &&
    blocker.type !== BLOCKER_TYPE.DISCUSS_REQUIRED &&
    blocker.type !== BLOCKER_TYPE.MANUAL_ACTION_REQUIRED
  );
}
