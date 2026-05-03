/**
 * Developer Handoff Email Template
 * Phase 66-05: Developer Handoff Flow
 *
 * React Email template for developer handoff emails.
 * Features:
 * - Clean, professional design
 * - Clear CTA button
 * - Mobile responsive
 * - Plain text fallback via text property
 *
 * Per DESIGN.md Section 9:
 * - Subject: "Add TeveroSEO to {domain} (30 seconds)"
 * - Body: Simple instructions with code snippet and magic link
 */

// Note: This template is designed for use with React Email
// Install @react-email/components if using React Email renderer

import * as React from "react";

// ============================================================================
// Types
// ============================================================================

export interface DeveloperHandoffEmailProps {
  /** Domain being installed on */
  domain: string;
  /** Sender's name */
  senderName: string;
  /** Optional custom message */
  message?: string;
  /** The pixel snippet to install */
  snippet: string;
  /** Magic link URL */
  magicLink: string;
  /** Recipient's name (optional) */
  recipientName?: string;
}

// ============================================================================
// Email Component
// ============================================================================

export function DeveloperHandoffEmail({
  domain,
  senderName,
  message,
  snippet,
  magicLink,
  recipientName,
}: DeveloperHandoffEmailProps) {
  const greeting = recipientName ? `Hi ${recipientName},` : "Hi,";

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Add TeveroSEO to {domain}</title>
        <style>{`
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #374151;
            background-color: #f9fafb;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 40px 20px;
          }
          .card {
            background: white;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            padding: 32px;
          }
          .logo {
            text-align: center;
            margin-bottom: 24px;
          }
          .logo img {
            height: 32px;
          }
          h1 {
            font-size: 24px;
            font-weight: 600;
            color: #111827;
            margin: 0 0 16px 0;
          }
          p {
            margin: 0 0 16px 0;
          }
          .message {
            background: #f3f4f6;
            border-left: 4px solid #10b981;
            padding: 12px 16px;
            margin: 16px 0;
            font-style: italic;
          }
          .code-block {
            background: #1e293b;
            color: #e2e8f0;
            padding: 16px;
            border-radius: 6px;
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
            font-size: 14px;
            overflow-x: auto;
            margin: 16px 0;
          }
          .button {
            display: inline-block;
            background: #10b981;
            color: white !important;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-weight: 500;
            text-align: center;
            margin: 24px 0;
          }
          .button:hover {
            background: #059669;
          }
          .footer {
            text-align: center;
            color: #6b7280;
            font-size: 14px;
            margin-top: 32px;
          }
          .footer a {
            color: #10b981;
          }
          .reassurance {
            font-size: 14px;
            color: #6b7280;
            margin-top: 24px;
            padding-top: 24px;
            border-top: 1px solid #e5e7eb;
          }
        `}</style>
      </head>
      <body>
        <div className="container">
          <div className="card">
            {/* Logo placeholder */}
            <div className="logo">
              <strong style={{ fontSize: "20px", color: "#10b981" }}>
                TeveroSEO
              </strong>
            </div>

            {/* Greeting */}
            <p>{greeting}</p>

            {/* Main message */}
            <p>
              <strong>{senderName}</strong> has asked you to add TeveroSEO
              tracking to <strong>{domain}</strong>. Here's all you need:
            </p>

            {/* Custom message if provided */}
            {message && <div className="message">"{message}"</div>}

            {/* Instructions */}
            <p>
              Add this line to the <code>&lt;head&gt;</code> of your site:
            </p>

            {/* Code snippet */}
            <div className="code-block">{snippet}</div>

            {/* CTA button */}
            <p style={{ textAlign: "center" }}>
              Or click the button below for step-by-step instructions:
            </p>
            <p style={{ textAlign: "center" }}>
              <a href={magicLink} className="button">
                One-Click Install
              </a>
            </p>

            {/* Closing */}
            <p>That's it! Questions? Reply to this email.</p>

            {/* Reassurance */}
            <div className="reassurance">
              <p>
                <strong>What is this?</strong> TeveroSEO is a tiny helper (less
                than 5KB) that tracks website visits and helps improve search
                rankings. It cannot make changes without approval.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="footer">
            <p>
              Sent by{" "}
              <a href="https://tevero.io" target="_blank" rel="noopener">
                TeveroSEO
              </a>
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}

// ============================================================================
// Plain Text Version
// ============================================================================

export function getDeveloperHandoffPlainText(
  props: DeveloperHandoffEmailProps
): string {
  const { domain, senderName, message, snippet, magicLink, recipientName } =
    props;

  const greeting = recipientName ? `Hi ${recipientName},` : "Hi,";

  let text = `${greeting}

${senderName} has asked you to add TeveroSEO tracking to ${domain}. Here's all you need:
`;

  if (message) {
    text += `
"${message}"
`;
  }

  text += `
Add this line to the <head> of your site:

${snippet}

Or visit this link for step-by-step instructions:
${magicLink}

That's it! Questions? Reply to this email.

---
What is this? TeveroSEO is a tiny helper (less than 5KB) that tracks website visits and helps improve search rankings. It cannot make changes without approval.

Sent by TeveroSEO - https://tevero.io
`;

  return text;
}

// ============================================================================
// Subject Line Generator
// ============================================================================

export function getDeveloperHandoffSubject(domain: string): string {
  return `Add TeveroSEO to ${domain} (30 seconds)`;
}

// ============================================================================
// Reminder Email Template
// ============================================================================

export interface DeveloperHandoffReminderProps extends DeveloperHandoffEmailProps {
  reminderNumber: number;
}

export function getDeveloperHandoffReminderSubject(
  domain: string,
  reminderNumber: number
): string {
  if (reminderNumber === 1) {
    return `Reminder: Add TeveroSEO to ${domain}`;
  }
  return `Final reminder: Add TeveroSEO to ${domain}`;
}

export function getDeveloperHandoffReminderPlainText(
  props: DeveloperHandoffReminderProps
): string {
  const { domain, snippet, magicLink, reminderNumber, recipientName } = props;

  const greeting = recipientName ? `Hi ${recipientName},` : "Hi,";
  const urgency =
    reminderNumber >= 3
      ? "This is a final reminder."
      : "Just a friendly reminder.";

  return `${greeting}

${urgency} The TeveroSEO tracking code still needs to be added to ${domain}.

Here's the code to add to the <head>:

${snippet}

Or visit this link for step-by-step instructions:
${magicLink}

Questions? Reply to this email.

---
Sent by TeveroSEO - https://tevero.io
`;
}
