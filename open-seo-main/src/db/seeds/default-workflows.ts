/**
 * Seed script for default workflow templates.
 * Phase 62-03: Engagement Workflow Engine
 *
 * These are system-level templates (workspaceId = null) available to all workspaces.
 * Templates define engagement sequences with anti-annoyance safeguards.
 */
import { db } from "../index";
import { workflowTemplates, type WorkflowStep } from "../schema/workflow-templates";

// ============================================================================
// Proposal Follow-Up Workflow
// ============================================================================
const proposalFollowUpSteps: WorkflowStep[] = [
  {
    index: 0,
    type: "wait",
    config: { duration: { value: 3, unit: "days" }, skipWeekends: true },
  },
  {
    index: 1,
    type: "email",
    config: {
      templateId: "proposal-followup-1",
      subject: "Following up on your SEO proposal",
      bodyTemplate:
        "Hi {{client.name}},\n\nI wanted to follow up on the SEO proposal I sent over. Have you had a chance to review it?\n\nI'm happy to jump on a quick call to walk through any questions.\n\nBest,\n{{sender.name}}",
    },
  },
  {
    index: 2,
    type: "wait",
    config: { duration: { value: 4, unit: "days" }, skipWeekends: true },
  },
  {
    index: 3,
    type: "condition",
    config: {
      field: "proposal.viewedAt",
      operator: "not_equals",
      value: null,
      onTrue: { goto: 5 }, // Skip to closing email if viewed
      onFalse: "continue",
    },
  },
  {
    index: 4,
    type: "task",
    config: {
      title: "Call {{client.name}} about proposal",
      description:
        "Proposal sent {{proposal.sentDaysAgo}} days ago with no response. Try a phone call.",
      assignTo: "owner",
      dueIn: { value: 1, unit: "days" },
      priority: "high",
    },
  },
  {
    index: 5,
    type: "wait",
    config: { duration: { value: 5, unit: "days" }, skipWeekends: true },
  },
  {
    index: 6,
    type: "email",
    config: {
      templateId: "proposal-followup-2",
      subject: "Re: SEO proposal for {{client.name}}",
      bodyTemplate:
        "Hi {{client.name}},\n\nJust circling back on this. I know things get busy, so I wanted to check if this is still on your radar or if priorities have shifted.\n\nLet me know either way!\n\nBest,\n{{sender.name}}",
    },
  },
  {
    index: 7,
    type: "wait",
    config: { duration: { value: 7, unit: "days" }, skipWeekends: false },
  },
  {
    index: 8,
    type: "alert",
    config: {
      severity: "medium",
      title: "Proposal stalled: {{client.name}}",
      message:
        "Proposal for {{client.name}} has been open for 2+ weeks with no response. Consider reaching out directly or marking as lost.",
      notifyUsers: ["owner"],
    },
  },
];

// ============================================================================
// Contract Signature Workflow
// ============================================================================
const contractSignatureSteps: WorkflowStep[] = [
  {
    index: 0,
    type: "wait",
    config: { duration: { value: 2, unit: "days" }, skipWeekends: true },
  },
  {
    index: 1,
    type: "email",
    config: {
      templateId: "contract-reminder-1",
      subject: "Action needed: Sign your agreement",
      bodyTemplate:
        "Hi {{client.name}},\n\nJust a friendly reminder that your agreement is ready for signature.\n\nYou can sign it here: {{contract.signatureUrl}}\n\nLet me know if you have any questions!\n\nBest,\n{{sender.name}}",
    },
  },
  {
    index: 2,
    type: "condition",
    config: {
      field: "contract.status",
      operator: "equals",
      value: "signed",
      onTrue: "complete",
      onFalse: "continue",
    },
  },
  {
    index: 3,
    type: "wait",
    config: { duration: { value: 3, unit: "days" }, skipWeekends: true },
  },
  {
    index: 4,
    type: "task",
    config: {
      title: "Follow up on unsigned contract: {{client.name}}",
      description: "Contract sent but not signed. Consider a phone call.",
      assignTo: "owner",
      dueIn: { value: 1, unit: "days" },
      priority: "high",
    },
  },
  {
    index: 5,
    type: "wait",
    config: { duration: { value: 5, unit: "days" }, skipWeekends: false },
  },
  {
    index: 6,
    type: "alert",
    config: {
      severity: "high",
      title: "Contract unsigned: {{client.name}}",
      message:
        "Contract for {{client.name}} has been pending signature for over a week. Immediate attention needed.",
      notifyUsers: ["owner"],
    },
  },
];

