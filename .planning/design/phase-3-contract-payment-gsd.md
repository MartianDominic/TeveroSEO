# GSD Plan: Phase 3 — Contract & Payment System

> **Goal**: Complete the conversion flow: Proposal Accepted → Contract Signed → Invoice Paid  
> **Dependencies**: Phase 2 (Proposal System) must be complete  
> **Design Reference**: [design-system-v6.md](./design-system-v6.md), [v8-agency-pipeline.md](./v8-agency-pipeline.md)

---

## Executive Summary

Phase 3 implements the contract-to-payment conversion pipeline:
1. Auto-generate contracts from accepted proposals
2. E-signature integration for legally binding signatures
3. Stripe Invoicing for payment collection
4. Webhook-driven automation for state transitions

**Estimated Duration**: 2 sprints (4 weeks)

---

## 1. Third-Party Integration Analysis

### 1.1 E-Signature Provider Comparison

| Provider | Pricing | API Quality | Webhook Support | Recommendation |
|----------|---------|-------------|-----------------|----------------|
| **DocuSign** | $25/mo (Standard), $40/mo (Business Pro) | Excellent, mature REST API | Full lifecycle events | **Best for enterprise** — industry standard, but pricey |
| **PandaDoc** | $35/mo (Business), $65/mo (Enterprise) | Good, modern REST API | Good, includes analytics | **Best for proposal+contract** — has built-in proposal tools |
| **HelloSign (Dropbox Sign)** | $20/mo (Standard), $25/mo (Professional) | Clean, simple API | Good, clear events | **Recommended** — best value, clean API, Dropbox backing |

**Recommendation: HelloSign (Dropbox Sign)**

Rationale:
- Lowest cost for small agencies ($20/mo vs $25-40/mo)
- Clean, developer-friendly API with excellent documentation
- Simple webhook model: `signature_request_all_signed`, `signature_request_signed`, `signature_request_sent`
- Good embeddable signing experience (no redirect required)
- Dropbox backing = stable long-term

**Alternative**: PandaDoc if we want to consolidate proposal+contract into one platform later. But adds complexity and cost.

### 1.2 Stripe Setup Requirements

**Stripe Products Needed**:
1. **Stripe Invoicing** — Generate and send invoices
2. **Stripe Payment Links** (optional) — Quick one-click payment
3. **Stripe Customer Portal** — Client self-service for payment methods
4. **Stripe Webhooks** — Payment event notifications

**Stripe Account Setup Checklist**:
```
☐ Enable Stripe Invoicing in Dashboard → Products → Invoicing
☐ Configure invoice settings (branding, footer, memo)
☐ Set up tax rates (if applicable)
☐ Configure payment methods (card, ACH bank transfer)
☐ Set default payment terms (Net 14, Net 30)
☐ Create webhook endpoint with events:
   - invoice.created
   - invoice.sent
   - invoice.payment_succeeded
   - invoice.payment_failed
   - invoice.overdue
   - customer.subscription.created (for recurring)
   - customer.subscription.updated
☐ Store API keys in environment variables
```

**Environment Variables Required**:
```env
# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# HelloSign
HELLOSIGN_API_KEY=...
HELLOSIGN_CLIENT_ID=...
HELLOSIGN_WEBHOOK_SECRET=...
```

### 1.3 Webhook Endpoint Security

All webhook endpoints MUST implement:

1. **Signature Verification** — Validate webhook signatures before processing
2. **Idempotency** — Handle duplicate webhook deliveries gracefully
3. **Async Processing** — Return 200 quickly, process in background
4. **Retry Handling** — Design for webhook retries (store processed event IDs)
5. **Rate Limiting** — Protect against webhook amplification attacks

**Security Pattern**:
```typescript
// apps/web/src/lib/webhooks/verify.ts
export async function verifyStripeWebhook(
  body: string,
  signature: string
): Promise<Stripe.Event> {
  const stripe = getStripeClient();
  return stripe.webhooks.constructEvent(
    body,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
}

export async function verifyHelloSignWebhook(
  body: string,
  signature: string
): Promise<boolean> {
  const hmac = crypto.createHmac('sha256', process.env.HELLOSIGN_WEBHOOK_SECRET!);
  hmac.update(body);
  const expectedSignature = hmac.digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

---

## 2. Database Schema

### 2.1 New Tables (Drizzle Schema)

**File**: `apps/web/src/db/schema/contracts.ts`

```typescript
import { pgTable, uuid, text, timestamp, decimal, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { proposals } from './proposals';
import { prospects } from './prospects';

export const contractStateEnum = pgEnum('contract_state', [
  'draft',           // Contract generated, not yet sent
  'sent',            // Sent for signature
  'client_signed',   // Client has signed, awaiting agency counter-sign
  'fully_executed',  // Both parties signed
  'voided',          // Cancelled
  'expired'          // Signature request expired
]);

export const contracts = pgTable('contracts', {
  id: uuid('id').primaryKey().defaultRandom(),
  proposalId: uuid('proposal_id').references(() => proposals.id).notNull(),
  prospectId: uuid('prospect_id').references(() => prospects.id).notNull(),
  state: contractStateEnum('state').default('draft').notNull(),
  
  // Template & Content
  templateId: uuid('template_id'),
  title: text('title').notNull(),
  content: jsonb('content'), // Rendered contract sections as JSON
  
  // E-Signature Provider
  esignProvider: text('esign_provider').default('hellosign'),
  esignRequestId: text('esign_request_id'),       // HelloSign signature_request_id
  esignDocumentUrl: text('esign_document_url'),   // URL to view/download
  
  // Signatures
  clientSignatureId: text('client_signature_id'), // HelloSign signer ID
  agencySignatureId: text('agency_signature_id'),
  clientSignedAt: timestamp('client_signed_at', { withTimezone: true }),
  agencySignedAt: timestamp('agency_signed_at', { withTimezone: true }),
  
  // Terms from Proposal
  totalMonthly: decimal('total_monthly', { precision: 10, scale: 2 }),
  totalSetup: decimal('total_setup', { precision: 10, scale: 2 }),
  startDate: timestamp('start_date', { withTimezone: true }),
  termMonths: integer('term_months').default(12),
  
  // Metadata
  sentAt: timestamp('sent_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  createdBy: uuid('created_by')
});

export const contractTemplates = pgTable('contract_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  content: jsonb('content').notNull(), // Template sections with placeholders
  isDefault: boolean('is_default').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
});
```

**File**: `apps/web/src/db/schema/invoices.ts`

```typescript
import { pgTable, uuid, text, timestamp, decimal, integer, jsonb, pgEnum, date } from 'drizzle-orm/pg-core';
import { contracts } from './contracts';
import { prospects } from './prospects';

export const invoiceStateEnum = pgEnum('invoice_state', [
  'draft',      // Created but not sent
  'sent',       // Sent to client
  'viewed',     // Client opened invoice
  'paid',       // Payment received
  'overdue',    // Past due date
  'void',       // Cancelled
  'refunded'    // Payment refunded
]);

export const invoiceTypeEnum = pgEnum('invoice_type', [
  'setup',      // One-time setup fee
  'monthly',    // Monthly retainer
  'milestone',  // Project milestone payment
  'overage'     // Usage overage charge
]);

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  prospectId: uuid('prospect_id').references(() => prospects.id).notNull(),
  contractId: uuid('contract_id').references(() => contracts.id),
  type: invoiceTypeEnum('type').notNull(),
  state: invoiceStateEnum('state').default('draft').notNull(),
  
  // Amount
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').default('USD').notNull(),
  lineItems: jsonb('line_items'), // [{description, qty, unit_price, total}]
  taxAmount: decimal('tax_amount', { precision: 10, scale: 2 }).default('0'),
  
  // Stripe Integration
  stripeInvoiceId: text('stripe_invoice_id'),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeHostedUrl: text('stripe_hosted_url'),     // Link to Stripe-hosted invoice
  stripePdfUrl: text('stripe_pdf_url'),           // PDF download link
  
  // Dates
  invoiceNumber: text('invoice_number'),          // Human-readable: INV-2026-0042
  issuedAt: timestamp('issued_at', { withTimezone: true }),
  dueDate: date('due_date'),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  
  // Overdue Handling
  remindersSent: integer('reminders_sent').default(0),
  lastReminderAt: timestamp('last_reminder_at', { withTimezone: true }),
  
  // Metadata
  notes: text('notes'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
});

