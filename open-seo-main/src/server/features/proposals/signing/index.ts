/**
 * Proposal signing module.
 * Phase 30-05: E-Signature (Dokobit)
 */

export {
  initiateProposalSigning,
  checkSigningStatus,
  validatePersonalCode,
  hashPersonalCode,
  type InitiateSigningInput,
  type InitiateSigningResult,
} from "./signing";

export {
  generateContractPdf,
  calculateDocumentHash,
  formatCurrency,
  formatDate,
  CONTRACT_SECTIONS,
} from "./pdf";