// ============================================================================
// Invoice Payment Workflow
// ============================================================================
const invoicePaymentSteps: WorkflowStep[] = [
  {
    index: 0,
    type: "wait",
    config: { duration: { value: 1, unit: "days" } },
  },
  {
    index: 1,
    type: "condition",
    config: {
      field: "invoice.status",
      operator: "equals",
      value: "paid",
      onTrue: "complete",
      onFalse: "continue",
    },
  },
  {
    index: 2,
    type: "wait",
    config: { duration: { value: 2, unit: "days" } },
  },
  {
    index: 3,
    type: "email",
    config: {
      templateId: "invoice-reminder-1",
      subject: "Invoice #{{invoice.number}} - Friendly Reminder",
      bodyTemplate:
        "Hi {{client.name}},\n\nJust a friendly reminder that invoice #{{invoice.number}} for {{invoice.amount}} is due {{invoice.dueDate}}.\n\nYou can pay online here: {{invoice.paymentUrl}}\n\nThanks!\n{{sender.name}}",
    },
  },
  {
    index: 4,
    type: "wait",
    config: { duration: { value: 5, unit: "days" } },
  },
  {
    index: 5,
    type: "condition",
    config: {
      field: "invoice.status",
      operator: "equals",
      value: "paid",
      onTrue: "complete",
      onFalse: "continue",
    },
  },
  {
    index: 6,
    type: "task",
    config: {
      title: "Follow up on overdue invoice: {{client.name}}",
      description: "Invoice #{{invoice.number}} is overdue. Consider a phone call.",
      assignTo: "owner",
      dueIn: { value: 1, unit: "days" },
      priority: "high",
    },
  },
  {
    index: 7,
    type: "wait",
    config: { duration: { value: 7, unit: "days" } },
  },
  {
    index: 8,
    type: "alert",
    config: {
      severity: "critical",
      title: "Overdue invoice: {{client.name}} #{{invoice.number}}",
      message:
        "Invoice #{{invoice.number}} is significantly overdue. Amount: {{invoice.amount}}. Escalation may be needed.",
      notifyUsers: ["owner"],
    },
  },
];

// ============================================================================
// New Client Onboarding Workflow
// ============================================================================
const clientOnboardingSteps: WorkflowStep[] = [
  {
    index: 0,
    type: "email",
    config: {
      templateId: "welcome-email",
      subject: "Welcome aboard, {{client.name}}!",
      bodyTemplate:
        "Hi {{client.name}},\n\nWe're thrilled to have you as a client!\n\nHere's what happens next:\n1. We'll schedule a kickoff call\n2. We'll request access to your Google Search Console\n3. We'll start your first audit within 48 hours\n\nQuestions? Just reply to this email.\n\nBest,\n{{sender.name}}",
    },
  },
  {
    index: 1,
    type: "wait",
    config: { duration: { value: 1, unit: "days" } },
  },
  {
    index: 2,
    type: "task",
    config: {
      title: "Schedule kickoff call with {{client.name}}",
      description: "New client onboarded. Schedule kickoff call within 48 hours.",
      assignTo: "owner",
      dueIn: { value: 2, unit: "days" },
      priority: "high",
    },
  },
  {
    index: 3,
    type: "wait",
    config: { duration: { value: 3, unit: "days" } },
  },
  {
    index: 4,
    type: "condition",
    config: {
      field: "client.gscConnected",
      operator: "equals",
      value: true,
      onTrue: { goto: 7 },
      onFalse: "continue",
    },
  },
  {
    index: 5,
    type: "email",
    config: {
      templateId: "gsc-access-request",
      subject: "Quick request: Google Search Console access",
      bodyTemplate:
        "Hi {{client.name}},\n\nTo start your first audit, we need access to your Google Search Console.\n\nHere's how to grant access:\n1. Go to Google Search Console\n2. Click Settings > Users and permissions\n3. Add {{agency.email}} as a Full user\n\nLet me know if you need any help!\n\nBest,\n{{sender.name}}",
    },
  },
  {
    index: 6,
    type: "wait",
    config: { duration: { value: 4, unit: "days" }, skipWeekends: true },
  },
  {
    index: 7,
    type: "task",
    config: {
      title: "Run first audit for {{client.name}}",
      description: "Client onboarded and GSC connected. Run initial SEO audit.",
      assignTo: "owner",
      dueIn: { value: 2, unit: "days" },
      priority: "medium",
    },
  },
];

