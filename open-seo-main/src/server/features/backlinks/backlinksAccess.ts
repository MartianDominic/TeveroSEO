import { z } from "zod";

const BACKLINKS_NOT_ENABLED_MESSAGE =
  "Backlinks access check failed - it's still not enabled for your DataForSEO account. Enable it in DataForSEO, then try again.";

const backlinksAccessStatusSchema = z.object({
  enabled: z.boolean(),
  verifiedAt: z.string().nullable(),
  lastCheckedAt: z.string().nullable(),
  lastErrorCode: z.string().nullable(),
  lastErrorMessage: z.string().nullable(),
});

type BacklinksAccessStatus = z.infer<typeof backlinksAccessStatusSchema>;

/**
 * Get backlinks access status.
 * With Clerk auth (always hosted), backlinks are treated as platform-managed.
 */
export async function getBacklinksAccessStatus(): Promise<BacklinksAccessStatus> {
  // Clerk auth is always hosted - backlinks are platform-managed
  return getHostedBacklinksAccessStatus();
}

/**
 * Set backlinks access status.
 * With Clerk auth (always hosted), this is a no-op since backlinks are platform-managed.
 */
export async function setBacklinksAccessStatus(
  _status: BacklinksAccessStatus,
): Promise<void> {
  // Clerk auth is always hosted - no KV storage needed
  return;
}

export function buildVerifiedBacklinksAccessStatus(
  checkedAt: string,
): BacklinksAccessStatus {
  return {
    enabled: true,
    verifiedAt: checkedAt,
    lastCheckedAt: checkedAt,
    lastErrorCode: null,
    lastErrorMessage: null,
  };
}

export function buildBacklinksDisabledAccessStatus(
  checkedAt: string,
  errorCode: string,
): BacklinksAccessStatus {
  return {
    enabled: false,
    verifiedAt: null,
    lastCheckedAt: checkedAt,
    lastErrorCode: errorCode,
    lastErrorMessage: BACKLINKS_NOT_ENABLED_MESSAGE,
  };
}

function getHostedBacklinksAccessStatus(): BacklinksAccessStatus {
  return {
    enabled: true,
    verifiedAt: null,
    lastCheckedAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
  };
}