export const paymentEvents = pgTable('payment_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').references(() => invoices.id).notNull(),
  
  // Event Details
  eventType: text('event_type').notNull(),        // stripe event type
  stripeEventId: text('stripe_event_id').notNull(),
  
  // Status
  processed: boolean('processed').default(false),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  error: text('error'),
  
  // Raw Event
  payload: jsonb('payload'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
});
```

### 2.2 Migration SQL

**File**: `apps/web/src/db/migrations/003_contracts_invoices.sql`

```sql
-- Enums
CREATE TYPE contract_state AS ENUM (
  'draft', 'sent', 'client_signed', 'fully_executed', 'voided', 'expired'
);

CREATE TYPE invoice_state AS ENUM (
  'draft', 'sent', 'viewed', 'paid', 'overdue', 'void', 'refunded'
);

CREATE TYPE invoice_type AS ENUM (
  'setup', 'monthly', 'milestone', 'overage'
);

-- Contract Templates
CREATE TABLE contract_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  content JSONB NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contracts
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id),
  prospect_id UUID NOT NULL REFERENCES prospects(id),
  state contract_state DEFAULT 'draft' NOT NULL,
  
  template_id UUID REFERENCES contract_templates(id),
  title TEXT NOT NULL,
  content JSONB,
  
  esign_provider TEXT DEFAULT 'hellosign',
  esign_request_id TEXT,
  esign_document_url TEXT,
  
  client_signature_id TEXT,
  agency_signature_id TEXT,
  client_signed_at TIMESTAMPTZ,
  agency_signed_at TIMESTAMPTZ,
  
  total_monthly DECIMAL(10,2),
  total_setup DECIMAL(10,2),
  start_date TIMESTAMPTZ,
  term_months INTEGER DEFAULT 12,
  
  sent_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- Invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES prospects(id),
  contract_id UUID REFERENCES contracts(id),
  type invoice_type NOT NULL,
  state invoice_state DEFAULT 'draft' NOT NULL,
  
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD' NOT NULL,
  line_items JSONB,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  
  stripe_invoice_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  stripe_customer_id TEXT,
  stripe_hosted_url TEXT,
  stripe_pdf_url TEXT,
  
  invoice_number TEXT UNIQUE,
  issued_at TIMESTAMPTZ,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  
  reminders_sent INTEGER DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Events (webhook idempotency)
CREATE TABLE payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  event_type TEXT NOT NULL,
  stripe_event_id TEXT NOT NULL UNIQUE,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_contracts_prospect ON contracts(prospect_id);
CREATE INDEX idx_contracts_proposal ON contracts(proposal_id);
CREATE INDEX idx_contracts_state ON contracts(state);
CREATE INDEX idx_contracts_esign_request ON contracts(esign_request_id);

CREATE INDEX idx_invoices_prospect ON invoices(prospect_id);
CREATE INDEX idx_invoices_contract ON invoices(contract_id);
CREATE INDEX idx_invoices_state ON invoices(state);
CREATE INDEX idx_invoices_stripe_id ON invoices(stripe_invoice_id);
CREATE INDEX idx_invoices_due_date ON invoices(due_date) WHERE state NOT IN ('paid', 'void', 'refunded');

CREATE INDEX idx_payment_events_invoice ON payment_events(invoice_id);
CREATE INDEX idx_payment_events_stripe ON payment_events(stripe_event_id);
```

---

## 3. API Routes

### 3.1 Contract Routes

| Method | Route | Purpose | Auth |
|--------|-------|---------|------|
| `GET` | `/api/contracts` | List contracts (filterable by state) | Agency |
| `GET` | `/api/contracts/:id` | Get contract details | Agency |
| `POST` | `/api/contracts` | Create contract from proposal | Agency |
| `PATCH` | `/api/contracts/:id` | Update contract (edit before send) | Agency |
| `POST` | `/api/contracts/:id/send` | Send for signature via HelloSign | Agency |
| `POST` | `/api/contracts/:id/void` | Void/cancel contract | Agency |
| `POST` | `/api/contracts/:id/resend` | Resend signature request | Agency |
| `GET` | `/api/contracts/:id/download` | Download signed PDF | Agency |

**Webhook**:
| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/webhooks/hellosign` | HelloSign signature events |

### 3.2 Invoice Routes

| Method | Route | Purpose | Auth |
|--------|-------|---------|------|
| `GET` | `/api/invoices` | List invoices (filterable) | Agency |
| `GET` | `/api/invoices/:id` | Get invoice details | Agency |
| `POST` | `/api/invoices` | Create invoice manually | Agency |
| `PATCH` | `/api/invoices/:id` | Update draft invoice | Agency |
| `POST` | `/api/invoices/:id/send` | Send invoice via Stripe | Agency |
| `POST` | `/api/invoices/:id/void` | Void invoice | Agency |
| `POST` | `/api/invoices/:id/remind` | Send reminder | Agency |
| `GET` | `/api/invoices/:id/pdf` | Get PDF download URL | Agency |

**Webhook**:
| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/webhooks/stripe` | Stripe payment events |

### 3.3 Contract Template Routes

| Method | Route | Purpose | Auth |
|--------|-------|---------|------|
| `GET` | `/api/contract-templates` | List templates | Agency |
| `GET` | `/api/contract-templates/:id` | Get template | Agency |
| `POST` | `/api/contract-templates` | Create template | Agency Admin |
| `PATCH` | `/api/contract-templates/:id` | Update template | Agency Admin |
| `DELETE` | `/api/contract-templates/:id` | Delete template | Agency Admin |

---

## 4. API Implementation Files

### 4.1 Contract Service

**File**: `apps/web/src/lib/services/contract-service.ts`

```typescript
import { db } from '@/db';
import { contracts, contractTemplates } from '@/db/schema/contracts';
import { proposals } from '@/db/schema/proposals';
import { HelloSignClient } from '@/lib/integrations/hellosign';
import { eq } from 'drizzle-orm';

export class ContractService {
  
  /**
   * Generate contract from accepted proposal
   */
  async createFromProposal(proposalId: string, templateId?: string): Promise<Contract> {
    const proposal = await db.query.proposals.findFirst({
      where: eq(proposals.id, proposalId),
      with: { prospect: true }
    });
    
    if (!proposal) throw new Error('Proposal not found');
    if (proposal.state !== 'accepted') throw new Error('Proposal must be accepted');
    
    // Get template
    const template = templateId 
      ? await db.query.contractTemplates.findFirst({ where: eq(contractTemplates.id, templateId) })
      : await db.query.contractTemplates.findFirst({ where: eq(contractTemplates.isDefault, true) });
    
    if (!template) throw new Error('No contract template found');
    
    // Generate contract content from template + proposal
    const content = this.mergeTemplateWithProposal(template.content, proposal);
    
    const [contract] = await db.insert(contracts).values({
      proposalId,
      prospectId: proposal.prospectId,
      templateId: template.id,
      title: `Service Agreement - ${proposal.prospect.companyName}`,
      content,
      totalMonthly: proposal.totalMonthly,
      totalSetup: proposal.totalSetup,
      startDate: proposal.startDate,
      state: 'draft'
    }).returning();
    
    // Log activity
    await this.logActivity(contract.id, 'created', 'system');
    
    return contract;
  }
  
