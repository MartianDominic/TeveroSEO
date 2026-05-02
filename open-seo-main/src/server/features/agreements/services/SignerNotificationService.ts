/**
 * Signer Notification Service
 * Phase 59: Agreement & Signing Excellence - Pre-Signing Flow (59-06)
 *
 * Sends magic link emails to signers using Resend.
 * Per D-06: Magic links use /c/{token} format with 14-day expiry.
 * Per D-16: Magic links route to client contract page.
 *
 * Email templates support EN/LT locales.
 */
import { Resend } from "resend";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "SignerNotificationService" });

// Resend client lazily initialized
let resendClient: Resend | null = null;

function getResend(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

const getAppUrl = () => process.env.APP_URL || "http://localhost:3000";
const getFromAddress = () =>
  process.env.EMAIL_FROM || "TeveroSEO <noreply@teveroseo.com>";

export interface SigningInvitationParams {
  signerEmail: string;
  signerName: string;
  agreementTitle: string;
  accessToken: string;
  workspaceName?: string;
  locale?: "en" | "lt";
}

export interface ReminderParams extends SigningInvitationParams {
  daysRemaining: number;
}

export interface ConfirmationParams {
  signerEmail: string;
  signerName: string;
  agreementTitle: string;
  locale?: "en" | "lt";
}

export const SignerNotificationService = {
  /**
   * Build magic link URL for client contract page.
   * Per D-16: Route is /{locale}/c/{token}
   */
  getMagicLink(token: string, locale: "en" | "lt" = "en"): string {
    return `${getAppUrl()}/${locale}/c/${token}`;
  },

  /**
   * Send signing invitation email with magic link.
   * Per D-06: Link expires in 14 days (enforced in SignerRepository).
   */
  async sendSigningInvitation(
    params: SigningInvitationParams
  ): Promise<{ success: boolean; error?: string }> {
    const {
      signerEmail,
      signerName,
      agreementTitle,
      accessToken,
      workspaceName,
      locale = "en",
    } = params;
    const magicLink = this.getMagicLink(accessToken, locale);

    try {
      const resend = getResend();
      const { error } = await resend.emails.send({
        from: getFromAddress(),
        to: signerEmail,
        subject: this.getInvitationSubject(agreementTitle, locale),
        html: this.buildInvitationHtml({
          signerName,
          agreementTitle,
          magicLink,
          workspaceName,
          locale,
        }),
      });

      if (error) {
        log.error("Failed to send signing invitation", new Error(error.message), {
          signerEmail,
          agreementTitle,
        });
        return { success: false, error: error.message };
      }

      log.info("Signing invitation sent", {
        signerEmail,
        agreementTitle,
        locale,
      });
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      log.error("Exception sending signing invitation", err instanceof Error ? err : new Error(errorMessage), {
        signerEmail,
      });
      return { success: false, error: "Email delivery failed" };
    }
  },

  /**
   * Send reminder email for unsigned agreement.
   * Includes urgency messaging with days remaining.
   */
  async sendReminder(
    params: ReminderParams
  ): Promise<{ success: boolean; error?: string }> {
    const {
      signerEmail,
      signerName,
      agreementTitle,
      accessToken,
      daysRemaining,
      workspaceName,
      locale = "en",
    } = params;
    const magicLink = this.getMagicLink(accessToken, locale);

    try {
      const resend = getResend();
      const { error } = await resend.emails.send({
        from: getFromAddress(),
        to: signerEmail,
        subject: this.getReminderSubject(agreementTitle, locale),
        html: this.buildReminderHtml({
          signerName,
          agreementTitle,
          magicLink,
          daysRemaining,
          workspaceName,
          locale,
        }),
      });

      if (error) {
        log.error("Failed to send reminder", new Error(error.message), {
          signerEmail,
        });
        return { success: false, error: error.message };
      }

      log.info("Reminder sent", { signerEmail, agreementTitle, daysRemaining });
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      log.error("Exception sending reminder", err instanceof Error ? err : new Error(errorMessage));
      return { success: false, error: "Email delivery failed" };
    }
  },

  /**
   * Send confirmation email after successful signing.
   */
  async sendSignedConfirmation(
    params: ConfirmationParams
  ): Promise<{ success: boolean; error?: string }> {
    const { signerEmail, signerName, agreementTitle, locale = "en" } = params;

    try {
      const resend = getResend();
      const { error } = await resend.emails.send({
        from: getFromAddress(),
        to: signerEmail,
        subject: this.getConfirmationSubject(agreementTitle, locale),
        html: this.buildConfirmationHtml({ signerName, agreementTitle, locale }),
      });

      if (error) {
        log.error("Failed to send confirmation", new Error(error.message), {
          signerEmail,
        });
        return { success: false, error: error.message };
      }

      log.info("Confirmation sent", { signerEmail, agreementTitle });
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      log.error("Exception sending confirmation", err instanceof Error ? err : new Error(errorMessage));
      return { success: false, error: "Email delivery failed" };
    }
  },

  // --- Subject lines ---

  getInvitationSubject(title: string, locale: "en" | "lt"): string {
    return locale === "lt"
      ? `Veiksmas reikalingas: Pasirasyti "${title}"`
      : `Action Required: Sign "${title}"`;
  },

  getReminderSubject(title: string, locale: "en" | "lt"): string {
    return locale === "lt"
      ? `Priminimas: "${title}" laukia jusu paraso`
      : `Reminder: "${title}" awaits your signature`;
  },

  getConfirmationSubject(title: string, locale: "en" | "lt"): string {
    return locale === "lt"
      ? `Pasirasytas: "${title}"`
      : `Signed: "${title}"`;
  },

  // --- HTML Templates ---

  buildInvitationHtml(params: {
    signerName: string;
    agreementTitle: string;
    magicLink: string;
    workspaceName?: string;
    locale: "en" | "lt";
  }): string {
    const { signerName, agreementTitle, magicLink, workspaceName, locale } = params;
    const isLt = locale === "lt";

    return `
<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isLt ? "Pasirasymo kvietimas" : "Signing Invitation"}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
  <div style="background-color: #ffffff; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h1 style="color: #111827; font-size: 24px; margin-bottom: 24px; font-weight: 600;">
      ${isLt ? "Sveiki" : "Hello"}, ${signerName}
    </h1>

    <p style="margin-bottom: 16px; color: #374151; font-size: 16px;">
      ${isLt
        ? `Jums buvo issiusta sutartis pasirasyti: <strong>"${agreementTitle}"</strong>`
        : `You have been invited to sign: <strong>"${agreementTitle}"</strong>`
      }
    </p>

    ${workspaceName ? `
    <p style="margin-bottom: 16px; color: #6b7280; font-size: 14px;">
      ${isLt ? "Nuo" : "From"}: ${workspaceName}
    </p>
    ` : ""}

    <p style="margin-bottom: 24px; color: #374151; font-size: 16px;">
      ${isLt
        ? "Spustelekite zemiau esanti mygtuka, kad perziuretumete ir pasirasytumete dokumenta."
        : "Click the button below to review and sign the document."
      }
    </p>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${magicLink}" style="display: inline-block; background: linear-gradient(180deg, #1A6E55 0%, #0F4F3D 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 16px; box-shadow: 0 2px 4px rgba(15, 79, 61, 0.2);">
        ${isLt ? "Perziureti ir Pasirasyti" : "Review & Sign"}
      </a>
    </div>

    <p style="margin-top: 24px; font-size: 14px; color: #6b7280;">
      ${isLt
        ? "Si nuoroda galioja 14 dienu."
        : "This link is valid for 14 days."
      }
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">

    <p style="font-size: 12px; color: #9ca3af;">
      ${isLt
        ? "Jei negavote sio prasymo, galite si el. laiska ignoruoti."
        : "If you did not expect this request, you can safely ignore this email."
      }
    </p>
  </div>
</body>
</html>
    `.trim();
  },

  buildReminderHtml(params: {
    signerName: string;
    agreementTitle: string;
    magicLink: string;
    daysRemaining: number;
    workspaceName?: string;
    locale: "en" | "lt";
  }): string {
    const { signerName, agreementTitle, magicLink, daysRemaining, locale } = params;
    const isLt = locale === "lt";

    return `
<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isLt ? "Priminimas" : "Reminder"}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
  <div style="background-color: #ffffff; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h1 style="color: #111827; font-size: 24px; margin-bottom: 24px; font-weight: 600;">
      ${isLt ? "Priminimas" : "Reminder"}: ${agreementTitle}
    </h1>

    <p style="margin-bottom: 16px; color: #374151; font-size: 16px;">
      ${isLt
        ? `Primename, kad sutartis <strong>"${agreementTitle}"</strong> laukia jusu paraso.`
        : `This is a reminder that <strong>"${agreementTitle}"</strong> is awaiting your signature.`
      }
    </p>

    <p style="margin-bottom: 24px; color: #dc2626; font-size: 16px; font-weight: 500;">
      ${isLt
        ? `Nuoroda galioja dar ${daysRemaining} ${daysRemaining === 1 ? "diena" : "dienas"}.`
        : `The link expires in ${daysRemaining} ${daysRemaining === 1 ? "day" : "days"}.`
      }
    </p>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${magicLink}" style="display: inline-block; background: linear-gradient(180deg, #1A6E55 0%, #0F4F3D 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 16px; box-shadow: 0 2px 4px rgba(15, 79, 61, 0.2);">
        ${isLt ? "Pasirasyti Dabar" : "Sign Now"}
      </a>
    </div>
  </div>
</body>
</html>
    `.trim();
  },

  buildConfirmationHtml(params: {
    signerName: string;
    agreementTitle: string;
    locale: "en" | "lt";
  }): string {
    const { signerName, agreementTitle, locale } = params;
    const isLt = locale === "lt";

    return `
<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isLt ? "Patvirtinimas" : "Confirmation"}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
  <div style="background-color: #ffffff; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="width: 64px; height: 64px; background-color: #dcfce7; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
    </div>

    <h1 style="color: #16a34a; font-size: 24px; margin-bottom: 24px; font-weight: 600; text-align: center;">
      ${isLt ? "Dokumentas Sekmingai Pasirasytas" : "Document Signed Successfully"}
    </h1>

    <p style="margin-bottom: 16px; color: #374151; font-size: 16px;">
      ${isLt ? "Sveiki" : "Hello"}, ${signerName},
    </p>

    <p style="margin-bottom: 16px; color: #374151; font-size: 16px;">
      ${isLt
        ? `Jus sekmingai pasiraset <strong>"${agreementTitle}"</strong>.`
        : `You have successfully signed <strong>"${agreementTitle}"</strong>.`
      }
    </p>

    <p style="margin-bottom: 16px; color: #374151; font-size: 16px;">
      ${isLt
        ? "Pasirasyto dokumento kopija bus atsiusta jums, kai visos salys pasirasysi."
        : "A copy of the signed document will be sent to you once all parties have signed."
      }
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">

    <p style="color: #6b7280; font-size: 14px; text-align: center;">
      ${isLt ? "Dekojame, kad naudojates TeveroSEO." : "Thank you for using TeveroSEO."}
    </p>
  </div>
</body>
</html>
    `.trim();
  },
};
