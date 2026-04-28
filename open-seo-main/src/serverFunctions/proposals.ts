/**
 * Proposal management server functions.
 * Phase 30: Interactive Proposals - Schema & Builder
 *
 * TanStack Start server functions for proposal CRUD operations.
 * All endpoints require authentication and verify workspace ownership.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ProposalService } from "@/server/features/proposals/services/ProposalService";
import {
  ViewTrackingService,
  calculateEngagementSignals,
} from "@/server/features/proposals/tracking";
import { requireAuthenticatedContext } from "@/serverFunctions/middleware";
import { PROPOSAL_STATUS } from "@/db/proposal-schema";

/**
 * Schema for proposal content.
 */
const proposalContentSchema = z.object({
  hero: z.object({
    headline: z.string(),
    subheadline: z.string(),
    trafficValue: z.number(),
  }),
  currentState: z.object({
    traffic: z.number(),
    keywords: z.number(),
    value: z.number(),
    chartData: z.array(
      z.object({
        month: z.string(),
        traffic: z.number(),
      }),
    ),
  }),
  opportunities: z.array(
    z.object({
      keyword: z.string(),
      volume: z.number(),
      difficulty: z.enum(["easy", "medium", "hard"]),
      potential: z.number(),
    }),
  ),
  roi: z.object({
    projectedTrafficGain: z.number(),
    trafficValue: z.number(),
    defaultConversionRate: z.number(),
    defaultAov: z.number(),
  }),
  investment: z.object({
    setupFee: z.number(),
    monthlyFee: z.number(),
    inclusions: z.array(z.string()),
  }),
  nextSteps: z.array(z.string()),
});

/**
 * Schema for brand configuration.
 */
const brandConfigSchema = z.object({
  logoUrl: z.string().nullable(),
  primaryColor: z.string(),
  secondaryColor: z.string(),
  fontFamily: z.string(),
});

/**
 * Schema for creating a proposal.
 */
const createProposalSchema = z.object({
  prospectId: z.string().min(1, "Prospect ID is required"),
  template: z.string().optional(),
  content: proposalContentSchema.optional(),
  brandConfig: brandConfigSchema.optional(),
  setupFeeCents: z.number().int().positive().optional(),
  monthlyFeeCents: z.number().int().positive().optional(),
  currency: z.string().length(3).optional(),
});

/**
 * Schema for updating a proposal.
 */
const updateProposalSchema = z.object({
  template: z.string().optional(),
  content: proposalContentSchema.optional(),
  brandConfig: brandConfigSchema.optional(),
  setupFeeCents: z.number().int().positive().optional(),
  monthlyFeeCents: z.number().int().positive().optional(),
  currency: z.string().length(3).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
});

/**
 * Schema for listing proposals.
 */
const listProposalsSchema = z.object({
  page: z.number().int().positive().optional().default(1),
  pageSize: z.number().int().positive().max(100).optional().default(20),
  status: z.enum(PROPOSAL_STATUS).optional(),
});

/**
 * Create a new proposal from a prospect.
 *
 * Verifies auth.organizationId from session and prospect ownership.
 */
export const createProposal = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => createProposalSchema.parse(data))
  .handler(async ({ data, context }) => {
    const proposal = await ProposalService.create({
      prospectId: data.prospectId,
      workspaceId: context.organizationId,
      template: data.template,
      content: data.content,
      brandConfig: data.brandConfig,
      setupFeeCents: data.setupFeeCents,
      monthlyFeeCents: data.monthlyFeeCents,
      currency: data.currency,
    });
    return proposal;
  });

/**
 * Get proposal by ID with views, signatures, and payments.
 *
 * Filters results by organizationId to prevent cross-tenant access.
 */
export const getProposal = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const proposal = await ProposalService.findById(data.id);

    if (!proposal) {
      throw new Error("Proposal not found");
    }

    // Verify workspace ownership
    if (proposal.workspaceId !== context.organizationId) {
      throw new Error("Proposal not found");
    }

    return proposal;
  });

/**
 * List proposals for current workspace.
 *
 * Page size limited to max 100 to prevent DoS.
 */
export const listProposals = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) => listProposalsSchema.parse(data))
  .handler(async ({ data, context }) => {
    return ProposalService.findByWorkspace(context.organizationId, data);
  });

/**
 * Update proposal.
 *
 * Re-verifies workspaceId ownership before update.
 */
export const updateProposal = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().min(1),
        updates: updateProposalSchema,
      })
      .parse(data),
  )
  .handler(async ({ data: { id, updates }, context }) => {
    // Verify ownership first
    const existing = await ProposalService.findById(id);
    if (!existing || existing.workspaceId !== context.organizationId) {
      throw new Error("Proposal not found");
    }

    return ProposalService.update(id, {
      ...updates,
      expiresAt: updates.expiresAt ? new Date(updates.expiresAt) : undefined,
    });
  });

