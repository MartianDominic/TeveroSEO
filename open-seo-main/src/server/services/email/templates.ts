/**
 * Email Templates
 * Phase 55-05: Dynamic Content Translation Integration
 *
 * Localized email templates for EN and LT languages.
 * Templates use {{variable}} placeholders for dynamic content.
 */

import type { SupportedLocale } from "../translation/types";

/**
 * Email template structure.
 */
export interface EmailTemplate {
  subject: string;
  body: string;
  variables: string[];
}

/**
 * Available email template IDs.
 * Phase 60-05: Added installment reminder templates.
 */
export type EmailTemplateId =
  | "proposal-sent"
  | "proposal-reminder"
  | "agreement-sent"
  | "agreement-signed"
  | "invoice-sent"
  | "invoice-reminder"
  | "welcome"
  | "installment-reminder"
  | "installment-due-today"
  | "installment-overdue"
  | "installment-overdue-urgent";

/**
 * English email templates.
 */
export const EMAIL_TEMPLATES_EN: Record<EmailTemplateId, EmailTemplate> = {
  "proposal-sent": {
    subject: "Your SEO Proposal from {{companyName}}",
    body: `Dear {{recipientName}},

Thank you for your interest in our SEO services. We have prepared a customized proposal for {{businessName}}.

You can review your proposal here:
{{proposalLink}}

This proposal is valid until {{expiryDate}}.

If you have any questions, please don't hesitate to reach out.

Best regards,
{{senderName}}
{{companyName}}`,
    variables: ["recipientName", "businessName", "companyName", "proposalLink", "expiryDate", "senderName"],
  },

  "proposal-reminder": {
    subject: "Reminder: Your SEO Proposal from {{companyName}}",
    body: `Dear {{recipientName}},

This is a friendly reminder that your SEO proposal for {{businessName}} is awaiting your review.

You can access it here:
{{proposalLink}}

The proposal expires on {{expiryDate}}.

We would love to help you grow your online presence. Let us know if you have any questions.

Best regards,
{{senderName}}
{{companyName}}`,
    variables: ["recipientName", "businessName", "companyName", "proposalLink", "expiryDate", "senderName"],
  },

  "agreement-sent": {
    subject: "Service Agreement from {{companyName}}",
    body: `Dear {{recipientName}},

Your service agreement for {{businessName}} is ready for review and signature.

Please review and sign the agreement here:
{{agreementLink}}

If you have any questions about the terms, please contact us.

Best regards,
{{senderName}}
{{companyName}}`,
    variables: ["recipientName", "businessName", "companyName", "agreementLink", "senderName"],
  },

  "agreement-signed": {
    subject: "Agreement Signed - Welcome to {{companyName}}!",
    body: `Dear {{recipientName}},

Thank you for signing the service agreement for {{businessName}}. We are excited to start working with you!

Next steps:
1. You will receive an invoice shortly
2. Once payment is confirmed, we'll schedule your onboarding call
3. We'll begin work on your SEO strategy

If you have any questions, please reach out anytime.

Best regards,
{{senderName}}
{{companyName}}`,
    variables: ["recipientName", "businessName", "companyName", "senderName"],
  },

  "invoice-sent": {
    subject: "Invoice {{invoiceNumber}} from {{companyName}}",
    body: `Dear {{recipientName}},

Please find attached your invoice for {{businessName}}.

Invoice Number: {{invoiceNumber}}
Amount Due: {{amount}}
Due Date: {{dueDate}}

You can pay online here:
{{paymentLink}}

Thank you for your business.

Best regards,
{{senderName}}
{{companyName}}`,
    variables: ["recipientName", "businessName", "companyName", "invoiceNumber", "amount", "dueDate", "paymentLink", "senderName"],
  },

  "invoice-reminder": {
    subject: "Payment Reminder: Invoice {{invoiceNumber}}",
    body: `Dear {{recipientName}},

This is a friendly reminder that invoice {{invoiceNumber}} for {{businessName}} is due on {{dueDate}}.

Amount Due: {{amount}}

You can pay online here:
{{paymentLink}}

If you have already made the payment, please disregard this message.

Best regards,
{{senderName}}
{{companyName}}`,
    variables: ["recipientName", "businessName", "companyName", "invoiceNumber", "amount", "dueDate", "paymentLink", "senderName"],
  },

  welcome: {
    subject: "Welcome to {{companyName}}!",
    body: `Dear {{recipientName}},

Welcome to {{companyName}}! We are thrilled to have {{businessName}} as our client.

Your dedicated account manager is {{accountManager}}, who will be your primary point of contact.

Here's what happens next:
1. We'll schedule an onboarding call to understand your goals
2. We'll conduct a comprehensive SEO audit
3. We'll present our findings and strategy recommendations

You can access your dashboard here:
{{dashboardLink}}

We look forward to helping you succeed online!

Best regards,
The {{companyName}} Team`,
    variables: ["recipientName", "businessName", "companyName", "accountManager", "dashboardLink"],
  },

  // Phase 60-05: Installment reminder templates (D-18 to D-20)
  "installment-reminder": {
    subject: "Payment Reminder: {{installmentAmount}} due {{dueDate}}",
    body: `Dear {{recipientName}},

This is a friendly reminder that your payment of {{installmentAmount}} for {{businessName}} is due on {{dueDate}}.

Payment details:
- Installment: {{installmentNumber}} of {{totalInstallments}}
- Amount due: {{installmentAmount}}
- Due date: {{dueDate}}
- Remaining balance: {{remainingAmount}}

You can pay online here:
{{paymentLink}}

If you have any questions about your payment plan, please don't hesitate to contact us.

Best regards,
{{senderName}}
{{companyName}}`,
    variables: ["recipientName", "businessName", "companyName", "installmentNumber", "totalInstallments", "installmentAmount", "dueDate", "remainingAmount", "paymentLink", "senderName"],
  },

  "installment-due-today": {
    subject: "Payment Due Today: {{installmentAmount}}",
    body: `Dear {{recipientName}},

Your payment of {{installmentAmount}} for {{businessName}} is due today.

Payment details:
- Installment: {{installmentNumber}} of {{totalInstallments}}
- Amount due: {{installmentAmount}}
- Remaining after this payment: {{remainingAmount}}

Please complete your payment today:
{{paymentLink}}

Thank you for your prompt attention.

Best regards,
{{senderName}}
{{companyName}}`,
    variables: ["recipientName", "businessName", "companyName", "installmentNumber", "totalInstallments", "installmentAmount", "remainingAmount", "paymentLink", "senderName"],
  },

  "installment-overdue": {
    subject: "Overdue Payment: {{installmentAmount}}",
    body: `Dear {{recipientName}},

Your payment of {{installmentAmount}} for {{businessName}} is now overdue.

Payment details:
- Installment: {{installmentNumber}} of {{totalInstallments}}
- Amount overdue: {{installmentAmount}}
- Original due date: {{dueDate}}

Please complete your payment as soon as possible:
{{paymentLink}}

If you're experiencing any difficulties, please contact us so we can discuss your options.

Best regards,
{{senderName}}
{{companyName}}`,
    variables: ["recipientName", "businessName", "companyName", "installmentNumber", "totalInstallments", "installmentAmount", "dueDate", "paymentLink", "senderName"],
  },

  "installment-overdue-urgent": {
    subject: "Urgent: Payment {{installmentAmount}} is 7 days overdue",
    body: `Dear {{recipientName}},

This is an urgent notice regarding your overdue payment for {{businessName}}.

Your payment of {{installmentAmount}} was due on {{dueDate}} and is now 7 days overdue.

Payment details:
- Installment: {{installmentNumber}} of {{totalInstallments}}
- Amount overdue: {{installmentAmount}}
- Original due date: {{dueDate}}

Please complete your payment immediately:
{{paymentLink}}

If you're experiencing difficulties with payment, please contact us as soon as possible to discuss alternative arrangements.

Best regards,
{{senderName}}
{{companyName}}`,
    variables: ["recipientName", "businessName", "companyName", "installmentNumber", "totalInstallments", "installmentAmount", "dueDate", "paymentLink", "senderName"],
  },
};

