"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { requireActionAuth, validateProspectOwnership, type ActionResult } from "@/lib/auth/action-auth";
import { logger } from '@/lib/logger';
import { getOpenSeo, postOpenSeo } from "@/lib/server-fetch";
// Validation schemas
const contractIdSchema = z.string().min(1, "Invalid contract ID");
const prospectIdSchema = z.string().min(1, "Invalid prospect ID");

/**
 * Contract summary for list view.
 */
export interface ContractSummary {
  id: string;
  title: string;
  status: string;
  proposalId: string | null;
  clientId: string | null;
  dokobitSessionId: string | null;
  signedAt: string | null;
  signerName: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Invoice summary for payment tracking.
 */
export interface InvoiceSummary {
  id: string;
  invoiceNumber: string;
  status: string;
  totalCents: number;
  currency: string;
  stripePaymentUrl: string | null;
  paidAt: string | null;
  createdAt: string;
}

/**
 * Contract detail with content, invoice, and activities.
 */
export interface ContractDetail extends ContractSummary {
  content: {
    sections: Array<{ title: string; body: string }>;
    terms: string;
    signatures: Array<{ role: string; name?: string }>;
  };
  invoice: InvoiceSummary | null;
  activities: Array<{
    id: string;
    activityType: string;
    activityData: Record<string, unknown>;
    createdAt: string;
  }>;
}

/**
 * Response structure from open-seo contracts API.
 */
interface ContractsApiResponse {
  success: boolean;
  data?: ContractSummary[];
  error?: string;
}

/**
 * Get all contracts for a prospect.
 */
export async function getContracts(
  prospectId: string
): Promise<ActionResult<ContractSummary[]>> {
  const auth = await requireActionAuth();

  // Validate prospect ID format
  const validatedProspectId = prospectIdSchema.safeParse(prospectId);
  if (!validatedProspectId.success) {
    return { success: false, error: validatedProspectId.error.issues[0]?.message || "Invalid prospect ID" };
  }

  try {
    // Validate ownership
    await validateProspectOwnership(validatedProspectId.data, auth);

    const params = new URLSearchParams();
    params.set("prospectId", validatedProspectId.data);

    const response = await getOpenSeo<ContractsApiResponse>(
      `/api/contracts?${params.toString()}`
    );

    if (!response.success || !response.data) {
      return { success: false, error: response.error || "Failed to fetch contracts" };
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    logger.error("Failed to fetch contracts", error instanceof Error ? error : { error: String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch contracts",
    };
  }
}

/**
 * Get invoice for a contract.
 */
export async function getInvoiceByContract(
  contractId: string
): Promise<ActionResult<InvoiceSummary | null>> {
  const auth = await requireActionAuth();

  // Validate contract ID format
  const validatedContractId = contractIdSchema.safeParse(contractId);
  if (!validatedContractId.success) {
    return { success: false, error: validatedContractId.error.issues[0]?.message || "Invalid contract ID" };
  }

  try {
    const params = new URLSearchParams();
    params.set("contractId", validatedContractId.data);

    const response = await getOpenSeo<{ success: boolean; data?: InvoiceSummary[]; error?: string }>(
      `/api/invoices?${params.toString()}`
    );

    if (!response.success) {
      return { success: false, error: response.error || "Failed to fetch invoice" };
    }

    // Return first invoice or null
    const invoice = response.data?.[0] || null;

    return {
      success: true,
      data: invoice,
    };
  } catch (error) {
    logger.error("Failed to fetch invoice", error instanceof Error ? error : { error: String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch invoice",
    };
  }
}

/**
 * Get contract detail with full lifecycle data.
 */
export async function getContractDetail(
  contractId: string
): Promise<ActionResult<ContractDetail>> {
  const auth = await requireActionAuth();

  // Validate contract ID format
  const validatedContractId = contractIdSchema.safeParse(contractId);
  if (!validatedContractId.success) {
    return { success: false, error: validatedContractId.error.issues[0]?.message || "Invalid contract ID" };
  }

  try {
    const response = await getOpenSeo<{ success: boolean; data?: ContractDetail; error?: string }>(
      `/api/contracts/${validatedContractId.data}/status`
    );

    if (!response.success || !response.data) {
      return { success: false, error: response.error || "Failed to fetch contract detail" };
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    logger.error("Failed to fetch contract detail", error instanceof Error ? error : { error: String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch contract detail",
    };
  }
}

/**
 * Send contract for e-signature.
 */
export async function sendContract(
  contractId: string,
  prospectId: string
): Promise<ActionResult<{ signingUrl: string }>> {
  const auth = await requireActionAuth();

  // Validate inputs
  const validatedContractId = contractIdSchema.safeParse(contractId);
  const validatedProspectId = prospectIdSchema.safeParse(prospectId);

  if (!validatedContractId.success) {
    return { success: false, error: validatedContractId.error.issues[0]?.message || "Invalid contract ID" };
  }
  if (!validatedProspectId.success) {
    return { success: false, error: validatedProspectId.error.issues[0]?.message || "Invalid prospect ID" };
  }

  try {
    // Validate ownership
    await validateProspectOwnership(validatedProspectId.data, auth);

    const response = await postOpenSeo<{ success: boolean; data?: { signingUrl: string }; error?: string }>(
      `/api/contracts/${validatedContractId.data}/send`,
      {}
    );

    if (!response.success || !response.data) {
      return { success: false, error: response.error || "Failed to send contract" };
    }

    revalidatePath(`/prospects/${validatedProspectId.data}/contracts`);

    return {
      success: true,
      data: { signingUrl: response.data.signingUrl },
    };
  } catch (error) {
    logger.error("Failed to send contract", error instanceof Error ? error : { error: String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send contract",
    };
  }
}