/**
 * Mark proposal as sent.
 *
 * Verifies workspace ownership and draft status.
 */
export const sendProposal = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().min(1),
        expiresAt: z.string().datetime().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    // Verify ownership first
    const existing = await ProposalService.findById(data.id);
    if (!existing || existing.workspaceId !== context.organizationId) {
      throw new Error("Proposal not found");
    }

    return ProposalService.markSent(
      data.id,
      data.expiresAt ? new Date(data.expiresAt) : undefined,
    );
  });

/**
 * Delete proposal.
 *
 * Verifies workspace ownership before deletion.
 */
export const deleteProposal = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    // Verify ownership first
    const existing = await ProposalService.findById(data.id);
    if (!existing || existing.workspaceId !== context.organizationId) {
      throw new Error("Proposal not found");
    }

    await ProposalService.delete(data.id);
    return { success: true };
  });

/**
 * Get proposal by public token (unauthenticated).
 *
 * Used for recipients viewing proposals without logging in.
 */
export const getProposalByToken = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ token: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const proposal = await ProposalService.findByToken(data.token);

    if (!proposal) {
      throw new Error("Proposal not found");
    }

    // Check expiration
    if (proposal.expiresAt && new Date() > proposal.expiresAt) {
      throw new Error("Proposal has expired");
    }

    return proposal;
  });

/**
 * Record a view of a proposal (unauthenticated).
 *
 * Called when a recipient views a proposal via public token.
 */
export const recordProposalView = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        token: z.string().min(1),
        deviceType: z.string().optional(),
        ipHash: z.string().optional(),
        sectionsViewed: z.array(z.string()).optional(),
        durationSeconds: z.number().int().positive().optional(),
        roiCalculatorUsed: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const proposal = await ProposalService.findByToken(data.token);

    if (!proposal) {
      throw new Error("Proposal not found");
    }

    return ProposalService.recordView(proposal.id, {
      deviceType: data.deviceType,
      ipHash: data.ipHash,
      sectionsViewed: data.sectionsViewed,
      durationSeconds: data.durationSeconds,
      roiCalculatorUsed: data.roiCalculatorUsed,
    });
  });

/**
 * Accept a proposal (unauthenticated).
 *
 * Called when a recipient accepts a proposal via public token.
 */
export const acceptProposal = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ token: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const proposal = await ProposalService.findByToken(data.token);

    if (!proposal) {
      throw new Error("Proposal not found");
    }

    // Check expiration
    if (proposal.expiresAt && new Date() > proposal.expiresAt) {
      throw new Error("Proposal has expired");
    }

    return ProposalService.markAccepted(proposal.id);
  });

/**
 * Initiate proposal signing via Smart-ID or Mobile-ID (unauthenticated).
 *
 * Called when recipient initiates signing via public token.
 * Returns session ID and verification code to display.
 */
export const initiateProposalSigning = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        token: z.string().min(1),
        method: z.enum(["smart_id", "mobile_id"]),
        personalCode: z.string().length(11, "Personal code must be 11 digits"),
        phoneNumber: z.string().optional(),
        signerName: z.string().min(1, "Signer name is required"),
        country: z.enum(["LT", "EE", "LV"]).optional().default("LT"),
      })
      .refine(
        (data) => data.method !== "mobile_id" || data.phoneNumber,
        { message: "Phone number required for Mobile-ID", path: ["phoneNumber"] }
      )
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { initiateProposalSigning: initiateSigning } = await import(
      "@/server/features/proposals/signing"
    );

    const proposal = await ProposalService.findByToken(data.token);

    if (!proposal) {
      throw new Error("Proposal not found");
    }

    // Check expiration
    if (proposal.expiresAt && new Date() > proposal.expiresAt) {
      throw new Error("Proposal has expired");
    }

    return initiateSigning({
      proposalId: proposal.id,
      accessToken: data.token,
      method: data.method,
      personalCode: data.personalCode,
      phoneNumber: data.phoneNumber,
      signerName: data.signerName,
      country: data.country,
    });
  });

/**
 * Check signing status (unauthenticated).
 *
 * Poll this endpoint every 2 seconds until status is not "pending".
 */
export const checkProposalSigningStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        token: z.string().min(1),
        sessionId: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { checkSigningStatus } = await import(
      "@/server/features/proposals/signing"
    );

    const proposal = await ProposalService.findByToken(data.token);

    if (!proposal) {
      throw new Error("Proposal not found");
    }

    return checkSigningStatus(proposal.id, data.sessionId);
  });