/**
 * Lithuanian email templates.
 * Uses formal "jus" form for professional communication.
 */
export const EMAIL_TEMPLATES_LT: Record<EmailTemplateId, EmailTemplate> = {
  "proposal-sent": {
    subject: "Jusu SEO pasiulymas is {{companyName}}",
    body: `Gerbiamas(-a) {{recipientName}},

Dekojame uz susidomejima musu SEO paslaugomis. Paruoseme individualu pasiulyma {{businessName}}.

Galite perziureti pasiulyma cia:
{{proposalLink}}

Sis pasiulymas galioja iki {{expiryDate}}.

Jei turite klausimu, nedvejodami susisiekite.

Pagarbiai,
{{senderName}}
{{companyName}}`,
    variables: ["recipientName", "businessName", "companyName", "proposalLink", "expiryDate", "senderName"],
  },

  "proposal-reminder": {
    subject: "Priminimas: Jusu SEO pasiulymas is {{companyName}}",
    body: `Gerbiamas(-a) {{recipientName}},

Primename, kad Jusu SEO pasiulymas {{businessName}} laukia perziuros.

Galite ji pasiekti cia:
{{proposalLink}}

Pasiulymas galioja iki {{expiryDate}}.

Mielai padetumo Jums auginti versla internete. Susisiekite, jei turite klausimu.

Pagarbiai,
{{senderName}}
{{companyName}}`,
    variables: ["recipientName", "businessName", "companyName", "proposalLink", "expiryDate", "senderName"],
  },

  "agreement-sent": {
    subject: "Paslaugu sutartis is {{companyName}}",
    body: `Gerbiamas(-a) {{recipientName}},

Jusu paslaugu sutartis {{businessName}} paruosta perziurai ir pasirasyti.

Perziurekite ir pasiraskyte sutarti cia:
{{agreementLink}}

Jei turite klausimu apie salygas, susisiekite su mumis.

Pagarbiai,
{{senderName}}
{{companyName}}`,
    variables: ["recipientName", "businessName", "companyName", "agreementLink", "senderName"],
  },

  "agreement-signed": {
    subject: "Sutartis pasirasta - Sveiki atvyke i {{companyName}}!",
    body: `Gerbiamas(-a) {{recipientName}},

Dekojame, kad pasirasete paslaugu sutarti {{businessName}}. Dziaugiames galimybe dirbti kartu!

Tolesni zingsniai:
1. Netrukus gausite saskaita
2. Patvirtinus mokejima, suplanuosime pradzios susitikima
3. Pradedame dirbti ties Jusu SEO strategija

Jei turite klausimu, susisiekite bet kuriuo metu.

Pagarbiai,
{{senderName}}
{{companyName}}`,
    variables: ["recipientName", "businessName", "companyName", "senderName"],
  },

  "invoice-sent": {
    subject: "Saskaita {{invoiceNumber}} is {{companyName}}",
    body: `Gerbiamas(-a) {{recipientName}},

Siunciame Jusu saskaita uz {{businessName}} paslaugas.

Saskaitos numeris: {{invoiceNumber}}
Suma: {{amount}}
Mokejimo terminas: {{dueDate}}

Galite apmoketi internetu cia:
{{paymentLink}}

Dekojame uz bendradarbiavima.

Pagarbiai,
{{senderName}}
{{companyName}}`,
    variables: ["recipientName", "businessName", "companyName", "invoiceNumber", "amount", "dueDate", "paymentLink", "senderName"],
  },

  "invoice-reminder": {
    subject: "Mokejimo priminimas: Saskaita {{invoiceNumber}}",
    body: `Gerbiamas(-a) {{recipientName}},

Primename, kad saskaita {{invoiceNumber}} uz {{businessName}} turi buti apmoketa iki {{dueDate}}.

Suma: {{amount}}

Galite apmoketi internetu cia:
{{paymentLink}}

Jei jau atlikote mokejima, praleizkite si pranesima.

Pagarbiai,
{{senderName}}
{{companyName}}`,
    variables: ["recipientName", "businessName", "companyName", "invoiceNumber", "amount", "dueDate", "paymentLink", "senderName"],
  },

  welcome: {
    subject: "Sveiki atvyke i {{companyName}}!",
    body: `Gerbiamas(-a) {{recipientName}},

Sveiki atvyke i {{companyName}}! Dziaugiames, kad {{businessName}} tapo musu klientu.

Jusu asmeninis paskyros vadybininkas yra {{accountManager}}, kuris bus pagrindinis kontaktinis asmuo.

Kas vyksta toliau:
1. Suplanuosime pradzios susitikima, kad suprastume Jusu tikslus
2. Atliksime issamia SEO analize
3. Pristatysime misu isvedas ir strategijos rekomendacijas

Galite pasiekti savo valdymo skyde cia:
{{dashboardLink}}

Laukiame galimybes padeti Jums augti internete!

Pagarbiai,
{{companyName}} komanda`,
    variables: ["recipientName", "businessName", "companyName", "accountManager", "dashboardLink"],
  },

  // Phase 60-05: Installment reminder templates (D-18 to D-20)
  "installment-reminder": {
    subject: "Mokejimo priminimas: {{installmentAmount}} iki {{dueDate}}",
    body: `Gerbiamas(-a) {{recipientName}},

Primename, kad Jusu mokejimas {{installmentAmount}} uz {{businessName}} turi buti atliktas iki {{dueDate}}.

Mokejimo informacija:
- Imoka: {{installmentNumber}} is {{totalInstallments}}
- Mokejimo suma: {{installmentAmount}}
- Terminas: {{dueDate}}
- Likusi suma: {{remainingAmount}}

Galite apmoketi internetu cia:
{{paymentLink}}

Jei turite klausimu apie mokejimo plana, susisiekite su mumis.

Pagarbiai,
{{senderName}}
{{companyName}}`,
    variables: ["recipientName", "businessName", "companyName", "installmentNumber", "totalInstallments", "installmentAmount", "dueDate", "remainingAmount", "paymentLink", "senderName"],
  },

  "installment-due-today": {
    subject: "Mokejimas siandien: {{installmentAmount}}",
    body: `Gerbiamas(-a) {{recipientName}},

Jusu mokejimas {{installmentAmount}} uz {{businessName}} turi buti atliktas siandien.

Mokejimo informacija:
- Imoka: {{installmentNumber}} is {{totalInstallments}}
- Mokejimo suma: {{installmentAmount}}
- Likusi suma po sio mokejimo: {{remainingAmount}}

Prasome atlikti mokejima siandien:
{{paymentLink}}

Dekojame uz punktualuma.

Pagarbiai,
{{senderName}}
{{companyName}}`,
    variables: ["recipientName", "businessName", "companyName", "installmentNumber", "totalInstallments", "installmentAmount", "remainingAmount", "paymentLink", "senderName"],
  },

  "installment-overdue": {
    subject: "Veluojantis mokejimas: {{installmentAmount}}",
    body: `Gerbiamas(-a) {{recipientName}},

Jusu mokejimas {{installmentAmount}} uz {{businessName}} yra pradelstas.

Mokejimo informacija:
- Imoka: {{installmentNumber}} is {{totalInstallments}}
- Pradelstas mokejimas: {{installmentAmount}}
- Pradinis terminas: {{dueDate}}

Prasome kuo greiciau atlikti mokejima:
{{paymentLink}}

Jei turite sunkumu su mokejimu, susisiekite su mumis ir aptarsime galimybes.

Pagarbiai,
{{senderName}}
{{companyName}}`,
    variables: ["recipientName", "businessName", "companyName", "installmentNumber", "totalInstallments", "installmentAmount", "dueDate", "paymentLink", "senderName"],
  },

  "installment-overdue-urgent": {
    subject: "Skubu: Mokejimas {{installmentAmount}} pradelstas 7 dienas",
    body: `Gerbiamas(-a) {{recipientName}},

Tai skubus pranesimas apie Jusu pradelstas mokejimas uz {{businessName}}.

Jusu mokejimas {{installmentAmount}} turejo buti atliktas {{dueDate}} ir yra pradelstas 7 dienas.

Mokejimo informacija:
- Imoka: {{installmentNumber}} is {{totalInstallments}}
- Pradelstas mokejimas: {{installmentAmount}}
- Pradinis terminas: {{dueDate}}

Prasome nedelsiant atlikti mokejima:
{{paymentLink}}

Jei turite sunkumu su mokejimu, kuo greiciau susisiekite su mumis ir aptarsime alternatyvius sprendimus.

Pagarbiai,
{{senderName}}
{{companyName}}`,
    variables: ["recipientName", "businessName", "companyName", "installmentNumber", "totalInstallments", "installmentAmount", "dueDate", "paymentLink", "senderName"],
  },
};