// ============================================================================
// Template Definitions
// ============================================================================
const templates = [
  {
    id: "wf-tmpl-proposal-followup",
    workspaceId: null, // System template
    name: "Proposal Follow-Up Sequence",
    description:
      "Automated follow-up sequence for sent proposals. Includes emails, call tasks, and stale proposal alerts.",
    entityType: "proposal" as const,
    triggerEvent: "proposal_sent",
    maxTouchesPerWeek: 3,
    cooldownHours: 48,
    skipOnResponse: true,
    pauseOnNegativeSignal: true,
    steps: proposalFollowUpSteps,
    isActive: true,
    isSystem: true,
  },
  {
    id: "wf-tmpl-contract-signature",
    workspaceId: null,
    name: "Contract Signature Reminder",
    description:
      "Reminder sequence for contracts awaiting signature. Auto-completes when signed.",
    entityType: "contract" as const,
    triggerEvent: "contract_sent",
    maxTouchesPerWeek: 2,
    cooldownHours: 72,
    skipOnResponse: true,
    pauseOnNegativeSignal: true,
    steps: contractSignatureSteps,
    isActive: true,
    isSystem: true,
  },
  {
    id: "wf-tmpl-invoice-payment",
    workspaceId: null,
    name: "Invoice Payment Reminder",
    description:
      "Payment reminder sequence for invoices. Auto-completes when paid, escalates if overdue.",
    entityType: "invoice" as const,
    triggerEvent: "invoice_sent",
    maxTouchesPerWeek: 2,
    cooldownHours: 48,
    skipOnResponse: true,
    pauseOnNegativeSignal: false, // Keep reminding even if negative signal
    steps: invoicePaymentSteps,
    isActive: true,
    isSystem: true,
  },
  {
    id: "wf-tmpl-client-onboarding",
    workspaceId: null,
    name: "New Client Onboarding",
    description:
      "Onboarding sequence for new clients. Welcome email, kickoff scheduling, GSC access, first audit.",
    entityType: "client" as const,
    triggerEvent: "client_created",
    maxTouchesPerWeek: 4,
    cooldownHours: 24,
    skipOnResponse: false, // Complete the onboarding regardless
    pauseOnNegativeSignal: false,
    steps: clientOnboardingSteps,
    isActive: true,
    isSystem: true,
  },
];

/**
 * Seed default workflow templates.
 * Uses upsert to update existing templates.
 */
export async function seedDefaultWorkflows(): Promise<void> {
  console.log("Seeding default workflow templates...");

  for (const template of templates) {
    await db
      .insert(workflowTemplates)
      .values(template)
      .onConflictDoUpdate({
        target: workflowTemplates.id,
        set: {
          name: template.name,
          description: template.description,
          entityType: template.entityType,
          triggerEvent: template.triggerEvent,
          maxTouchesPerWeek: template.maxTouchesPerWeek,
          cooldownHours: template.cooldownHours,
          skipOnResponse: template.skipOnResponse,
          pauseOnNegativeSignal: template.pauseOnNegativeSignal,
          steps: template.steps,
          isActive: template.isActive,
          updatedAt: new Date(),
        },
      });
  }

  console.log(`Seeded ${templates.length} default workflow templates`);
}

// Allow direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDefaultWorkflows()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seed failed:", err);
      process.exit(1);
    });
}
