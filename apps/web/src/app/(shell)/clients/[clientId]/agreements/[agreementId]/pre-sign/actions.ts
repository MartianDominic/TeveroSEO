"use server";

/**
 * Server actions for pre-signing configuration.
 * Phase 59: Agreement & Signing Excellence - Pre-Signing Flow (59-06)
 *
 * These actions manage signer configuration before sending invitations.
 * Admin configures signers, sets signing order, and sends invitations.
 *
 * Security: Requires auth (T-59-06-01), logs invitation sending (T-59-06-03).
 *
 * CFG-CRIT-01 FIX: Uses centralized getOpenSeoUrl() from env.ts
 */

import { getOpenSeoUrl } from "@/lib/env";

export interface SignerData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  title: string | null;
  role: string;
  signingOrder: number;
  status: string;
  viewedAt: string | null;
  signedAt: string | null;
}

export interface PreSigningData {
  agreement: {
    id: string;
    title: string;
    status: string;
    signingMode: "sequential" | "parallel";
  };
  signers: SignerData[];
  canSend: boolean;
  sendMessage?: string;
}

/**
 * Get pre-signing configuration data for an agreement.
 * Returns agreement info, signers list, and whether invitations can be sent.
 */
export async function getPreSigningData(
  clientId: string,
  agreementId: string
): Promise<PreSigningData | { error: string }> {
  try {
    const response = await fetch(
      `${getOpenSeoUrl()}/api/agreements/${agreementId}/pre-sign`,
      {
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      if (response.status === 404) {
        return { error: "Agreement not found" };
      }
      return { error: data.error || "Failed to load pre-signing data" };
    }

    const result = await response.json();
    return result.data as PreSigningData;
  } catch {
    return { error: "network_error" };
  }
}

/**
 * Add a signer to the agreement.
 * New signers get the next available signingOrder (maxOrder + 1).
 */
export async function addSigner(
  agreementId: string,
  data: { name: string; email: string; phone?: string; title?: string; role?: string }
): Promise<{ success: boolean; signer?: SignerData; error?: string }> {
  try {
    const response = await fetch(
      `${getOpenSeoUrl()}/api/agreements/${agreementId}/signers`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          phone: data.phone || null,
          title: data.title || null,
          role: data.role || "client",
        }),
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return { success: false, error: errData.error || "Failed to add signer" };
    }

    const result = await response.json();
    return {
      success: true,
      signer: result.data as SignerData,
    };
  } catch {
    return { success: false, error: "network_error" };
  }
}

/**
 * Remove a signer from the agreement.
 * Cannot remove signers who have already signed.
 */
export async function removeSigner(
  agreementId: string,
  signerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `${getOpenSeoUrl()}/api/agreements/${agreementId}/signers/${signerId}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return { success: false, error: errData.error || "Failed to remove signer" };
    }

    return { success: true };
  } catch {
    return { success: false, error: "network_error" };
  }
}

/**
 * Update signing order for all signers.
 * Order is determined by array position (index 0 = signingOrder 1).
 */
export async function updateSigningOrder(
  agreementId: string,
  signerIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `${getOpenSeoUrl()}/api/agreements/${agreementId}/signing-order`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ signerIds }),
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return { success: false, error: errData.error || "Failed to update order" };
    }

    return { success: true };
  } catch {
    return { success: false, error: "network_error" };
  }
}

/**
 * Update signing mode (sequential or parallel).
 * Sequential: signers sign in order (provider first, then client).
 * Parallel: all signers can sign simultaneously.
 */
export async function updateSigningMode(
  agreementId: string,
  mode: "sequential" | "parallel"
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `${getOpenSeoUrl()}/api/agreements/${agreementId}/signing-mode`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mode }),
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return { success: false, error: errData.error || "Failed to update mode" };
    }

    return { success: true };
  } catch {
    return { success: false, error: "network_error" };
  }
}

/**
 * Send signing invitations to signers.
 * Per D-06: Generates 32-char nanoid tokens with 14-day expiry.
 * Per D-07 (sequential): Only first signer receives email.
 * Per D-08 (parallel): All signers receive emails simultaneously.
 *
 * Updates agreement status from "draft" to "sent".
 * Logs action for audit trail (T-59-06-03).
 */
export async function sendInvitations(
  agreementId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `${getOpenSeoUrl()}/api/agreements/${agreementId}/send-invitations`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      if (response.status === 400) {
        return { success: false, error: errData.error || "Cannot send invitations" };
      }
      return { success: false, error: errData.error || "Failed to send invitations" };
    }

    return { success: true };
  } catch {
    return { success: false, error: "network_error" };
  }
}