/**
 * Get email template by ID and language.
 *
 * @param templateId - Template identifier
 * @param language - Target language (defaults to 'en')
 * @returns Email template with subject, body, and variable list
 */
export function getEmailTemplate(
  templateId: EmailTemplateId,
  language: SupportedLocale = "en"
): EmailTemplate {
  const templates = language === "lt" ? EMAIL_TEMPLATES_LT : EMAIL_TEMPLATES_EN;
  const template = templates[templateId];

  if (!template) {
    throw new Error(`Email template '${templateId}' not found`);
  }

  return template;
}

/**
 * Substitute variables in template text.
 * Escapes HTML in variable values to prevent XSS (T-55-10 mitigation).
 *
 * @param text - Template text with {{variable}} placeholders
 * @param variables - Key-value pairs for substitution
 * @returns Text with variables substituted
 */
export function substituteVariables(
  text: string,
  variables: Record<string, string>
): string {
  let result = text;

  for (const [key, value] of Object.entries(variables)) {
    // Escape HTML entities to prevent XSS (T-55-10)
    const escapedValue = escapeHtml(value);
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    result = result.replace(regex, escapedValue);
  }

  return result;
}

/**
 * Escape HTML entities in a string.
 */
function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };

  return text.replace(/[&<>"']/g, (char) => htmlEntities[char] ?? char);
}
