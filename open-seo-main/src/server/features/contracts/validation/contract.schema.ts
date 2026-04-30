/**
 * Contract validation schemas.
 * Phase 45: Data Foundation
 */
import { z } from "zod";
import { CONTRACT_STATUS } from "@/db/contract-schema";

const contractSectionSchema = z.object({
  title: z.string().min(1, "Section title is required"),
  body: z.string(),
});

const contractSignatureSchema = z.object({
  role: z.string().min(1, "Signature role is required"),
  name: z.string().optional(),
});

const contractContentSchema = z.object({
  sections: z
    .array(contractSectionSchema)
    .min(1, "At least one section required"),
  terms: z.string().min(1, "Terms are required"),
  signatures: z.array(contractSignatureSchema).default([]),
});

export const createContractSchema = z.object({
  proposalId: z.string().optional(),
  clientId: z.string().uuid("Invalid client ID").optional(),
  title: z.string().min(1, "Title is required").max(500, "Title too long"),
  content: contractContentSchema,
  expiresAt: z.string().datetime("Invalid expiration date").optional(),
});

export const updateContractSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: contractContentSchema.optional(),
  expiresAt: z.string().datetime().optional(),
});

export const transitionContractSchema = z.object({
  contractId: z.string().min(1, "Contract ID is required"),
  toState: z.enum(CONTRACT_STATUS, {
    errorMap: () => ({ message: "Invalid contract status" }),
  }),
});

export type CreateContractInput = z.infer<typeof createContractSchema>;
export type UpdateContractInput = z.infer<typeof updateContractSchema>;
export type TransitionContractInput = z.infer<typeof transitionContractSchema>;
