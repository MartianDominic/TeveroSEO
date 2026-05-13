/**
 * QuickCaptureService - Phase 101-03
 *
 * Enables < 5 second deal creation via quick capture.
 * Per D-01: When inserting at later stage, auto-creates upstream records
 * (entity chain creation).
 */
import { nanoid } from "nanoid";
import { db } from "@/db";
import { prospects, type PipelineStage } from "@/db/prospect-schema";
import { proposals, type ProposalContent } from "@/db/proposal-schema";
import { contracts, type ContractContent } from "@/db/contract-schema";
import { pipelineActivities } from "@/db/activity-schema";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "QuickCaptureService" });

/**
 * Input for quick capture - minimal fields for fast entry.
 */
export interface QuickCaptureInput {
  domain: string;
  contactEmail?: string;
  contactPhone?: string;
  contactName?: string;
  companyName?: string;
  stage?: PipelineStage;
  notes?: string;
  workspaceId: string;
  userId?: string;
}

/**
 * Result of quick capture - IDs for navigation.
 */
export interface QuickCaptureResult {
  prospectId: string;
  proposalId?: string;
  contractId?: string;
  chainCreated: string[];
}

// Stages that require contract creation (full chain)
const SIGNED_STAGES: PipelineStage[] = ["converted"];
// Stages that require proposal creation
const PROPOSAL_STAGES: PipelineStage[] = ["negotiating", "converted"];

export const QuickCaptureService = {
  /**
   * Create a deal stub quickly (< 5 seconds).
   * Per D-01: When inserting at later stage, auto-creates upstream records.
   *
   * Chain creation logic:
   * - "new", "analyzing", "scored", "qualified", "contacted": prospect only
   * - "negotiating": prospect + proposal stub
   * - "converted": prospect + proposal stub (accepted) + contract stub
   */
  async quickCapture(input: QuickCaptureInput): Promise<QuickCaptureResult> {
    const {
      domain,
      contactEmail,
      contactPhone,
      contactName,
      companyName,
      stage = "new",
      notes,
      workspaceId,
      userId,
    } = input;

    const result: QuickCaptureResult = {
      prospectId: "",
      chainCreated: [],
    };

    // Normalize domain (strip protocol, www, trailing slash)
    const normalizedDomain = this.normalizeDomain(domain);

    // 1. Always create prospect
    const prospectId = nanoid();
    const [prospect] = await db.insert(prospects).values({
      id: prospectId,
      workspaceId,
      domain: normalizedDomain,
      contactEmail: contactEmail || undefined,
      contactName: contactName || undefined,
      companyName: companyName || undefined,
      notes: notes || undefined,
      pipelineStage: stage,
      status: stage === "converted" ? "converted" : "new",
      source: "manual_entry",
    }).returning();

    result.prospectId = prospect.id;
    result.chainCreated.push("prospect");

    // 2. Create proposal stub if stage requires it (negotiating, converted)
    if (PROPOSAL_STAGES.includes(stage)) {
      const proposalId = nanoid();
      const token = nanoid(32);

      const minimalContent: ProposalContent = {
        hero: {
          headline: `Proposal for ${normalizedDomain}`,
          subheadline: "Manually entered deal",
          trafficValue: 0,
        },
        currentState: {
          traffic: 0,
          keywords: 0,
          value: 0,
          chartData: [],
        },
        opportunities: [],
        roi: {
          projectedTrafficGain: 0,
          trafficValue: 0,
          defaultConversionRate: 0.02,
          defaultAov: 100,
        },
        investment: {
          setupFee: 0,
          monthlyFee: 0,
          inclusions: [],
        },
        nextSteps: [],
      };

      const [proposal] = await db.insert(proposals).values({
        id: proposalId,
        prospectId,
        workspaceId,
        template: "standard",
        content: minimalContent,
        status: stage === "converted" ? "paid" : "accepted",
        token,
      }).returning();

      result.proposalId = proposal.id;
      result.chainCreated.push("proposal");

      // 3. Create contract stub if signed/converted
      if (SIGNED_STAGES.includes(stage)) {
        const contractId = nanoid();

        const minimalContractContent: ContractContent = {
          sections: [],
          terms: "",
          signatures: [],
        };

        const [contract] = await db.insert(contracts).values({
          id: contractId,
          proposalId,
          workspaceId,
          status: "executed",
          title: `Contract - ${normalizedDomain}`,
          content: minimalContractContent,
        }).returning();

        result.contractId = contract.id;
        result.chainCreated.push("contract");
      }
    }

    // 4. Log activity
    await db.insert(pipelineActivities).values({
      id: nanoid(),
      workspaceId,
      entityType: "prospect",
      entityId: prospect.id,
      activityType: "created",
      activityData: {
        source: "manual_entry",
        insertedAtStage: stage,
        chainCreated: result.chainCreated,
        quickCapture: true,
      },
      actorId: userId,
    });

    log.info("Quick capture complete", {
      prospectId: result.prospectId,
      stage,
      chainCreated: result.chainCreated,
    });

    return result;
  },

  /**
   * Normalize domain by stripping protocol, www, path, and port.
   */
  normalizeDomain(domain: string): string {
    let normalized = domain.toLowerCase().trim();
    // Remove protocol
    normalized = normalized.replace(/^https?:\/\//, "");
    // Remove www
    normalized = normalized.replace(/^www\./, "");
    // Remove query string and fragment first
    normalized = normalized.split("?")[0];
    normalized = normalized.split("#")[0];
    // Remove trailing slash and path
    normalized = normalized.split("/")[0];
    // Remove port
    normalized = normalized.split(":")[0];
    return normalized;
  },
};
