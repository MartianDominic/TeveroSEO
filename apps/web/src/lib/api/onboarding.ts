/**
 * Onboarding API client functions.
 * Phase 49-51: Onboarding & Agency Dashboard
 *
 * Client-side wrappers for calling open-seo-main backend endpoints.
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export interface ChecklistItem {
  id: string;
  label: string;
  category: "credentials" | "kickoff" | "setup" | "content";
  autoCompleteEvent?: string | null;
  completedAt?: string | null;
  completedBy?: string | null;
}

export interface Checklist {
  id: string;
  workspaceId: string;
  clientId: string;
  serviceTier: "starter" | "growth" | "enterprise";
  items: ChecklistItem[];
  completedCount: number;
  totalCount: number;
  createdAt: string;
}

export interface MagicLinkValidation {
  valid: boolean;
  reason?: "expired" | "used" | "not_found";
  workspaceId?: string;
  clientId?: string;
  checklistId?: string;
  itemId?: string;
  branding?: {
    name: string;
    logoUrl: string | null;
    primaryColor: string;
  };
}

/**
 * Validate a magic link token.
 * Called from /connect/[token] page to check token validity and get branding.
 */
export async function validateMagicLink(token: string): Promise<MagicLinkValidation> {
  const res = await fetch(`${BACKEND_URL}/api/onboarding/validate-magic-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
    cache: "no-store",
  });

  if (!res.ok) {
    return { valid: false, reason: "not_found" };
  }

  return res.json();
}

/**
 * Get a client's onboarding checklist.
 * Called from onboarding page to display checklist items.
 */
export async function getClientChecklist(clientId: string): Promise<Checklist | null> {
  const res = await fetch(`${BACKEND_URL}/api/onboarding/checklist/${clientId}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return null;
  }

  const data = await res.json();
  return data.checklist;
}

/**
 * Complete a checklist item manually.
 * Server action wrapper.
 */
export async function completeChecklistItem(
  checklistId: string,
  itemId: string
): Promise<boolean> {
  const res = await fetch(`${BACKEND_URL}/api/onboarding/complete-item`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ checklistId, itemId }),
    credentials: "include",
  });

  return res.ok;
}

/**
 * Generate a magic link for a checklist item.
 * Returns the full URL path.
 */
export async function generateMagicLink(
  checklistId: string,
  itemId: string
): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/api/onboarding/magic-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ checklistId, itemId }),
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to generate magic link");
  }

  const data = await res.json();
  // Return full URL (combine with origin)
  return typeof window !== "undefined"
    ? `${window.location.origin}${data.url}`
    : data.url;
}
