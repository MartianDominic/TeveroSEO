/**
 * ContractService Tests
 * Phase 48-01: Contract Generation
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProposalSelect, ProposalContent } from "@/db/proposal-schema";
import type { ContractSelect } from "@/db/contract-schema";

// Mock db module before any imports
vi.mock("@/db", () => ({
  db: {},
}));

// Mock all dependencies
vi.mock("../repositories/ContractRepository");
vi.mock("../repositories/ActivityRepository");
vi.mock("../../proposals/services/ProposalService");
vi.mock("./DokobitService.js");
vi.mock("./ContractPdfGenerator.js");

import { ContractService, VALID_TRANSITIONS, canTransition } from "./ContractService.js";
import * as ContractRepository from "../repositories/ContractRepository";
import * as ActivityRepository from "../repositories/ActivityRepository";
import * as ProposalService from "../../proposals/services/ProposalService";
import * as DokobitService from "./DokobitService.js";
import * as ContractPdfGenerator from "./ContractPdfGenerator.js";

describe("ContractService - State Machine", () => {
  it("VALID_TRANSITIONS allows draft -> sent", () => {
    expect(VALID_TRANSITIONS["draft"]).toContain("sent");
  });

  it("VALID_TRANSITIONS does not allow sent -> draft (no backward transition)", () => {
    expect(VALID_TRANSITIONS["sent"]).not.toContain("draft");
  });

  it("canTransition returns false for draft -> signed (must go through sent)", () => {
    expect(canTransition("draft", "signed")).toBe(false);
  });

  it("canTransition returns true for valid transitions", () => {
    expect(canTransition("draft", "sent")).toBe(true);
    expect(canTransition("sent", "signed")).toBe(true);
  });
});

describe("ContractService.createFromProposal", () => {
  const workspaceId = "ws_123";
  const proposalId = "prop_123";

  const mockProposal: ProposalSelect = {
    id: proposalId,
    workspaceId,
    prospectId: "prospect_123",
    template: "standard",
    content: {
      hero: {
        headline: "Test Headline",
        subheadline: "Test Subheadline",
        trafficValue: 10000,
      },
      currentState: {
        traffic: 5000,
        keywords: 100,
        value: 5000,
        chartData: [],
      },
      opportunities: [],
      roi: {
        projectedTrafficGain: 2000,
        trafficValue: 2000,
        defaultConversionRate: 0.02,
        defaultAov: 150,
      },
      investment: {
        setupFee: 2500,
        monthlyFee: 1500,
        inclusions: ["SEO Audit", "Content Strategy"],
      },
      nextSteps: ["Review", "Sign", "Onboard"],
    } as ProposalContent,
    brandConfig: null,
    setupFeeCents: 250000,
    monthlyFeeCents: 150000,
    currency: "EUR",
    status: "accepted",
    token: "token_123",
    createdAt: new Date(),
    updatedAt: new Date(),
    sentAt: null,
    firstViewedAt: null,
    acceptedAt: new Date(),
    expiresAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates contract with status draft when proposal exists", async () => {
    vi.mocked(ProposalService.ProposalService.findById).mockResolvedValue({
      ...mockProposal,
      views: [],
      signatures: [],
      payments: [],
    });

    const mockContract: ContractSelect = {
      id: "contract_123",
      workspaceId,
      proposalId,
      clientId: null,
      title: "Service Agreement - Test Headline",
      content: {
        sections: [],
        terms: "",
        signatures: [],
      },
      dokobitSessionId: null,
      signedPdfUrl: null,
      signedAt: null,
      signerName: null,
      status: "draft",
      sentAt: null,
      executedAt: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(ContractRepository.insertContract).mockResolvedValue(mockContract);
    vi.mocked(ActivityRepository.insertActivity).mockResolvedValue({} as any);

    const result = await ContractService.createFromProposal(proposalId, workspaceId);

    expect(result.status).toBe("draft");
    expect(ContractRepository.insertContract).toHaveBeenCalled();
    expect(ActivityRepository.insertActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        activityType: "created",
        entityType: "contract",
      })
    );
  });

  it("throws NOT_FOUND when proposal does not exist", async () => {
    vi.mocked(ProposalService.ProposalService.findById).mockResolvedValue(null);

    await expect(
      ContractService.createFromProposal(proposalId, workspaceId)
    ).rejects.toThrow("Proposal not found");
  });

  it("throws NOT_FOUND when proposal belongs to different workspace", async () => {
    vi.mocked(ProposalService.ProposalService.findById).mockResolvedValue({
      ...mockProposal,
      workspaceId: "different_workspace",
      views: [],
      signatures: [],
      payments: [],
    });

    await expect(
      ContractService.createFromProposal(proposalId, workspaceId)
    ).rejects.toThrow("Proposal not found");
  });
});

describe("ContractService.sendForSigning", () => {
  const workspaceId = "ws_123";
  const contractId = "contract_123";

  const mockDraftContract: ContractSelect = {
    id: contractId,
    workspaceId,
    proposalId: "prop_123",
    clientId: null,
    title: "Service Agreement",
    content: {
      sections: [{ title: "Services", body: "We will provide SEO services." }],
      terms: "Standard terms apply.",
      signatures: [{ role: "Client" }],
    },
    dokobitSessionId: null,
    signedPdfUrl: null,
    signedAt: null,
    signerName: null,
    status: "draft",
    sentAt: null,
    executedAt: null,
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("transitions from draft to sent and calls DokobitService", async () => {
    vi.mocked(ContractRepository.getContractById).mockResolvedValue(mockDraftContract);
    vi.mocked(ContractPdfGenerator.generateContractPdf).mockResolvedValue(
      Buffer.from("PDF content")
    );
    vi.mocked(DokobitService.DokobitService.createSigningSession).mockResolvedValue({
      sessionId: "dokobit_123",
      signingUrl: "https://dokobit.com/sign/123",
    });

    const sentContract = { ...mockDraftContract, status: "sent" as const };
    vi.mocked(ContractRepository.transitionContractState).mockResolvedValue(sentContract);
    vi.mocked(ActivityRepository.recordStatusChange).mockResolvedValue({} as any);

    const result = await ContractService.sendForSigning(contractId, workspaceId);

    expect(result.contract.status).toBe("sent");
    expect(result.signingUrl).toBe("https://dokobit.com/sign/123");
    expect(ContractPdfGenerator.generateContractPdf).toHaveBeenCalled();
    expect(DokobitService.DokobitService.createSigningSession).toHaveBeenCalled();
    expect(ActivityRepository.recordStatusChange).toHaveBeenCalledWith(
      workspaceId,
      "contract",
      contractId,
      "draft",
      "sent",
      undefined
    );
  });

  it("throws CONFLICT when contract is not in draft status", async () => {
    const signedContract = { ...mockDraftContract, status: "signed" as const };
    vi.mocked(ContractRepository.getContractById).mockResolvedValue(signedContract);

    await expect(
      ContractService.sendForSigning(contractId, workspaceId)
    ).rejects.toThrow("Invalid state transition");
  });

  it("throws NOT_FOUND when contract does not exist", async () => {
    vi.mocked(ContractRepository.getContractById).mockResolvedValue(undefined);

    await expect(
      ContractService.sendForSigning(contractId, workspaceId)
    ).rejects.toThrow("Contract not found");
  });
});
