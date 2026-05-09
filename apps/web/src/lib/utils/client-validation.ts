/**
 * Cross-service client validation utilities.
 *
 * DB-H07 FIX: Validates that a client exists in both AI-Writer and open-seo-main
 * before processing cross-service operations, preventing 404 errors and data loss.
 *
 * DI-M03 FIX: Adds client existence checks at service entry points.
 *
 * Usage:
 *   await validateClientExistsInBothServices(clientId);
 *   // Throws if client doesn't exist in both services
 */

import { logger } from '@/lib/logger';
import { getFastApi, getOpenSeo, FastApiError, CircuitOpenError } from '@/lib/server-fetch';

/**
 * Error thrown when client doesn't exist in one or more services.
 */
export class ClientNotFoundError extends Error {
  constructor(
    public readonly clientId: string,
    public readonly missingIn: ('ai-writer' | 'open-seo')[]
  ) {
    const services = missingIn.join(' and ');
    super(`Client ${clientId} not found in ${services}`);
    this.name = 'ClientNotFoundError';
  }
}

/**
 * Check if a client exists in AI-Writer service.
 *
 * @param clientId - UUID of the client
 * @returns true if client exists, false if not found
 * @throws Error on network/server errors (not 404)
 */
export async function checkAiWriterClientExists(clientId: string): Promise<boolean> {
  try {
    // AI-Writer client check endpoint - returns 404 if not found
    await getFastApi<{ id: string }>(`/api/clients/${clientId}/exists`);
    return true;
  } catch (error) {
    if (error instanceof FastApiError && error.status === 404) {
      return false;
    }
    // Circuit breaker open - service is down, assume client might exist
    if (error instanceof CircuitOpenError) {
      logger.warn(`[client-validation] AI-Writer circuit open, skipping check for client ${clientId}`);
      return true; // Fail open to prevent blocking operations when service is recovering
    }
    throw error;
  }
}

/**
 * Check if a client exists in open-seo-main service.
 *
 * @param clientId - UUID of the client
 * @returns true if client exists, false if not found
 * @throws Error on network/server errors (not 404)
 */
export async function checkOpenSeoClientExists(clientId: string): Promise<boolean> {
  try {
    // open-seo client check endpoint - returns 404 if not found
    await getOpenSeo<{ id: string }>(`/api/clients/${clientId}/exists`);
    return true;
  } catch (error) {
    if (error instanceof FastApiError && error.status === 404) {
      return false;
    }
    // Circuit breaker open - service is down, assume client might exist
    if (error instanceof CircuitOpenError) {
      logger.warn(`[client-validation] open-seo circuit open, skipping check for client ${clientId}`);
      return true; // Fail open to prevent blocking operations when service is recovering
    }
    throw error;
  }
}

/**
 * Validate that a client exists in both AI-Writer and open-seo-main services.
 *
 * This is critical for cross-service operations to prevent:
 * - 404 errors when one service doesn't have the client
 * - Orphaned data in one service when client is missing in another
 * - Silent data loss during cross-service mutations
 *
 * @param clientId - UUID of the client to validate
 * @throws ClientNotFoundError if client doesn't exist in one or both services
 */
export async function validateClientExistsInBothServices(clientId: string): Promise<void> {
  // Check both services in parallel for performance
  const [aiWriterExists, openSeoExists] = await Promise.all([
    checkAiWriterClientExists(clientId),
    checkOpenSeoClientExists(clientId),
  ]);

  const missingIn: ('ai-writer' | 'open-seo')[] = [];

  if (!aiWriterExists) {
    missingIn.push('ai-writer');
  }
  if (!openSeoExists) {
    missingIn.push('open-seo');
  }

  if (missingIn.length > 0) {
    throw new ClientNotFoundError(clientId, missingIn);
  }
}

/**
 * Soft validation that logs warnings but doesn't throw.
 * Use for non-critical operations where we want to proceed anyway.
 *
 * @param clientId - UUID of the client to validate
 * @returns Object indicating which services have the client
 */
export async function softValidateClientExists(clientId: string): Promise<{
  aiWriter: boolean;
  openSeo: boolean;
  valid: boolean;
}> {
  const [aiWriterExists, openSeoExists] = await Promise.all([
    checkAiWriterClientExists(clientId).catch(() => false),
    checkOpenSeoClientExists(clientId).catch(() => false),
  ]);

  const valid = aiWriterExists && openSeoExists;

  if (!valid) {
    const missingServices = [];
    if (!aiWriterExists) missingServices.push('AI-Writer');
    if (!openSeoExists) missingServices.push('open-seo-main');
    console.warn(
      `[client-validation] Client ${clientId} missing in: ${missingServices.join(', ')}`
    );
  }

  return {
    aiWriter: aiWriterExists,
    openSeo: openSeoExists,
    valid,
  };
}
