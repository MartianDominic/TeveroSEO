/**
 * Out-of-Scope Service
 * Phase 89-04: Out-of-Scope Detection
 *
 * Detects keywords outside contracted scope and manages resolution.
 */
import { ContractedKeywordRepository } from "../repositories/ContractedKeywordRepository";
import { OutOfScopeRepository } from "../repositories/OutOfScopeRepository";
import { ChangeOrderRepository } from "../repositories/ChangeOrderRepository";
import type {
  OutOfScopeRequestSelect,
  ChangeOrderSelect,
} from "@/db/keyword-lockin-schema";

/**
 * Detection result.
 */
export interface OutOfScopeDetectionResult {
  isOutOfScope: boolean;
  keywordText: string;
  contractedKeywords: string[];
}

/**
 * Detect if a keyword is out of scope for a contract.
 *
 * @param contractId - Contract to check against
 * @param keywordText - Keyword to check
 * @returns Detection result with contracted keywords list
 */
export async function detectOutOfScope(
  contractId: string,
  keywordText: string
): Promise<OutOfScopeDetectionResult> {
  const contractedKeywords = await ContractedKeywordRepository.getContractedKeywordsByContract(
    contractId,
    { status: "active" }
  );

  const normalizedInput = keywordText.toLowerCase().trim();
  const contractedTexts = contractedKeywords.map((k) => k.keywordText.toLowerCase().trim());

  const isOutOfScope = !contractedTexts.includes(normalizedInput);

  return {
    isOutOfScope,
    keywordText,
    contractedKeywords: contractedKeywords.map((k) => k.keywordText),
  };
}

/**
 * Flag a keyword as out-of-scope.
 */
export async function flagOutOfScopeRequest(
  clientId: string,
  contractId: string,
  keywordText: string,
  requestedBy?: string
): Promise<OutOfScopeRequestSelect> {
  return await OutOfScopeRepository.insertOutOfScopeRequest({
    clientId,
    contractId,
    keywordText,
    requestedBy,
    status: "pending",
    requestedAt: new Date(),
  });
}

/**
 * Check and flag if keyword is out of scope.
 * Returns null if keyword is within scope.
 */
export async function checkAndFlagIfOutOfScope(
  clientId: string,
  contractId: string,
  keywordText: string,
  requestedBy?: string
): Promise<OutOfScopeRequestSelect | null> {
  const detection = await detectOutOfScope(contractId, keywordText);

  if (!detection.isOutOfScope) {
    return null;
  }

  return await flagOutOfScopeRequest(clientId, contractId, keywordText, requestedBy);
}

/**
 * Approve an out-of-scope request directly (no change order).
 */
export async function approveRequestDirect(
  requestId: string,
  resolutionNotes?: string
): Promise<OutOfScopeRequestSelect | undefined> {
  return await OutOfScopeRepository.resolveRequest(requestId, {
    status: "approved",
    resolutionNotes,
  });
}

/**
 * Reject an out-of-scope request.
 */
export async function rejectRequest(
  requestId: string,
  resolutionNotes?: string
): Promise<OutOfScopeRequestSelect | undefined> {
  return await OutOfScopeRepository.resolveRequest(requestId, {
    status: "rejected",
    resolutionNotes,
  });
}

/**
 * Resolve request via change order.
 * Creates change order and links it to the request.
 */
export async function resolveWithChangeOrder(
  requestId: string,
  contractId: string,
  changeOrderData: {
    description: string;
    keywordsAdded: string[];
    additionalFee?: string;
    feeType?: "one_time" | "monthly";
  }
): Promise<{
  request: OutOfScopeRequestSelect;
  changeOrder: ChangeOrderSelect;
}> {
  // Get the request
  const request = await OutOfScopeRepository.getRequestById(requestId);
  if (!request) {
    throw new Error("NOT_FOUND: Out-of-scope request not found");
  }

  // Create change order
  const changeOrder = await ChangeOrderRepository.insertChangeOrder({
    contractId,
    description: changeOrderData.description,
    keywordsAdded: changeOrderData.keywordsAdded,
    keywordsRemoved: [],
    additionalFee: changeOrderData.additionalFee ?? "0",
    feeType: changeOrderData.feeType ?? "one_time",
    status: "draft",
  });

  // Update request with change order reference
  const updatedRequest = await OutOfScopeRepository.resolveRequest(requestId, {
    status: "change_order",
    changeOrderId: changeOrder.id,
    resolutionNotes: `Change order created: ${changeOrder.description}`,
  });

  return {
    request: updatedRequest!,
    changeOrder,
  };
}

/**
 * Get pending out-of-scope summary for a contract.
 */
export async function getPendingSummary(contractId: string): Promise<{
  pendingCount: number;
  requests: OutOfScopeRequestSelect[];
}> {
  const requests = await OutOfScopeRepository.getRequestsByContract(contractId, {
    status: "pending",
  });

  return {
    pendingCount: requests.length,
    requests,
  };
}

export const OutOfScopeService = {
  detectOutOfScope,
  flagOutOfScopeRequest,
  checkAndFlagIfOutOfScope,
  approveRequestDirect,
  rejectRequest,
  resolveWithChangeOrder,
  getPendingSummary,
};