// ============================================================================
// Engagement Analytics (Phase 30-04)
// ============================================================================

/**
 * Track proposal view with IP hashing and device detection (unauthenticated).
 *
 * Called when recipient first loads a proposal page.
 * Returns viewId for subsequent tracking calls.
 */
export const trackProposalView = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        proposalId: z.string().min(1),
        token: z.string().min(1),
        deviceType: z.enum(["mobile", "desktop", "tablet"]),
        // Client provides a fingerprint for session deduplication
        // Server will hash this for GDPR compliance
        clientFingerprint: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    // Verify token matches proposal
    const proposal = await ProposalService.findByToken(data.token);

    if (!proposal || proposal.id !== data.proposalId) {
      throw new Error("Proposal not found");
    }

    // Use client fingerprint or generate a random one for tracking
    // The ViewTrackingService will hash this for GDPR compliance
    const ipAddress = data.clientFingerprint ?? `anon-${Date.now()}`;
    const userAgent = "client-provided";

    const view = await ViewTrackingService.trackProposalView({
      proposalId: data.proposalId,
      deviceType: data.deviceType,
      ipAddress,
      userAgent,
    });

    return { viewId: view.id };
  });

/**
 * Update view duration (heartbeat from client).
 *
 * Called every 30 seconds while viewing.
 */
export const trackProposalDuration = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        viewId: z.string().min(1),
        durationSeconds: z.number().int().positive(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await ViewTrackingService.updateViewDuration(
      data.viewId,
      data.durationSeconds,
    );
    return { success: true };
  });

/**
 * Update sections viewed (from intersection observer).
 *
 * Called when user scrolls to new sections.
 */
export const trackProposalSections = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        viewId: z.string().min(1),
        sections: z.array(z.string()),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await ViewTrackingService.updateSectionsViewed(data.viewId, data.sections);
    return { success: true };
  });

/**
 * Mark ROI calculator as used.
 *
 * Called when user interacts with ROI calculator.
 */
export const trackRoiCalculatorUsage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        viewId: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await ViewTrackingService.markRoiCalculatorUsed(data.viewId);
    return { success: true };
  });

/**
 * Get engagement signals for a proposal (authenticated).
 *
 * Returns calculated engagement signals for agency dashboard.
 */
export const getProposalEngagementSignals = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) =>
    z.object({ proposalId: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    // Verify ownership
    const proposal = await ProposalService.findById(data.proposalId);
    if (!proposal || proposal.workspaceId !== context.organizationId) {
      throw new Error("Proposal not found");
    }

    const signals = await calculateEngagementSignals(data.proposalId);
    const views = await ViewTrackingService.getViewsByProposal(data.proposalId);

    return {
      signals,
      views,
      totalViews: views.length,
      totalDuration: views.reduce((sum, v) => sum + (v.durationSeconds ?? 0), 0),
    };
  });

// ============================================================================
// Payment (Phase 30-06)
// ============================================================================

/**
 * Create payment checkout session for a proposal (unauthenticated).
 *
 * Called after signing is complete to redirect to Stripe checkout.
 * Returns checkout URL to redirect the customer.
 */
export const createProposalPayment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        token: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { createPaymentCheckout } = await import(
      "@/server/features/proposals/payment"
    );

    const proposal = await ProposalService.findByToken(data.token);

    if (!proposal) {
      throw new Error("Proposal not found");
    }

    // Verify proposal is signed
    if (proposal.status !== "signed") {
      throw new Error("Proposal must be signed before payment");
    }

    // Get contact email from prospect if available
    // For now, use a default - in production, fetch from prospect
    const customerEmail = "customer@example.com";

    const appUrl = process.env.APP_URL ?? "http://localhost:3001";

    const result = await createPaymentCheckout({
      proposalId: proposal.id,
      customerEmail,
      setupFeeCents: proposal.setupFeeCents ?? 0,
      monthlyFeeCents: proposal.monthlyFeeCents ?? undefined,
      successUrl: `${appUrl}/p/${data.token}/payment/success`,
      cancelUrl: `${appUrl}/p/${data.token}?payment=cancelled`,
    });

    return { checkoutUrl: result.checkoutUrl };
  });

/**
 * Get payment status for a proposal (unauthenticated).
 *
 * Used to check if payment has been completed.
 */
export const getProposalPaymentStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        token: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const proposal = await ProposalService.findByToken(data.token);

    if (!proposal) {
      throw new Error("Proposal not found");
    }

    // Check if paid
    const isPaid = proposal.status === "paid" || proposal.status === "onboarded";

    return {
      status: proposal.status,
      isPaid,
      paidAt: proposal.paidAt,
    };
  });