  /**
   * Send contract for e-signature via HelloSign
   */
  async sendForSignature(contractId: string): Promise<Contract> {
    const contract = await db.query.contracts.findFirst({
      where: eq(contracts.id, contractId),
      with: { prospect: true, proposal: true }
    });
    
    if (!contract) throw new Error('Contract not found');
    if (contract.state !== 'draft') throw new Error('Contract already sent');
    
    // Create HelloSign signature request
    const hellosign = new HelloSignClient();
    const signatureRequest = await hellosign.createSignatureRequest({
      title: contract.title,
      subject: `Contract from ${process.env.AGENCY_NAME}`,
      message: 'Please review and sign this service agreement.',
      signers: [
        {
          email: contract.prospect.email,
          name: contract.prospect.contactName,
          order: 0
        },
        {
          email: process.env.AGENCY_SIGNER_EMAIL!,
          name: process.env.AGENCY_SIGNER_NAME!,
          order: 1
        }
      ],
      fileUrls: [], // Or generate PDF from content
      testMode: process.env.NODE_ENV !== 'production'
    });
    
    // Update contract
    const [updated] = await db.update(contracts)
      .set({
        state: 'sent',
        esignRequestId: signatureRequest.signature_request_id,
        esignDocumentUrl: signatureRequest.signing_url,
        clientSignatureId: signatureRequest.signatures[0].signature_id,
        agencySignatureId: signatureRequest.signatures[1].signature_id,
        sentAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        updatedAt: new Date()
      })
      .where(eq(contracts.id, contractId))
      .returning();
    
    // Update proposal state
    await db.update(proposals)
      .set({ state: 'contract_pending' })
      .where(eq(proposals.id, contract.proposalId));
    
    await this.logActivity(contractId, 'sent', 'system');
    
    return updated;
  }
  
  /**
   * Handle HelloSign webhook: signature completed
   */
  async handleSignatureCompleted(
    signatureRequestId: string, 
    signatureId: string
  ): Promise<void> {
    const contract = await db.query.contracts.findFirst({
      where: eq(contracts.esignRequestId, signatureRequestId)
    });
    
    if (!contract) {
      console.warn(`Contract not found for signature request: ${signatureRequestId}`);
      return;
    }
    
    // Determine which party signed
    const isClientSignature = signatureId === contract.clientSignatureId;
    const isAgencySignature = signatureId === contract.agencySignatureId;
    
    const updates: Partial<Contract> = { updatedAt: new Date() };
    
    if (isClientSignature) {
      updates.clientSignedAt = new Date();
      updates.state = 'client_signed';
      await this.logActivity(contract.id, 'client_signed', 'client');
    }
    
    if (isAgencySignature) {
      updates.agencySignedAt = new Date();
      await this.logActivity(contract.id, 'agency_signed', 'system');
    }
    
    // Check if fully executed
    const newClientSigned = updates.clientSignedAt || contract.clientSignedAt;
    const newAgencySigned = updates.agencySignedAt || contract.agencySignedAt;
    
    if (newClientSigned && newAgencySigned) {
      updates.state = 'fully_executed';
      await this.logActivity(contract.id, 'fully_executed', 'system');
      
      // Trigger invoice generation
      await this.onContractFullyExecuted(contract.id);
    }
    
    await db.update(contracts)
      .set(updates)
      .where(eq(contracts.id, contract.id));
  }
  
