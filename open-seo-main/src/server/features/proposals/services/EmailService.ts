/**
 * Email Service for Proposals
 * Phase 46-47: Proposal System
 *
 * Handles sending proposal emails via Resend with React Email templates.
 */
import { Resend } from "resend";
import { render } from "@react-email/render";
import { ProposalEmail } from "../email-templates/ProposalEmail";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";
import type { ProposalSelect } from "@/db/proposal-schema";

const log = createLogger({ module: "EmailService" });

const TIMEOUT_MS = 10000;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 2000;

export interface SendProposalEmailInput {
  proposal: ProposalSelect;
  recipientEmail: string;
  recipientName: string;
  companyName: string;
  agencyName?: string;
}

export interface SendProposalEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Get Resend client instance.
 * Throws if API key not configured.
 */
function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new AppError("AUTH_CONFIG_MISSING", "RESEND_API_KEY not configured");
  }
  return new Resend(apiKey);
}

/**
 * Build public proposal URL from token.
 */
function buildProposalUrl(token: string): string {
  const baseUrl = process.env.PUBLIC_URL || "https://app.tevero.io";
  return `${baseUrl}/proposals/${token}`;
}

/**
 * Send proposal email to recipient.
 * Retries up to MAX_RETRIES times with exponential backoff.
 */
export async function sendProposalEmail(
  input: SendProposalEmailInput
): Promise<SendProposalEmailResult> {
  const resend = getResendClient();
  const { proposal, recipientEmail, recipientName, companyName, agencyName = "Tevero" } = input;

  const proposalUrl = buildProposalUrl(proposal.token);
  const expiresAt = proposal.expiresAt
    ? new Date(proposal.expiresAt).toLocaleDateString("lt-LT")
    : "30 dienu";

  const emailHtml = await render(
    ProposalEmail({
      recipientName,
      companyName,
      proposalUrl,
      expiresAt,
      agencyName,
    })
  );

  const fromEmail = process.env.RESEND_FROM_EMAIL || "proposals@tevero.io";

  log.info("Sending proposal email", { proposalId: proposal.id, to: recipientEmail });

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await resend.emails.send({
        from: fromEmail,
        to: recipientEmail,
        subject: `SEO pasiulymas: ${companyName}`,
        html: emailHtml,
      });

      if (response.error) {
        log.error("Resend API error", undefined, { error: response.error, attempt });
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, BASE_BACKOFF_MS * attempt));
          continue;
        }
        return { success: false, error: response.error.message };
      }

      log.info("Proposal email sent", { proposalId: proposal.id, messageId: response.data?.id });
      return { success: true, messageId: response.data?.id };
    } catch (error) {
      log.error("Email send failed", error instanceof Error ? error : new Error(String(error)), { attempt });
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, BASE_BACKOFF_MS * attempt));
        continue;
      }
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  return { success: false, error: "Max retries exceeded" };
}

export const EmailService = {
  sendProposalEmail,
  buildProposalUrl,
};
