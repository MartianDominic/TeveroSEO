/**
 * DeveloperHandoffService - Manages developer handoff flow with magic links.
 * Phase 66: Platform Unification Excellence - Plan 05
 *
 * Enables non-technical users to delegate installation to developers
 * by sending professional emails with pre-filled instructions and magic links.
 *
 * Security mitigations:
 * - T-66-13: Email format validation
 * - T-66-14: 30-day expiry, single-use status tracking
 * - T-66-15: Rate limit 5 handoffs per site per day
 * - T-66-16: Sender name sanitization to prevent email injection
 */
import { eq, and, gte } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  developerHandoffs,
  pixelInstallations,
  type DeveloperHandoffSelect,
} from "@/db/pixel-schema";
import type { DbClient } from "@/db";
import { generatePixelScript } from "./pixel-script.service";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "DeveloperHandoffService" });

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Request to create a new developer handoff
 */
export interface CreateHandoffRequest {
  /** Pixel installation ID */
  installationId: string;
  /** Developer's email address */
  email: string;
  /** Developer's name (optional) */
  name?: string;
  /** Custom message from sender (optional) */
  message?: string;
  /** Name of the person sending the handoff */
  senderName: string;
  /** Domain for display in email */
  domain: string;
}

/**
 * Result of creating a handoff
 */
export interface CreateHandoffResult {
  id: string;
  magicLink: string;
  status: "sent" | "opened" | "completed" | "expired";
}

/**
 * Generated email content for handoff
 */
export interface HandoffEmail {
  to: string;
  subject: string;
  body: string;
  magicLink: string;
}

/**
 * Email service interface for dependency injection
 */
export interface EmailServiceInterface {
  sendEmail(options: {
    templateId: string;
    to: string;
    workspaceId: string;
    variables: Record<string, string>;
  }): Promise<{ success: boolean; messageId?: string }>;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Magic link token length (32 chars = ~10^57 entropy per STATE.md decision 57-08) */
const TOKEN_LENGTH = 32;

/** Token expiry in days */
const TOKEN_EXPIRY_DAYS = 30;

/** Maximum handoffs per installation per day (T-66-15) */
const MAX_HANDOFFS_PER_DAY = 5;

/** Maximum reminder emails allowed */
const MAX_REMINDERS = 3;

/** Base URL for magic links */
const MAGIC_LINK_BASE_URL = "https://app.tevero.io/install";

// -----------------------------------------------------------------------------
// Email validation regex
// -----------------------------------------------------------------------------

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// -----------------------------------------------------------------------------
// Service Class
// -----------------------------------------------------------------------------

/**
 * DeveloperHandoffService - Manages developer handoff flow.
 */
export class DeveloperHandoffService {
  constructor(
    private readonly db: DbClient,
    private readonly emailService?: EmailServiceInterface
  ) {}

  /**
   * Create a new developer handoff and send email.
   *
   * @param request - Handoff creation request
   * @returns Created handoff with magic link
   * @throws Error if validation fails, rate limit exceeded, or installation not found
   */
  async createHandoff(request: CreateHandoffRequest): Promise<CreateHandoffResult> {
    // Validate email format (T-66-13)
    if (!this.validateEmail(request.email)) {
      throw new Error("Invalid email format");
    }

    // Verify installation exists
    const installation = await this.db.query.pixelInstallations.findFirst({
      where: eq(pixelInstallations.id, request.installationId),
    });

    if (!installation) {
      throw new Error("Installation not found");
    }

    // Check rate limit (T-66-15)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayHandoffs = await this.db.query.developerHandoffs.findMany({
      where: and(
        eq(developerHandoffs.installationId, request.installationId),
        gte(developerHandoffs.sentAt, today)
      ),
    });

    if (todayHandoffs.length >= MAX_HANDOFFS_PER_DAY) {
      throw new Error("Rate limit exceeded: maximum 5 handoffs per site per day");
    }