  /**
   * Auto-generate invoice when contract is fully executed
   */
  private async onContractFullyExecuted(contractId: string): Promise<void> {
    const contract = await db.query.contracts.findFirst({
      where: eq(contracts.id, contractId),
      with: { prospect: true }
    });
    
    if (!contract) return;
    
    // Import InvoiceService dynamically to avoid circular deps
    const { InvoiceService } = await import('./invoice-service');
    const invoiceService = new InvoiceService();
    
    // Create setup fee invoice if applicable
    if (contract.totalSetup && Number(contract.totalSetup) > 0) {
      await invoiceService.create({
        prospectId: contract.prospectId,
        contractId: contract.id,
        type: 'setup',
        amount: contract.totalSetup,
        lineItems: [{
          description: 'Setup Fee',
          qty: 1,
          unitPrice: contract.totalSetup,
          total: contract.totalSetup
        }],
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Net 14
        autoSend: true
      });
    }
    
    // Create first monthly invoice
    if (contract.totalMonthly && Number(contract.totalMonthly) > 0) {
      await invoiceService.create({
        prospectId: contract.prospectId,
        contractId: contract.id,
        type: 'monthly',
        amount: contract.totalMonthly,
        lineItems: [{
          description: `Monthly Retainer - ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
          qty: 1,
          unitPrice: contract.totalMonthly,
          total: contract.totalMonthly
        }],
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        autoSend: true
      });
    }
  }
  
  private mergeTemplateWithProposal(templateContent: any, proposal: any): any {
    // Replace placeholders in template with proposal data
    // {{client_name}}, {{services}}, {{monthly_fee}}, {{setup_fee}}, {{start_date}}, etc.
    return JSON.parse(
      JSON.stringify(templateContent)
        .replace(/\{\{client_name\}\}/g, proposal.prospect.companyName)
        .replace(/\{\{contact_name\}\}/g, proposal.prospect.contactName)
        .replace(/\{\{monthly_fee\}\}/g, proposal.totalMonthly)
        .replace(/\{\{setup_fee\}\}/g, proposal.totalSetup || '0')
        .replace(/\{\{start_date\}\}/g, proposal.startDate?.toLocaleDateString() || 'TBD')
        .replace(/\{\{term_months\}\}/g, '12')
    );
  }
  
  private async logActivity(contractId: string, action: string, actorType: string): Promise<void> {
    // Log to pipeline_activities table
    await db.insert(pipelineActivities).values({
      entityType: 'contract',
      entityId: contractId,
      action,
      actorType
    });
  }
}
```

### 4.2 Invoice Service

**File**: `apps/web/src/lib/services/invoice-service.ts`

```typescript
import { db } from '@/db';
import { invoices, paymentEvents } from '@/db/schema/invoices';
import { prospects } from '@/db/schema/prospects';
import { StripeClient } from '@/lib/integrations/stripe';
import { eq, and, lt, not, inArray } from 'drizzle-orm';

export class InvoiceService {
  private stripe = new StripeClient();
  
  /**
   * Create a new invoice
   */
  async create(params: {
    prospectId: string;
    contractId?: string;
    type: 'setup' | 'monthly' | 'milestone' | 'overage';
    amount: string | number;
    lineItems: LineItem[];
    dueDate: Date;
    autoSend?: boolean;
    notes?: string;
  }): Promise<Invoice> {
    const prospect = await db.query.prospects.findFirst({
      where: eq(prospects.id, params.prospectId)
    });
    
    if (!prospect) throw new Error('Prospect not found');
    
    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber();
    
    // Ensure Stripe customer exists
    const stripeCustomerId = await this.ensureStripeCustomer(prospect);
    
    // Create Stripe invoice
    const stripeInvoice = await this.stripe.invoices.create({
      customer: stripeCustomerId,
      collection_method: 'send_invoice',
      days_until_due: Math.ceil((params.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      metadata: {
        prospect_id: params.prospectId,
        contract_id: params.contractId || '',
        type: params.type,
        invoice_number: invoiceNumber
      }
    });
    
    // Add line items to Stripe invoice
    for (const item of params.lineItems) {
      await this.stripe.invoiceItems.create({
        customer: stripeCustomerId,
        invoice: stripeInvoice.id,
        description: item.description,
        quantity: item.qty,
        unit_amount: Math.round(Number(item.unitPrice) * 100) // cents
      });
    }
    
    // Finalize Stripe invoice (makes it ready to send)
    const finalizedInvoice = await this.stripe.invoices.finalizeInvoice(stripeInvoice.id);
    
    // Create local invoice record
    const [invoice] = await db.insert(invoices).values({
      prospectId: params.prospectId,
      contractId: params.contractId,
      type: params.type,
      state: 'draft',
      amount: String(params.amount),
      lineItems: params.lineItems,
      invoiceNumber,
      dueDate: params.dueDate.toISOString().split('T')[0],
      stripeInvoiceId: finalizedInvoice.id,
      stripeCustomerId,
      stripeHostedUrl: finalizedInvoice.hosted_invoice_url,
      stripePdfUrl: finalizedInvoice.invoice_pdf,
      notes: params.notes
    }).returning();
    
    await this.logActivity(invoice.id, 'created', 'system');
    
    // Auto-send if requested
    if (params.autoSend) {
      await this.send(invoice.id);
    }
    
    return invoice;
  }
  
  /**
   * Send invoice to client
   */
  async send(invoiceId: string): Promise<Invoice> {
    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, invoiceId)
    });
    
    if (!invoice) throw new Error('Invoice not found');
    if (invoice.state !== 'draft') throw new Error('Invoice already sent');
    
    // Send via Stripe
    await this.stripe.invoices.sendInvoice(invoice.stripeInvoiceId!);
    
    // Update local record
    const [updated] = await db.update(invoices)
      .set({
        state: 'sent',
        issuedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(invoices.id, invoiceId))
      .returning();
    
    await this.logActivity(invoiceId, 'sent', 'system');
    
    return updated;
  }
  
  /**
   * Handle Stripe webhook: invoice.payment_succeeded
   */
  async handlePaymentSucceeded(stripeInvoiceId: string, stripeEventId: string): Promise<void> {
    // Idempotency check
    const existingEvent = await db.query.paymentEvents.findFirst({
      where: eq(paymentEvents.stripeEventId, stripeEventId)
    });
    
    if (existingEvent?.processed) {
      console.log(`Event ${stripeEventId} already processed, skipping`);
      return;
    }
    
    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.stripeInvoiceId, stripeInvoiceId)
    });
    
    if (!invoice) {
      console.warn(`Invoice not found for Stripe invoice: ${stripeInvoiceId}`);
      return;
    }
    
    // Update invoice
    await db.update(invoices)
      .set({
        state: 'paid',
        paidAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(invoices.id, invoice.id));
    
    // Record event
    await db.insert(paymentEvents).values({
      invoiceId: invoice.id,
      eventType: 'invoice.payment_succeeded',
      stripeEventId,
      processed: true,
      processedAt: new Date()
    });
    
    await this.logActivity(invoice.id, 'paid', 'system');
    
    // Trigger onboarding if this was setup/first invoice
    if (invoice.type === 'setup' || await this.isFirstInvoice(invoice)) {
      await this.triggerOnboarding(invoice.prospectId);
    }
  }
  
  /**
   * Handle Stripe webhook: invoice.payment_failed
   */
  async handlePaymentFailed(stripeInvoiceId: string, stripeEventId: string, failureReason: string): Promise<void> {
    const existingEvent = await db.query.paymentEvents.findFirst({
      where: eq(paymentEvents.stripeEventId, stripeEventId)
    });
    
    if (existingEvent?.processed) return;
    
    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.stripeInvoiceId, stripeInvoiceId)
    });
    
    if (!invoice) return;
    
    // Don't change state to overdue yet - Stripe will retry
    // Just log the event
    await db.insert(paymentEvents).values({
      invoiceId: invoice.id,
      eventType: 'invoice.payment_failed',
      stripeEventId,
      processed: true,
      processedAt: new Date(),
      payload: { reason: failureReason }
    });
    
    await this.logActivity(invoice.id, 'payment_failed', 'system', { reason: failureReason });
    
    // TODO: Send notification to agency
  }
  
  /**
   * Mark overdue invoices (run via cron)
   */
  async markOverdueInvoices(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    
    const overdueInvoices = await db.update(invoices)
      .set({
        state: 'overdue',
        updatedAt: new Date()
      })
      .where(
        and(
          eq(invoices.state, 'sent'),
          lt(invoices.dueDate, today)
        )
      )
      .returning();
    
    for (const invoice of overdueInvoices) {
      await this.logActivity(invoice.id, 'overdue', 'system');
    }
    
    return overdueInvoices.length;
  }
  
  /**
   * Send reminder for overdue invoice
   */
  async sendReminder(invoiceId: string): Promise<void> {
    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, invoiceId),
      with: { prospect: true }
    });
    
    if (!invoice || invoice.state !== 'overdue') return;
    
    // TODO: Send reminder email via Resend/SendGrid
    
    await db.update(invoices)
      .set({
        remindersSent: (invoice.remindersSent || 0) + 1,
        lastReminderAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(invoices.id, invoiceId));
    
    await this.logActivity(invoiceId, 'reminder_sent', 'system');
  }
  
  private async ensureStripeCustomer(prospect: any): Promise<string> {
    if (prospect.stripeCustomerId) {
      return prospect.stripeCustomerId;
    }
    
    const customer = await this.stripe.customers.create({
      email: prospect.email,
      name: prospect.companyName,
      metadata: {
        prospect_id: prospect.id
      }
    });
    
    await db.update(prospects)
      .set({ stripeCustomerId: customer.id })
      .where(eq(prospects.id, prospect.id));
    
    return customer.id;
  }
  
  private async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await db.select({ count: sql<number>`count(*)` })
      .from(invoices)
      .where(sql`EXTRACT(YEAR FROM created_at) = ${year}`);
    
    const sequence = (count[0]?.count || 0) + 1;
    return `INV-${year}-${String(sequence).padStart(4, '0')}`;
  }
  
  private async isFirstInvoice(invoice: Invoice): Promise<boolean> {
    const paidInvoices = await db.query.invoices.findMany({
      where: and(
        eq(invoices.prospectId, invoice.prospectId),
        eq(invoices.state, 'paid'),
        not(eq(invoices.id, invoice.id))
      )
    });
    
    return paidInvoices.length === 0;
  }
  
  private async triggerOnboarding(prospectId: string): Promise<void> {
    // Import OnboardingService dynamically
    const { OnboardingService } = await import('./onboarding-service');
    const onboardingService = new OnboardingService();
    
    await onboardingService.startOnboarding(prospectId);
  }
  
  private async logActivity(invoiceId: string, action: string, actorType: string, metadata?: any): Promise<void> {
    await db.insert(pipelineActivities).values({
      entityType: 'invoice',
      entityId: invoiceId,
      action,
      actorType,
      metadata
    });
  }
}
```

### 4.3 HelloSign Integration

**File**: `apps/web/src/lib/integrations/hellosign.ts`

```typescript
import * as HelloSign from 'hellosign-sdk';

export class HelloSignClient {
  private client: HelloSign;
  
  constructor() {
    this.client = new HelloSign({ key: process.env.HELLOSIGN_API_KEY! });
  }
  
  async createSignatureRequest(params: {
    title: string;
    subject: string;
    message: string;
    signers: Array<{ email: string; name: string; order: number }>;
    fileUrls?: string[];
    fileContent?: Buffer;
    testMode?: boolean;
  }): Promise<HelloSign.SignatureRequest> {
    const opts: HelloSign.SignatureRequestCreateEmbeddedOpts = {
      test_mode: params.testMode ? 1 : 0,
      clientId: process.env.HELLOSIGN_CLIENT_ID!,
      title: params.title,
      subject: params.subject,
      message: params.message,
      signers: params.signers.map((s, i) => ({
        email_address: s.email,
        name: s.name,
        order: s.order
      })),
      signing_options: {
        draw: true,
        type: true,
        upload: true,
        phone: false,
        default_type: 'draw'
      }
    };
    
    if (params.fileUrls?.length) {
      opts.file_urls = params.fileUrls;
    }
    
    const response = await this.client.signatureRequest.createEmbedded(opts);
    return response.signature_request;
  }
  
  async getSignatureRequest(requestId: string): Promise<HelloSign.SignatureRequest> {
    const response = await this.client.signatureRequest.get(requestId);
    return response.signature_request;
  }
  
  async downloadDocument(requestId: string): Promise<Buffer> {
    const response = await this.client.signatureRequest.download(requestId, {
      file_type: 'pdf'
    });
    return response;
  }
  
  async cancelSignatureRequest(requestId: string): Promise<void> {
    await this.client.signatureRequest.cancel(requestId);
  }
  
  async sendReminder(requestId: string, email: string): Promise<void> {
    await this.client.signatureRequest.remind(requestId, {
      email_address: email
    });
  }
  
  /**
   * Verify webhook signature
   */
  static verifyWebhook(eventHash: string, eventType: string): boolean {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', process.env.HELLOSIGN_API_KEY!);
    hmac.update(`${process.env.HELLOSIGN_API_KEY!}${eventType}`);
    const expectedHash = hmac.digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(eventHash),
      Buffer.from(expectedHash)
    );
  }
}
```

### 4.4 Stripe Integration

**File**: `apps/web/src/lib/integrations/stripe.ts`

```typescript
import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-12-18.acacia', // Use latest stable
      typescript: true
    });
  }
  return stripeInstance;
}

export class StripeClient {
  private stripe = getStripeClient();
  
  get customers() {
    return this.stripe.customers;
  }
  
  get invoices() {
    return this.stripe.invoices;
  }
  
  get invoiceItems() {
    return this.stripe.invoiceItems;
  }
  
  get paymentIntents() {
    return this.stripe.paymentIntents;
  }
  
  get subscriptions() {
    return this.stripe.subscriptions;
  }
  
  /**
   * Verify webhook signature
   */
  async verifyWebhook(body: string, signature: string): Promise<Stripe.Event> {
    return this.stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  }
}
```

---

## 5. API Route Handlers

### 5.1 Contracts API

**File**: `apps/web/src/app/api/contracts/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiAuth } from '@/lib/auth/api-auth';
import { ContractService } from '@/lib/services/contract-service';
import { db } from '@/db';
import { contracts } from '@/db/schema/contracts';
import { desc, eq } from 'drizzle-orm';

const createSchema = z.object({
  proposalId: z.string().uuid(),
  templateId: z.string().uuid().optional()
});

export const GET = withApiAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const state = searchParams.get('state');
  const prospectId = searchParams.get('prospectId');
  
  let query = db.query.contracts.findMany({
    with: { prospect: true, proposal: true },
    orderBy: desc(contracts.createdAt)
  });
  
  // Apply filters
  // ...
  
  const results = await query;
  return NextResponse.json({ data: results });
});

export const POST = withApiAuth(async (req: NextRequest) => {
  const body = await req.json();
  const parsed = createSchema.parse(body);
  
  const contractService = new ContractService();
  const contract = await contractService.createFromProposal(
    parsed.proposalId,
    parsed.templateId
  );
  
  return NextResponse.json({ data: contract }, { status: 201 });
});
```

**File**: `apps/web/src/app/api/contracts/[id]/send/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/auth/api-auth';
import { ContractService } from '@/lib/services/contract-service';

export const POST = withApiAuth(async (
  req: NextRequest,
  { params }: { params: { id: string } }
) => {
  const contractService = new ContractService();
  const contract = await contractService.sendForSignature(params.id);
  
  return NextResponse.json({ data: contract });
});
```

### 5.2 Invoices API

**File**: `apps/web/src/app/api/invoices/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiAuth } from '@/lib/auth/api-auth';
import { InvoiceService } from '@/lib/services/invoice-service';

const createSchema = z.object({
  prospectId: z.string().uuid(),
  contractId: z.string().uuid().optional(),
  type: z.enum(['setup', 'monthly', 'milestone', 'overage']),
  amount: z.number().positive(),
  lineItems: z.array(z.object({
    description: z.string(),
    qty: z.number().int().positive(),
    unitPrice: z.number().positive(),
    total: z.number().positive()
  })),
  dueDate: z.string().datetime(),
  notes: z.string().optional()
});

export const GET = withApiAuth(async (req: NextRequest) => {
  // List invoices with filters
  const { searchParams } = new URL(req.url);
  // ... implementation
});

export const POST = withApiAuth(async (req: NextRequest) => {
  const body = await req.json();
  const parsed = createSchema.parse(body);
  
  const invoiceService = new InvoiceService();
  const invoice = await invoiceService.create({
    ...parsed,
    dueDate: new Date(parsed.dueDate),
    autoSend: false
  });
  
  return NextResponse.json({ data: invoice }, { status: 201 });
});
```

### 5.3 Webhook Handlers

**File**: `apps/web/src/app/api/webhooks/hellosign/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { HelloSignClient } from '@/lib/integrations/hellosign';
import { ContractService } from '@/lib/services/contract-service';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const data = JSON.parse(body);
  
  // Verify webhook signature
  const eventHash = data.event.event_hash;
  const eventType = data.event.event_type;
  
  if (!HelloSignClient.verifyWebhook(eventHash, eventType)) {
    console.error('HelloSign webhook signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
  
  const contractService = new ContractService();
  
  try {
    switch (eventType) {
      case 'signature_request_signed':
        // Individual signature completed
        await contractService.handleSignatureCompleted(
          data.signature_request.signature_request_id,
          data.event.signature_id
        );
        break;
        
      case 'signature_request_all_signed':
        // All parties have signed - handled by individual signature events
        // This is a confirmation event
        console.log(`Contract fully signed: ${data.signature_request.signature_request_id}`);
        break;
        
      case 'signature_request_sent':
        // Signature request sent
        console.log(`Contract sent: ${data.signature_request.signature_request_id}`);
        break;
        
      case 'signature_request_expired':
        // Handle expiration
        await contractService.handleExpired(data.signature_request.signature_request_id);
        break;
        
      case 'signature_request_declined':
        // Handle decline
        await contractService.handleDeclined(data.signature_request.signature_request_id);
        break;
        
      default:
        console.log(`Unhandled HelloSign event: ${eventType}`);
    }
    
    // HelloSign expects "Hello API Event Received" response
    return new NextResponse('Hello API Event Received', { status: 200 });
  } catch (error) {
    console.error('HelloSign webhook error:', error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
```

**File**: `apps/web/src/app/api/webhooks/stripe/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getStripeClient } from '@/lib/integrations/stripe';
import { InvoiceService } from '@/lib/services/invoice-service';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');
  
  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }
  
  const stripe = getStripeClient();
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
  
  const invoiceService = new InvoiceService();
  
  try {
    switch (event.type) {
      case 'invoice.payment_succeeded':
        const paidInvoice = event.data.object;
        await invoiceService.handlePaymentSucceeded(paidInvoice.id, event.id);
        break;
        
      case 'invoice.payment_failed':
        const failedInvoice = event.data.object;
        await invoiceService.handlePaymentFailed(
          failedInvoice.id,
          event.id,
          failedInvoice.last_payment_error?.message || 'Unknown error'
        );
        break;
        
      case 'invoice.sent':
        console.log(`Invoice sent via Stripe: ${event.data.object.id}`);
        break;
        
      case 'invoice.overdue':
        // Stripe marks invoice as overdue
        console.log(`Invoice overdue: ${event.data.object.id}`);
        break;
        
      default:
        console.log(`Unhandled Stripe event: ${event.type}`);
    }
    
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
```

---

## 6. UI Components

### 6.1 Contract Status Card

**File**: `apps/web/src/components/contracts/ContractStatusCard.tsx`

```tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { FileText, Send, Download, Clock, CheckCircle, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ContractStatusCardProps {
  contract: {
    id: string;
    title: string;
    state: 'draft' | 'sent' | 'client_signed' | 'fully_executed' | 'voided' | 'expired';
    prospect: { companyName: string; contactName: string };
    totalMonthly: string;
    totalSetup: string;
    sentAt?: Date;
    clientSignedAt?: Date;
    agencySignedAt?: Date;
    expiresAt?: Date;
  };
  onSend: () => void;
  onDownload: () => void;
  onVoid: () => void;
}

const stateConfig = {
  draft: { label: 'Draft', color: 'bg-zinc-100 text-zinc-600', progress: 0 },
  sent: { label: 'Awaiting Signature', color: 'bg-amber-50 text-amber-700', progress: 33 },
  client_signed: { label: 'Client Signed', color: 'bg-blue-50 text-blue-700', progress: 66 },
  fully_executed: { label: 'Executed', color: 'bg-emerald-50 text-emerald-700', progress: 100 },
  voided: { label: 'Voided', color: 'bg-red-50 text-red-700', progress: 0 },
  expired: { label: 'Expired', color: 'bg-zinc-100 text-zinc-500', progress: 0 }
};

export function ContractStatusCard({ contract, onSend, onDownload, onVoid }: ContractStatusCardProps) {
  const config = stateConfig[contract.state];
  
  return (
    <Card className="shadow-card hover:shadow-lift transition-shadow duration-280">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent-soft flex items-center justify-center">
            <FileText className="w-5 h-5 text-accent" />
          </div>
          <div>
            <CardTitle className="text-[15px] font-medium">{contract.title}</CardTitle>
            <p className="text-[13px] text-text-3">{contract.prospect.companyName}</p>
          </div>
        </div>
        <Badge className={config.color}>{config.label}</Badge>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress */}
        {contract.state !== 'voided' && contract.state !== 'expired' && (
          <div className="space-y-2">
            <Progress value={config.progress} className="h-1.5" />
            <div className="flex justify-between text-[12px] text-text-3">
              <span>Created</span>
              <span>Sent</span>
              <span>Client Signs</span>
              <span>Executed</span>
            </div>
          </div>
        )}
        
        {/* Amounts */}
        <div className="grid grid-cols-2 gap-4 py-3 border-y border-hairline-2">
          <div>
            <p className="text-[12px] text-text-3 uppercase tracking-wider">Setup Fee</p>
            <p className="text-[20px] font-display tabular-nums">
              ${Number(contract.totalSetup).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-[12px] text-text-3 uppercase tracking-wider">Monthly</p>
            <p className="text-[20px] font-display tabular-nums">
              ${Number(contract.totalMonthly).toLocaleString()}/mo
            </p>
          </div>
        </div>
        
        {/* Timeline */}
        <div className="space-y-2 text-[13px]">
          {contract.sentAt && (
            <div className="flex items-center gap-2 text-text-2">
              <Send className="w-4 h-4" />
              <span>Sent {formatDistanceToNow(contract.sentAt, { addSuffix: true })}</span>
            </div>
          )}
          {contract.clientSignedAt && (
            <div className="flex items-center gap-2 text-success">
              <CheckCircle className="w-4 h-4" />
              <span>Client signed {formatDistanceToNow(contract.clientSignedAt, { addSuffix: true })}</span>
            </div>
          )}
          {contract.state === 'sent' && contract.expiresAt && (
            <div className="flex items-center gap-2 text-warning">
              <Clock className="w-4 h-4" />
              <span>Expires {formatDistanceToNow(contract.expiresAt, { addSuffix: true })}</span>
            </div>
          )}
        </div>
        
        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {contract.state === 'draft' && (
            <Button onClick={onSend} className="btn-primary flex-1">
              <Send className="w-4 h-4 mr-2" />
              Send for Signature
            </Button>
          )}
          {contract.state === 'fully_executed' && (
            <Button onClick={onDownload} variant="outline" className="flex-1">
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          )}
          {(contract.state === 'draft' || contract.state === 'sent') && (
            <Button onClick={onVoid} variant="ghost" className="text-error">
              <XCircle className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

### 6.2 Invoice Card

**File**: `apps/web/src/components/invoices/InvoiceCard.tsx`

```tsx
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Receipt, ExternalLink, Send, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface InvoiceCardProps {
  invoice: {
    id: string;
    invoiceNumber: string;
    type: 'setup' | 'monthly' | 'milestone' | 'overage';
    state: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'void';
    amount: string;
    dueDate: string;
    issuedAt?: Date;
    paidAt?: Date;
    stripeHostedUrl?: string;
    prospect: { companyName: string };
  };
  onSend: () => void;
  onRemind: () => void;
  onViewInStripe: () => void;
}

const stateStyles = {
  draft: 'bg-zinc-100 text-zinc-600',
  sent: 'bg-blue-50 text-blue-700',
  viewed: 'bg-purple-50 text-purple-700',
  paid: 'bg-emerald-50 text-emerald-700',
  overdue: 'bg-red-50 text-red-700',
  void: 'bg-zinc-100 text-zinc-500 line-through'
};

const borderStyles = {
  draft: 'border-l-zinc-300',
  sent: 'border-l-blue-500',
  viewed: 'border-l-purple-500',
  paid: 'border-l-emerald-500',
  overdue: 'border-l-red-500',
  void: 'border-l-zinc-300'
};

export function InvoiceCard({ invoice, onSend, onRemind, onViewInStripe }: InvoiceCardProps) {
  const isOverdue = invoice.state === 'overdue';
  
  return (
    <Card className={`border-l-4 ${borderStyles[invoice.state]} shadow-card hover:shadow-lift transition-shadow duration-280`}>
      <CardContent className="py-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              invoice.state === 'paid' ? 'bg-success-soft' : 
              isOverdue ? 'bg-error-soft' : 'bg-surface-2'
            }`}>
              <Receipt className={`w-5 h-5 ${
                invoice.state === 'paid' ? 'text-success' :
                isOverdue ? 'text-error' : 'text-text-3'
              }`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[13px] text-text-2">{invoice.invoiceNumber}</span>
                <Badge className={stateStyles[invoice.state]}>
                  {invoice.state.charAt(0).toUpperCase() + invoice.state.slice(1)}
                </Badge>
              </div>
              <p className="text-[13px] text-text-3">{invoice.prospect.companyName}</p>
            </div>
          </div>
          
          <div className="text-right">
            <p className="font-display text-[24px] tabular-nums text-text-1">
              ${Number(invoice.amount).toLocaleString()}
            </p>
            <p className="text-[12px] text-text-3">
              {invoice.type === 'monthly' ? 'Monthly retainer' : 
               invoice.type === 'setup' ? 'Setup fee' : invoice.type}
            </p>
          </div>
        </div>
        
        {/* Due date / paid date */}
        <div className="mt-4 pt-3 border-t border-hairline-2 flex items-center justify-between">
          <div className="text-[13px]">
            {invoice.paidAt ? (
              <span className="text-success flex items-center gap-1">
                Paid {formatDistanceToNow(invoice.paidAt, { addSuffix: true })}
              </span>
            ) : isOverdue ? (
              <span className="text-error flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                Was due {formatDistanceToNow(new Date(invoice.dueDate), { addSuffix: true })}
              </span>
            ) : invoice.issuedAt ? (
              <span className="text-text-3">
                Due {format(new Date(invoice.dueDate), 'MMM d, yyyy')}
              </span>
            ) : (
              <span className="text-text-3">Draft</span>
            )}
          </div>
          
          <div className="flex gap-2">
            {invoice.state === 'draft' && (
              <Button onClick={onSend} size="sm" className="btn-primary">
                <Send className="w-4 h-4 mr-1" />
                Send
              </Button>
            )}
            {isOverdue && (
              <Button onClick={onRemind} size="sm" variant="outline">
                Send Reminder
              </Button>
            )}
            {invoice.stripeHostedUrl && (
              <Button onClick={onViewInStripe} size="sm" variant="ghost">
                <ExternalLink className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 6.3 Payment Progress Indicator

**File**: `apps/web/src/components/pipeline/PaymentProgress.tsx`

```tsx
'use client';

import { CheckCircle, Circle, AlertCircle } from 'lucide-react';

interface PaymentProgressProps {
  stages: Array<{
    key: string;
    label: string;
    status: 'complete' | 'current' | 'pending' | 'error';
    timestamp?: Date;
  }>;
}

export function PaymentProgress({ stages }: PaymentProgressProps) {
  return (
    <div className="flex items-center gap-2">
      {stages.map((stage, index) => (
        <div key={stage.key} className="flex items-center">
          {/* Stage indicator */}
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              stage.status === 'complete' ? 'bg-success-soft' :
              stage.status === 'current' ? 'bg-accent-soft' :
              stage.status === 'error' ? 'bg-error-soft' :
              'bg-surface-2'
            }`}>
              {stage.status === 'complete' && <CheckCircle className="w-4 h-4 text-success" />}
              {stage.status === 'current' && <Circle className="w-4 h-4 text-accent animate-pulse" />}
              {stage.status === 'error' && <AlertCircle className="w-4 h-4 text-error" />}
              {stage.status === 'pending' && <Circle className="w-4 h-4 text-text-4" />}
            </div>
            <span className={`mt-1 text-[11px] ${
              stage.status === 'complete' || stage.status === 'current' 
                ? 'text-text-2' 
                : 'text-text-4'
            }`}>
              {stage.label}
            </span>
          </div>
          
          {/* Connector line */}
          {index < stages.length - 1 && (
            <div className={`w-8 h-0.5 mx-1 ${
              stage.status === 'complete' ? 'bg-success' : 'bg-surface-3'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
}
```

---

## 7. Automation Flow

### 7.1 State Transition Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CONTRACT & PAYMENT AUTOMATION                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [PROPOSAL ACCEPTED]                                                    │
│         │                                                               │
│         ▼                                                               │
│  ┌──────────────────┐                                                   │
│  │ Auto: Generate   │  System creates contract from proposal +         │
│  │ Contract Draft   │  template, pre-fills all terms                   │
│  └────────┬─────────┘                                                   │
│           │                                                             │
│           ▼                                                             │
│  ┌──────────────────┐                                                   │
│  │ Manual: Agency   │  Agency reviews terms, adds custom clauses,      │
│  │ Review & Edit    │  selects template if needed                      │
│  └────────┬─────────┘                                                   │
│           │                                                             │
│           ▼                                                             │
│  ┌──────────────────┐                                                   │
│  │ Manual: Send for │  Agency clicks "Send for Signature"              │
│  │ Signature        │                                                   │
│  └────────┬─────────┘                                                   │
│           │                                                             │
│           ▼                                                             │
│  ┌──────────────────┐                                                   │
│  │ Auto: HelloSign  │  System creates signature request, sends         │
│  │ Request Created  │  email to client                                 │
│  └────────┬─────────┘                                                   │
│           │                                                             │
│           ▼                                                             │
│  ┌──────────────────┐                                                   │
│  │ External: Client │  Client receives email, clicks link,             │
│  │ Signs            │  signs document                                   │
│  └────────┬─────────┘                                                   │
│           │                                                             │
│           ▼ (webhook: signature_request_signed)                         │
│  ┌──────────────────┐                                                   │
│  │ Auto: Update     │  System updates contract state to                │
│  │ Contract State   │  'client_signed'                                  │
│  └────────┬─────────┘                                                   │
│           │                                                             │
│           ▼                                                             │
│  ┌──────────────────┐                                                   │
│  │ Auto/Manual:     │  Agency counter-signs (can be auto if            │
│  │ Agency Signs     │  configured)                                      │
│  └────────┬─────────┘                                                   │
│           │                                                             │
│           ▼ (webhook: signature_request_all_signed)                     │
│  ┌──────────────────┐                                                   │
│  │ Auto: Contract   │  System marks contract 'fully_executed'          │
│  │ Fully Executed   │                                                   │
│  └────────┬─────────┘                                                   │
│           │                                                             │
│           ├─────────────────────────────────────────┐                   │
│           ▼                                         ▼                   │
│  ┌──────────────────┐                    ┌──────────────────┐          │
│  │ Auto: Create     │                    │ Auto: Create     │          │
│  │ Setup Invoice    │                    │ Monthly Invoice  │          │
│  │ (if setup > 0)   │                    │ (pro-rata first) │          │
│  └────────┬─────────┘                    └────────┬─────────┘          │
│           │                                        │                    │
│           ▼                                        ▼                    │
│  ┌──────────────────┐                    ┌──────────────────┐          │
│  │ Auto: Stripe     │                    │ Auto: Stripe     │          │
│  │ Invoice Created  │                    │ Invoice Created  │          │
│  │ & Sent           │                    │ & Sent           │          │
│  └────────┬─────────┘                    └────────┬─────────┘          │
│           │                                        │                    │
│           ▼ (webhook: invoice.payment_succeeded)   │                    │
│  ┌──────────────────┐                              │                    │
│  │ Auto: Payment    │ ◀────────────────────────────┘                   │
│  │ Received         │                                                   │
│  └────────┬─────────┘                                                   │
│           │                                                             │
│           ▼                                                             │
│  ┌──────────────────┐                                                   │
│  │ Auto: Start      │  System creates onboarding checklist,            │
│  │ Onboarding       │  converts prospect to client                     │
│  └──────────────────┘                                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Error Handling Matrix

| Event | Error Scenario | System Response | Manual Intervention |
|-------|----------------|-----------------|---------------------|
| Contract Send | HelloSign API error | Retry 3x with backoff, then notify agency | Agency retries or contacts support |
| Contract Send | Invalid signer email | Return validation error immediately | Agency updates contact email |
| Client Sign | Signature declined | Update contract to 'voided', notify agency | Agency contacts client or re-negotiates |
| Client Sign | Request expired | Update contract to 'expired', create task | Agency resends or creates new contract |
| Invoice Send | Stripe API error | Retry 3x, then mark invoice as failed | Agency manually retries or invoices outside system |
| Invoice Send | Invalid customer email | Return validation error | Agency updates contact info |
| Payment | Card declined | Stripe auto-retries per their schedule | Agency receives notification after final failure |
| Payment | 3DS required | Stripe handles redirect | Client completes 3DS flow |
| Payment | Insufficient funds | Stripe retries | Agency may send reminder |
| Webhook | Duplicate event | Idempotency check prevents double-processing | None needed |
| Webhook | Signature verification fail | Log and reject | Review webhook configuration |
| Webhook | Processing error | Return 500, webhook auto-retries | Debug and fix code |

### 7.3 Background Jobs

**File**: `apps/web/src/jobs/payment-jobs.ts`

```typescript
import { db } from '@/db';
import { invoices } from '@/db/schema/invoices';
import { contracts } from '@/db/schema/contracts';
import { InvoiceService } from '@/lib/services/invoice-service';
import { and, eq, lt, sql } from 'drizzle-orm';

/**
 * Mark overdue invoices (run daily at 00:05)
 */
export async function markOverdueInvoices(): Promise<void> {
  const invoiceService = new InvoiceService();
  const count = await invoiceService.markOverdueInvoices();
  console.log(`Marked ${count} invoices as overdue`);
}

/**
 * Send overdue reminders (run daily at 09:00)
 */
export async function sendOverdueReminders(): Promise<void> {
  const invoiceService = new InvoiceService();
  
  // Find overdue invoices with < 3 reminders sent
  const overdueInvoices = await db.query.invoices.findMany({
    where: and(
      eq(invoices.state, 'overdue'),
      lt(invoices.remindersSent, 3)
    )
  });
  
  for (const invoice of overdueInvoices) {
    // Only send if last reminder was > 3 days ago
    if (invoice.lastReminderAt) {
      const daysSinceLastReminder = Math.floor(
        (Date.now() - invoice.lastReminderAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceLastReminder < 3) continue;
    }
    
    await invoiceService.sendReminder(invoice.id);
  }
}

/**
 * Expire stale contracts (run daily at 00:10)
 */
export async function expireStaleContracts(): Promise<void> {
  const now = new Date();
  
  const expiredContracts = await db.update(contracts)
    .set({
      state: 'expired',
      updatedAt: now
    })
    .where(
      and(
        eq(contracts.state, 'sent'),
        lt(contracts.expiresAt, now)
      )
    )
    .returning();
  
  console.log(`Expired ${expiredContracts.length} contracts`);
}

/**
 * Generate monthly invoices (run 1st of month at 00:00)
 */
export async function generateMonthlyInvoices(): Promise<void> {
  const invoiceService = new InvoiceService();
  
  // Find all active contracts with monthly billing
  const activeContracts = await db.query.contracts.findMany({
    where: eq(contracts.state, 'fully_executed'),
    with: { prospect: true }
  });
  
  for (const contract of activeContracts) {
    if (!contract.totalMonthly || Number(contract.totalMonthly) <= 0) continue;
    
    // Check if invoice already exists for this month
    const existingInvoice = await db.query.invoices.findFirst({
      where: and(
        eq(invoices.contractId, contract.id),
        eq(invoices.type, 'monthly'),
        sql`EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW())`,
        sql`EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())`
      )
    });
    
    if (existingInvoice) continue;
    
    const monthName = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    await invoiceService.create({
      prospectId: contract.prospectId,
      contractId: contract.id,
      type: 'monthly',
      amount: contract.totalMonthly,
      lineItems: [{
        description: `Monthly Retainer - ${monthName}`,
        qty: 1,
        unitPrice: Number(contract.totalMonthly),
        total: Number(contract.totalMonthly)
      }],
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      autoSend: true
    });
  }
}
```

---

## 8. Task Breakdown

### Sprint 1: Contract System

| Task | Description | File Path | Estimate | Dependencies |
|------|-------------|-----------|----------|--------------|
| **8.1.1** | Create contracts Drizzle schema | `apps/web/src/db/schema/contracts.ts` | 2h | — |
| **8.1.2** | Create contract templates schema | `apps/web/src/db/schema/contracts.ts` | 1h | 8.1.1 |
| **8.1.3** | Write migration SQL | `apps/web/src/db/migrations/003_contracts.sql` | 1h | 8.1.2 |
| **8.1.4** | HelloSign integration client | `apps/web/src/lib/integrations/hellosign.ts` | 3h | — |
| **8.1.5** | ContractService implementation | `apps/web/src/lib/services/contract-service.ts` | 4h | 8.1.1, 8.1.4 |
| **8.1.6** | Contract API routes (CRUD) | `apps/web/src/app/api/contracts/` | 3h | 8.1.5 |
| **8.1.7** | Contract send endpoint | `apps/web/src/app/api/contracts/[id]/send/route.ts` | 2h | 8.1.5 |
| **8.1.8** | HelloSign webhook handler | `apps/web/src/app/api/webhooks/hellosign/route.ts` | 3h | 8.1.5 |
| **8.1.9** | ContractStatusCard component | `apps/web/src/components/contracts/ContractStatusCard.tsx` | 3h | 8.1.6 |
| **8.1.10** | Contract templates CRUD | `apps/web/src/app/api/contract-templates/` | 2h | 8.1.2 |
| **8.1.11** | Default contract template seed | `apps/web/src/db/seeds/contract-templates.ts` | 1h | 8.1.2 |
| **8.1.12** | Contract list page | `apps/web/src/app/(shell)/contracts/page.tsx` | 3h | 8.1.9 |
| **8.1.13** | Contract detail page | `apps/web/src/app/(shell)/contracts/[id]/page.tsx` | 3h | 8.1.9 |
| **8.1.14** | Unit tests: ContractService | `apps/web/src/lib/services/__tests__/contract-service.test.ts` | 3h | 8.1.5 |
| **8.1.15** | Integration tests: HelloSign webhook | `apps/web/src/app/api/webhooks/__tests__/hellosign.test.ts` | 2h | 8.1.8 |

**Sprint 1 Total**: ~36 hours

### Sprint 2: Invoice & Payment System

| Task | Description | File Path | Estimate | Dependencies |
|------|-------------|-----------|----------|--------------|
| **8.2.1** | Create invoices Drizzle schema | `apps/web/src/db/schema/invoices.ts` | 2h | — |
| **8.2.2** | Create payment_events schema | `apps/web/src/db/schema/invoices.ts` | 1h | 8.2.1 |
| **8.2.3** | Write migration SQL | `apps/web/src/db/migrations/004_invoices.sql` | 1h | 8.2.2 |
| **8.2.4** | Stripe integration client | `apps/web/src/lib/integrations/stripe.ts` | 2h | — |
| **8.2.5** | InvoiceService implementation | `apps/web/src/lib/services/invoice-service.ts` | 5h | 8.2.1, 8.2.4 |
| **8.2.6** | Invoice API routes (CRUD) | `apps/web/src/app/api/invoices/` | 3h | 8.2.5 |
| **8.2.7** | Invoice send endpoint | `apps/web/src/app/api/invoices/[id]/send/route.ts` | 2h | 8.2.5 |
| **8.2.8** | Invoice remind endpoint | `apps/web/src/app/api/invoices/[id]/remind/route.ts` | 1h | 8.2.5 |
| **8.2.9** | Stripe webhook handler | `apps/web/src/app/api/webhooks/stripe/route.ts` | 3h | 8.2.5 |
| **8.2.10** | InvoiceCard component | `apps/web/src/components/invoices/InvoiceCard.tsx` | 3h | 8.2.6 |
| **8.2.11** | PaymentProgress component | `apps/web/src/components/pipeline/PaymentProgress.tsx` | 2h | — |
| **8.2.12** | Invoice list page | `apps/web/src/app/(shell)/invoices/page.tsx` | 3h | 8.2.10 |
| **8.2.13** | Invoice detail page | `apps/web/src/app/(shell)/invoices/[id]/page.tsx` | 3h | 8.2.10 |
| **8.2.14** | Auto-invoice on contract execute | Update ContractService | 2h | 8.1.5, 8.2.5 |
| **8.2.15** | Background job: mark overdue | `apps/web/src/jobs/payment-jobs.ts` | 2h | 8.2.5 |
| **8.2.16** | Background job: send reminders | `apps/web/src/jobs/payment-jobs.ts` | 2h | 8.2.5 |
| **8.2.17** | Background job: monthly invoices | `apps/web/src/jobs/payment-jobs.ts` | 3h | 8.2.5 |
| **8.2.18** | Unit tests: InvoiceService | `apps/web/src/lib/services/__tests__/invoice-service.test.ts` | 3h | 8.2.5 |
| **8.2.19** | Integration tests: Stripe webhook | `apps/web/src/app/api/webhooks/__tests__/stripe.test.ts` | 2h | 8.2.9 |
| **8.2.20** | E2E test: full payment flow | `apps/web/e2e/payment-flow.spec.ts` | 4h | All |

**Sprint 2 Total**: ~47 hours

---

## 9. Success Criteria

### 9.1 Functional Requirements

- [ ] Contract auto-generates from accepted proposal with all terms populated
- [ ] Agency can review/edit contract before sending
- [ ] Contract sends for e-signature via HelloSign
- [ ] Client receives signing email and can sign in-browser
- [ ] System updates contract state on each signature event
- [ ] Invoice auto-generates when contract is fully executed
- [ ] Invoice sends via Stripe with correct line items
- [ ] Client can pay via Stripe-hosted invoice page
- [ ] System marks invoice paid on webhook
- [ ] Overdue invoices are flagged and reminders sent
- [ ] Monthly invoices auto-generate on the 1st

### 9.2 Non-Functional Requirements

- [ ] Webhook handlers verify signatures before processing
- [ ] Webhook handlers are idempotent (duplicate events don't cause issues)
- [ ] All API routes have proper authentication
- [ ] All user inputs are validated with Zod schemas
- [ ] Error responses include actionable messages
- [ ] Background jobs run reliably on schedule

### 9.3 Design System Compliance

- [ ] ContractStatusCard uses ghost-edge shadows (no solid borders)
- [ ] InvoiceCard uses left border status indicator per design system
- [ ] Progress indicators follow v6 progress bar spec
- [ ] All numerals use tabular-nums lining-nums
- [ ] Typography follows size-to-role mapping (12px floor)
- [ ] Motion uses `--motion-hover` (280ms smooth) for cards

### 9.4 Test Coverage

- [ ] ContractService: 80%+ coverage
- [ ] InvoiceService: 80%+ coverage
- [ ] HelloSign webhook handler: 100% coverage (critical path)
- [ ] Stripe webhook handler: 100% coverage (critical path)
- [ ] E2E: Full payment flow passes

---

## 10. Environment Setup Checklist

```
☐ HelloSign account created (Business tier for API access)
☐ HelloSign API key generated and stored in HELLOSIGN_API_KEY
☐ HelloSign App created with client ID stored in HELLOSIGN_CLIENT_ID
☐ HelloSign webhook URL configured: https://app.tevero.io/api/webhooks/hellosign
☐ HelloSign webhook events subscribed: signature_request_signed, signature_request_all_signed, signature_request_sent, signature_request_declined, signature_request_expired

☐ Stripe account setup with Invoicing enabled
☐ Stripe API keys stored in STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY
☐ Stripe webhook endpoint created: https://app.tevero.io/api/webhooks/stripe
☐ Stripe webhook secret stored in STRIPE_WEBHOOK_SECRET
☐ Stripe webhook events subscribed: invoice.created, invoice.sent, invoice.payment_succeeded, invoice.payment_failed, invoice.overdue

☐ Agency signer configured in env: AGENCY_SIGNER_EMAIL, AGENCY_SIGNER_NAME
☐ Agency name configured in env: AGENCY_NAME

☐ Database migrations run (contracts, invoices tables)
☐ Default contract template seeded
☐ Background job scheduler configured (cron or BullMQ)
```

---

*Created: 2026-04-29*  
*Phase: 3 of Agency Pipeline*  
*Predecessor: Phase 2 (Proposal System)*  
*Successor: Phase 4 (Onboarding System)*
