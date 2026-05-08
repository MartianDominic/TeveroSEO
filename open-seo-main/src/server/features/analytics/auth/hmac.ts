/**
 * HMAC Configuration and Validation
 * Phase 96-Security: SEC-003 Fix - Validate HMAC secret at startup
 *
 * Security requirements:
 * - HMAC secret must be at least 32 bytes (256 bits)
 * - Secret is validated at startup, not module load
 * - Missing or weak secrets throw immediately
 * - Provides typed HMAC utilities for internal API auth
 */

import { createHmac, timingSafeEqual } from "crypto";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "hmac-auth" });

// --- Types ---

export interface HmacConfig {
  /** Validated HMAC secret */
  secret: string;
  /** Algorithm to use */
  algorithm: "sha256" | "sha512";
}

// --- Validation ---

/**
 * Minimum secret length in bytes (32 bytes = 256 bits).
 * NIST recommends at least 128 bits for HMAC; we use 256 for extra security.
 */
const MIN_SECRET_LENGTH = 32;

/**
 * Singleton to hold the validated config.
 * Undefined until validateHmacConfig() is called.
 */
let validatedConfig: HmacConfig | undefined;

/**
 * Validate HMAC configuration at startup.
 * MUST be called during application initialization before any HMAC operations.
 *
 * SEC-003 FIX: Validates secret exists and meets minimum length requirements.
 * Throws immediately if configuration is invalid to prevent runtime errors.
 *
 * @throws Error if INTERNAL_API_HMAC_SECRET is missing or too short
 */
export function validateHmacConfig(): HmacConfig {
  const secret = process.env.INTERNAL_API_HMAC_SECRET;

  // Check if secret exists
  if (!secret) {
    const errorMsg = "INTERNAL_API_HMAC_SECRET environment variable is required for internal API authentication";
    log.error(errorMsg);
    throw new Error(errorMsg);
  }

  // Check minimum length (32 bytes = 256 bits)
  if (secret.length < MIN_SECRET_LENGTH) {
    const errorMsg = `INTERNAL_API_HMAC_SECRET must be at least ${MIN_SECRET_LENGTH} characters (256 bits). Current length: ${secret.length}`;
    log.error(errorMsg);
    throw new Error(errorMsg);
  }

  // Log successful validation (without exposing the secret)
  log.info("HMAC configuration validated successfully", {
    secretLength: secret.length,
    algorithm: "sha256",
  });

  validatedConfig = {
    secret,
    algorithm: "sha256",
  };

  return validatedConfig;
}

/**
 * Get the validated HMAC config.
 * Throws if validateHmacConfig() has not been called.
 *
 * @throws Error if HMAC config not initialized
 */
export function getHmacConfig(): HmacConfig {
  if (!validatedConfig) {
    throw new Error(
      "HMAC configuration not initialized. Call validateHmacConfig() during application startup."
    );
  }
  return validatedConfig;
}

/**
 * Check if HMAC config has been validated.
 */
export function isHmacConfigValid(): boolean {
  return validatedConfig !== undefined;
}

// --- HMAC Utilities ---

/**
 * Create HMAC signature for a message.
 * Uses the validated secret from startup.
 *
 * @param message - The message to sign
 * @returns Hex-encoded HMAC signature
 * @throws Error if HMAC config not initialized
 */
export function createHmacSignature(message: string): string {
  const config = getHmacConfig();
  return createHmac(config.algorithm, config.secret)
    .update(message)
    .digest("hex");
}

/**
 * Verify an HMAC signature against a message.
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * @param message - The message that was signed
 * @param signature - The signature to verify (hex-encoded)
 * @returns true if signature is valid, false otherwise
 */
export function verifyHmacSignature(
  message: string,
  signature: string
): boolean {
  try {
    const expectedSignature = createHmacSignature(message);

    const actualBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    // Constant-time comparison to prevent timing attacks
    if (actualBuffer.length !== expectedBuffer.length) {
      // Perform dummy comparison to maintain constant time
      timingSafeEqual(expectedBuffer, expectedBuffer);
      return false;
    }

    return timingSafeEqual(actualBuffer, expectedBuffer);
  } catch (error) {
    // Fail closed on any error
    log.warn("HMAC verification failed due to error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return false;
  }
}

/**
 * Create a timestamped HMAC signature for request authentication.
 * Format: HMAC-SHA256(timestamp.payload, secret)
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @param payload - Request payload (body for POST, empty string for GET)
 * @returns Hex-encoded HMAC signature
 */
export function createTimestampedSignature(
  timestamp: number,
  payload: string
): string {
  const message = `${timestamp}.${payload}`;
  return createHmacSignature(message);
}

/**
 * Verify a timestamped HMAC signature.
 *
 * @param timestamp - Unix timestamp from request header
 * @param payload - Request payload
 * @param signature - Signature from request header
 * @returns true if valid, false otherwise
 */
export function verifyTimestampedSignature(
  timestamp: number,
  payload: string,
  signature: string
): boolean {
  const message = `${timestamp}.${payload}`;
  return verifyHmacSignature(message, signature);
}

// --- Testing Utilities ---

/**
 * Reset the HMAC config. USE ONLY IN TESTS.
 */
export function resetHmacConfig(): void {
  if (process.env.NODE_ENV === "test") {
    validatedConfig = undefined;
  }
}

/**
 * Set a test HMAC config directly. USE ONLY IN TESTS.
 */
export function setTestHmacConfig(config: HmacConfig): void {
  if (process.env.NODE_ENV === "test") {
    validatedConfig = config;
  }
}