    // Generate token and expiry
    const token = nanoid(TOKEN_LENGTH);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS);

    // Sanitize sender name (T-66-16)
    const sanitizedSenderName = this.sanitizeSenderName(request.senderName);

    // Create handoff record
    const [handoff] = await this.db
      .insert(developerHandoffs)
      .values({
        id: nanoid(),
        installationId: request.installationId,
        developerEmail: request.email,
        developerName: request.name,
        status: "sent",
        magicLinkToken: token,
        magicLinkExpiresAt: expiresAt,
        sentAt: new Date(),
        reminderCount: 0,
      })
      .returning();

    // Generate and send email
    const magicLink = `${MAGIC_LINK_BASE_URL}/${token}`;

    if (this.emailService) {
      await this.emailService.sendEmail({
        templateId: "developer-handoff",
        to: request.email,
        workspaceId: installation.workspaceId,
        variables: {
          domain: request.domain,
          siteId: installation.siteId,
          senderName: sanitizedSenderName,
          message: request.message || "",
          magicLink,
          snippet: generatePixelScript(installation.siteId),
        },
      });
    }

    log.info("Handoff created", {
      handoffId: handoff.id,
      installationId: request.installationId,
      email: request.email,
    });

    return {
      id: handoff.id,
      magicLink,
      status: handoff.status as "sent",
    };
  }

  /**
   * Get handoff by magic link token.
   * Updates status to 'opened' on first access.
   *
   * @param token - Magic link token
   * @returns Handoff record or null if not found/expired
   */
  async getHandoffByToken(token: string): Promise<DeveloperHandoffSelect | null> {
    const handoff = await this.db.query.developerHandoffs.findFirst({
      where: eq(developerHandoffs.magicLinkToken, token),
    });

    if (!handoff) {
      return null;
    }

    // Check if expired (T-66-14)
    if (handoff.magicLinkExpiresAt && new Date() > handoff.magicLinkExpiresAt) {
      // Update status to expired if not already
      if (handoff.status !== "expired") {
        await this.db
          .update(developerHandoffs)
          .set({ status: "expired" })
          .where(eq(developerHandoffs.id, handoff.id));
      }
      return null;
    }

    // Update status to 'opened' on first access
    if (handoff.status === "sent") {
      const [updated] = await this.db
        .update(developerHandoffs)
        .set({
          status: "opened",
          openedAt: new Date(),
        })
        .where(eq(developerHandoffs.id, handoff.id))
        .returning();

      return updated;
    }

    return handoff;
  }

  /**
   * Mark handoff as completed (pixel verified).
   *
   * @param handoffId - Handoff ID
   * @throws Error if handoff not found
   */
  async completeHandoff(handoffId: string): Promise<void> {
    const handoff = await this.db.query.developerHandoffs.findFirst({
      where: eq(developerHandoffs.id, handoffId),
    });

    if (!handoff) {
      throw new Error("Handoff not found");
    }

    await this.db
      .update(developerHandoffs)
      .set({
        status: "completed",
        completedAt: new Date(),
      })
      .where(eq(developerHandoffs.id, handoffId));

    log.info("Handoff completed", { handoffId });
  }

  /**
   * Get all handoffs for a pixel installation.
   *
   * @param installationId - Installation ID
   * @returns List of handoffs
   */
  async getHandoffsForSite(installationId: string): Promise<DeveloperHandoffSelect[]> {
    return this.db.query.developerHandoffs.findMany({
      where: eq(developerHandoffs.installationId, installationId),
    });
  }

  /**
   * Send a reminder email for a pending handoff.
   *
   * @param handoffId - Handoff ID
   * @returns true if reminder sent, false if max reminders reached
   * @throws Error if handoff not found
   */
  async sendReminder(handoffId: string): Promise<boolean> {
    const handoff = await this.db.query.developerHandoffs.findFirst({
      where: eq(developerHandoffs.id, handoffId),
    });

    if (!handoff) {
      throw new Error("Handoff not found");
    }

    // Check reminder limit
    if (handoff.reminderCount >= MAX_REMINDERS) {
      log.info("Reminder limit reached", { handoffId, count: handoff.reminderCount });
      return false;
    }

    // Get installation for email context
    const installation = await this.db.query.pixelInstallations.findFirst({
      where: eq(pixelInstallations.id, handoff.installationId),
    });

    if (!installation) {
      throw new Error("Installation not found for handoff");
    }

    // Generate reminder email
    const magicLink = `${MAGIC_LINK_BASE_URL}/${handoff.magicLinkToken}`;

    if (this.emailService) {
      await this.emailService.sendEmail({
        templateId: "developer-handoff-reminder",
        to: handoff.developerEmail,
        workspaceId: installation.workspaceId,
        variables: {
          domain: installation.domain,
          siteId: installation.siteId,
          magicLink,
          snippet: generatePixelScript(installation.siteId),
          reminderNumber: String(handoff.reminderCount + 1),
        },
      });
    }

    // Update reminder count
    await this.db
      .update(developerHandoffs)
      .set({
        reminderCount: handoff.reminderCount + 1,
        lastReminderAt: new Date(),
      })
      .where(eq(developerHandoffs.id, handoffId));

    log.info("Reminder sent", { handoffId, reminderNumber: handoff.reminderCount + 1 });
    return true;
  }

  /**
   * Generate email content for a handoff.
   * Used for previews and actual email sending.
   *
   * @param domain - Target domain
   * @param siteId - Pixel site ID
   * @param senderName - Name of person sending handoff
   * @param message - Optional custom message
   * @param token - Magic link token
   * @returns Email content
   */
  generateEmailContent(
    domain: string,
    siteId: string,
    senderName: string,
    message: string | undefined,
    token: string
  ): HandoffEmail {
    const magicLink = `${MAGIC_LINK_BASE_URL}/${token}`;
    const snippet = generatePixelScript(siteId);
    const sanitizedSenderName = this.sanitizeSenderName(senderName);

    const subject = `Add TeveroSEO to ${domain} (30 seconds)`;

    let body = `Hi,

${sanitizedSenderName} has asked you to add TeveroSEO tracking to ${domain}. Here's all you need:
`;

    if (message) {
      body += `
"${message}"
`;
    }

    body += `
Add this line to the <head> of your site:

${snippet}

Or click the button below for step-by-step instructions.

That's it! Questions? Reply to this email.
`;

    return {
      to: "",
      subject,
      body,
      magicLink,
    };
  }

  /**
   * Validate email format.
   */
  private validateEmail(email: string): boolean {
    return EMAIL_REGEX.test(email);
  }

  /**
   * Sanitize sender name to prevent email header injection (T-66-16).
   * Removes newlines, carriage returns, and potential header fields.
   */
  private sanitizeSenderName(name: string): string {
    return name
      .replace(/[\r\n]/g, " ") // Remove newlines
      .replace(/[<>]/g, "") // Remove angle brackets
      .replace(/\b(To|From|Cc|Bcc|Subject|Content-Type):/gi, "") // Remove header-like patterns
      .trim()
      .slice(0, 100); // Limit length
  }
}

// -----------------------------------------------------------------------------
// Factory Function
// -----------------------------------------------------------------------------

/**
 * Create a DeveloperHandoffService instance.
 *
 * @param db - Database client
 * @param emailService - Optional email service for sending emails
 * @returns DeveloperHandoffService instance
 */
export function createDeveloperHandoffService(
  db: DbClient,
  emailService?: EmailServiceInterface
): DeveloperHandoffService {
  return new DeveloperHandoffService(db, emailService);
}
