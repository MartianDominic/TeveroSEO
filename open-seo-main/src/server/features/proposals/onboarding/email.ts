/**
 * Email templates and sending for onboarding.
 * Phase 30-07: Auto-Onboarding
 *
 * Lithuanian email templates for:
 * - GSC invite
 * - Kickoff scheduling
 * - Client welcome
 * - Agency notification
 */

import { getRequiredEnvValue } from "@/server/lib/runtime-env";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "onboarding-email" });

const LOOPS_TRANSACTIONAL_URL = "https://app.loops.so/api/v1/transactional";

/**
 * Email content structure
 */
export interface EmailContent {
  subject: string;
  body: string;
}

/**
 * GSC invite email parameters
 */
export interface GscInviteEmailParams {
  to: string;
  clientName: string;
  domain: string;
  connectUrl: string;
}

/**
 * Kickoff scheduling email parameters
 */
export interface KickoffSchedulingEmailParams {
  to: string;
  clientName: string;
  calendlyUrl: string;
}

/**
 * Client welcome email parameters
 */
export interface ClientWelcomeEmailParams {
  to: string;
  clientName: string;
  companyName: string;
}

/**
 * Agency notification email parameters
 */
export interface AgencyNotificationEmailParams {
  to: string;
  clientName: string;
  domain: string;
  monthlyValue: number;
  projectId: string;
}

/**
 * Generate GSC invite email content (Lithuanian).
 */
export function generateGscInviteEmail(params: {
  clientName: string;
  domain: string;
  connectUrl: string;
}): EmailContent {
  const { clientName, domain, connectUrl } = params;

  return {
    subject: "Prisijunkite prie Google Search Console",
    body: `Sveiki, ${clientName}!

Dekojame, kad pasirinkote musu SEO paslaugas!

Noredami pradeti, prasome suteikti mums prieiga prie jusu Google Search Console:

${connectUrl}

Si prieiga leis mums:
- Stebeti jusu svetaines pozicijas
- Analizuoti paieškos užklausas
- Identifikuoti optimizavimo galimybes

Prieiga yra saugi ir bet kada galite ja atšaukti.

Svetaine: ${domain}

Klausimai? Tiesiog atsakykite i si laiska.

Pagarbiai,
Jusu SEO komanda`,
  };
}

/**
 * Generate kickoff scheduling email content (Lithuanian).
 */
export function generateKickoffSchedulingEmail(params: {
  clientName: string;
  calendlyUrl: string;
}): EmailContent {
  const { clientName, calendlyUrl } = params;

  return {
    subject: "Suplanuokime susitikima",
    body: `Sveiki, ${clientName}!

Norime suplanuoti pirmaji susitikima, kurio metu:
- Aptarsime jusu tikslus
- Pristatysime strategija
- Atsakysime i klausimus

Pasirinkite jums patogu laika:

${calendlyUrl}

Susitikimas truks apie 30 minuciu.

Iki greito!

Pagarbiai,
Jusu SEO komanda`,
  };
}

/**
 * Generate client welcome email content (Lithuanian).
 */
export function generateClientWelcomeEmail(params: {
  clientName: string;
  companyName: string;
}): EmailContent {
  const { clientName, companyName } = params;

  return {
    subject: `Sveiki atvyke, ${companyName}!`,
    body: `Sveiki, ${clientName}!

Džiaugiames, kad ${companyName} tapo musu klientu!

Štai kas vyks toliau:
1. Gausite kvietima prijungti Google Search Console
2. Suplanuosime pirmaji susitikima
3. Pradėsime analizuoti jusu svetaine

Jei turite klausimų, tiesiog atsakykite i si laiska.

Pagarbiai,
Jusu SEO komanda`,
  };
}

/**
 * Generate agency notification email content.
 */
export function generateAgencyNotificationEmail(params: {
  clientName: string;
  domain: string;
  monthlyValue: number;
  projectId: string;
}): EmailContent {
  const { clientName, domain, monthlyValue, projectId } = params;

  return {
    subject: `Naujas klientas: ${clientName}`,
    body: `Naujas klientas prisijunge!

Imone: ${clientName}
Svetaine: ${domain}
Menesinis mokestis: ${monthlyValue} EUR
Projekto ID: ${projectId}

Klientas gavo:
- GSC prijungimo kvietima
- Susitikimo planavimo nuoroda

Veiksmai:
- Patikrinkite ar GSC prijungtas
- Pasiruoškite pirmajam susitikimui`,
  };
}

/**
 * Send email via Loops transactional API.
 * Falls back gracefully if Loops is not configured.
 */
async function sendLoopsEmail({
  to,
  subject,
  body,
}: {
  to: string;
  subject: string;
  body: string;
}): Promise<boolean> {
  let apiKey: string;

  try {
    apiKey = await getRequiredEnvValue("LOOPS_API_KEY");
  } catch {
    log.warn("LOOPS_API_KEY not configured, skipping email", { to, subject });
    return false;
  }

  // Use generic transactional template or send via contact endpoint
  // For now, log that we would send the email
  log.info("Would send email via Loops", { to, subject, bodyLength: body.length });

  // In production, this would call the Loops API
  // For now, we'll just log and return success
  try {
    const response = await fetch(LOOPS_TRANSACTIONAL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        // This assumes a generic template exists - in production,
        // you'd create specific templates in Loops dashboard
        transactionalId: "onboarding-generic",
        email: to,
        addToAudience: false,
        dataVariables: {
          subject,
          body,
        },
      }),
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null);
      log.error("Email send failed", undefined, {
        status: response.status,
        to,
        subject,
        errorPayload,
      });
      return false;
    }

    log.info("Email sent successfully", { to, subject });
    return true;
  } catch (error) {
    log.error("Email send error", error instanceof Error ? error : new Error(String(error)), {
      to,
      subject,
    });
    return false;
  }
}

/**
 * Send GSC invite email.
 */
export async function sendGscInviteEmail(params: GscInviteEmailParams): Promise<boolean> {
  const { to, clientName, domain, connectUrl } = params;
  const email = generateGscInviteEmail({ clientName, domain, connectUrl });
  return sendLoopsEmail({ to, subject: email.subject, body: email.body });
}

/**
 * Send kickoff scheduling email.
 */
export async function sendKickoffSchedulingEmail(params: KickoffSchedulingEmailParams): Promise<boolean> {
  const { to, clientName, calendlyUrl } = params;
  const email = generateKickoffSchedulingEmail({ clientName, calendlyUrl });
  return sendLoopsEmail({ to, subject: email.subject, body: email.body });
}

/**
 * Send client welcome email.
 */
export async function sendClientWelcomeEmail(params: ClientWelcomeEmailParams): Promise<boolean> {
  const { to, clientName, companyName } = params;
  const email = generateClientWelcomeEmail({ clientName, companyName });
  return sendLoopsEmail({ to, subject: email.subject, body: email.body });
}

/**
 * Send agency notification email.
 */
export async function sendAgencyNotificationEmail(params: AgencyNotificationEmailParams): Promise<boolean> {
  const { to, clientName, domain, monthlyValue, projectId } = params;
  const email = generateAgencyNotificationEmail({ clientName, domain, monthlyValue, projectId });
  return sendLoopsEmail({ to, subject: email.subject, body: email.body });
}
