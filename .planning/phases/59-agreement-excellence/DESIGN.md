# Phase 59: Agreement & Signing Excellence

**Goal:** Create a 3-click signing experience with template system, multi-signer support, pre-signing capability, and polished client contract page

**Depends on:** Phase 58 (service catalog complete)

**Estimated effort:** 55-65 hours

**i18n:** All UI, agreements, and email templates support EN/LT

---

## Problem Statement

Critical gaps in the agreement flow:

1. **No client contract page** — `/c/:token` does not exist
2. **Hardcoded variables** — contracts have placeholder data
3. **No preview** — agencies cannot see what they're sending
4. **8+ clicks to sign** — far from target of 3 clicks
5. **Basic PDF** — Helvetica font, no branding
6. **No template system** — recreating agreements manually
7. **Single signer only** — cannot handle multi-signer scenarios
8. **No pre-signing** — agency cannot sign before sending
9. **No variable drag-drop** — manual variable insertion

---

## User Journeys

### Agency Journey (Creating & Sending Agreement)

```
1. Proposal accepted → "Create Agreement" button appears
2. Click "Create Agreement"
3. Select template or use default
4. See agreement preview with resolved variables
5. Configure signers:
   - Provider: [Name, Title, Email] ← auto-filled from workspace
   - Client: [Name, Title, Email] ← auto-filled from prospect
   - Optional: Add additional client signer
6. Choose signing order: Sequential (provider first) or Parallel
7. If pre-signing enabled: Click "Sign & Send"
8. Provider signs via Dokobit (Smart-ID/Mobile-ID)
9. Generate client signing link
10. Copy magic link, send manually (email, WhatsApp, etc.)
11. Track: "Provider Signed" → "Client Viewed" → "Fully Executed"
```

### Client Journey (Viewing & Signing)

```
1. Receive magic link from agency
2. Click link → Opens /c/:token
3. See professional, branded agreement page
4. If provider pre-signed: See provider signature already present
5. Scroll through sections (progress indicator)
6. Toggle language EN/LT if needed
7. Check "I agree" checkbox
8. Click "Sign with Smart-ID" (or Mobile-ID)
9. Complete Dokobit authentication
10. Success page with PDF download
```

**Target: 3 clicks from link to signed**
1. Open link (auto)
2. Scroll and review
3. Click "Sign"

---

## Template System

### Agreement Template Schema

```typescript
export const agreementTemplates = pgTable("agreement_templates", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id"), // null = system template
  
  // Identification
  name: text("name").notNull(),
  nameEn: text("name_en"),
  nameLt: text("name_lt"),
  description: text("description"),
  descriptionEn: text("description_en"),
  descriptionLt: text("description_lt"),
  
  // Template type
  type: text("type").notNull().default('service_agreement'),
  // 'service_agreement' | 'nda' | 'addendum' | 'data_processing'
  
  // Clause definitions
  clauses: jsonb("clauses").notNull(), // AgreementClause[]
  clauseOrder: jsonb("clause_order").notNull(), // string[] of clause IDs
  
  // Variable definitions
  variables: jsonb("variables").notNull(), // VariableDefinition[]
  
  // Signature configuration
  signatureRequirements: jsonb("signature_requirements").notNull(), // SignatureRequirement[]
  defaultSigningOrder: text("default_signing_order").default('sequential'),
  // 'sequential' | 'parallel'
  allowPreSigning: boolean("allow_pre_signing").default(true),
  
  // Styling
  brandingSettings: jsonb("branding_settings"),
  
  // Versioning
  version: integer("version").default(1),
  isPublished: boolean("is_published").default(false),
  isDefault: boolean("is_default").default(false),
  
  // Legal
  jurisdiction: text("jurisdiction").default('LT'), // Legal jurisdiction
  lastLegalReview: timestamp("last_legal_review"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: text("created_by"),
});

// Agreement clauses (reusable legal building blocks)
export const agreementClauses = pgTable("agreement_clauses", {
  id: text("id").primaryKey(),
  templateId: text("template_id").references(() => agreementTemplates.id),
  
  // Clause identity
  key: text("key").notNull(), // 'parties', 'services', 'payment', 'termination', etc.
  
  // Localized titles
  title: text("title").notNull(),
  titleEn: text("title_en"),
  titleLt: text("title_lt"),
  
  // Localized content with variable placeholders
  content: text("content").notNull(),
  contentEn: text("content_en"),
  contentLt: text("content_lt"),
  
  // Clause configuration
  clauseType: text("clause_type").notNull(),
  // 'parties' | 'services' | 'payment' | 'term' | 'termination' | 'confidentiality' | 
  // 'liability' | 'gdpr' | 'dispute' | 'signatures' | 'custom'
  
  isRequired: boolean("is_required").default(true),
  isEditable: boolean("is_editable").default(false), // Legal clauses usually not editable
  position: integer("position").notNull(),
  
  // Conditional rendering
  conditions: jsonb("conditions"), // When to include this clause
  // e.g., { "hasService": "gdpr_addon" } includes GDPR clause
  
  createdAt: timestamp("created_at").defaultNow(),
});
```

---

## Multi-Signer Architecture

### Signature Requirements Schema

```typescript
export const signatureRequirements = pgTable("signature_requirements", {
  id: text("id").primaryKey(),
  templateId: text("template_id").references(() => agreementTemplates.id),
  
  // Requirement definition
  role: text("role").notNull(), // 'provider' | 'client'
  
  // Localized labels
  label: text("label").notNull(),
  labelEn: text("label_en"),
  labelLt: text("label_lt"),
  
  // e.g., "Director", "CEO", "CFO", "Authorized Representative"
  defaultTitle: text("default_title"),
  defaultTitleEn: text("default_title_en"),
  defaultTitleLt: text("default_title_lt"),
  
  // Signing behavior
  signingOrder: integer("signing_order").notNull(), // 0 = any order, 1/2/3 = sequential
  isRequired: boolean("is_required").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Actual signers assigned to an agreement
export const agreementSigners = pgTable("agreement_signers", {
  id: text("id").primaryKey(),
  agreementId: text("agreement_id").references(() => agreements.id).notNull(),
  requirementId: text("requirement_id").references(() => signatureRequirements.id),
  
  // Signer details
  role: text("role").notNull(), // 'provider' | 'client'
  name: text("name").notNull(),
  email: text("email").notNull(),
  title: text("title"), // Job title
  companyName: text("company_name"),
  
  // Signing order
  signingOrder: integer("signing_order").notNull(),
  
  // Status tracking
  status: text("status").notNull().default('pending'),
  // 'pending' | 'invited' | 'viewed' | 'signing' | 'signed' | 'declined'
  
  // Timestamps
  invitedAt: timestamp("invited_at"),
  viewedAt: timestamp("viewed_at"),
  signedAt: timestamp("signed_at"),
  declinedAt: timestamp("declined_at"),
  declineReason: text("decline_reason"),
  
  // Signing access
  accessToken: text("access_token").unique(),
  tokenExpiresAt: timestamp("token_expires_at"),
  
  // Dokobit signature reference
  dokobitSignatureId: text("dokobit_signature_id"),
  signatureData: jsonb("signature_data"), // Certificate info, timestamp, etc.
  
  // IP tracking for audit
  signedFromIp: text("signed_from_ip"),
  signedUserAgent: text("signed_user_agent"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### Multi-Signer Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ Agreement Status: 1 of 2 signatures                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Provider Side                                                    │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ✓ John Smith, Director                                      │ │
│ │   Signed: April 30, 2026 at 14:32                           │ │
│ │   Via: Smart-ID                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ Client Side                                                      │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ○ Jane Doe, CEO                                   Awaiting  │ │
│ │   Link sent: April 30, 2026 at 14:35                        │ │
│ │   [Copy Link] [Resend] [Remind]                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ○ Mike Finance, CFO                               Optional  │ │
│ │   Not yet invited                                           │ │
│ │   [Invite] [Remove]                                         │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Pre-Signing Flow

### How Pre-Signing Works

```
Sequential Signing Mode (Provider First):

1. Agency creates agreement
2. Agency assigns signers
3. Agency clicks "Sign & Send"
4. Provider completes Dokobit signature
5. System creates partially-signed PDF
6. Client signing link becomes active
7. Client opens link, sees provider signature
8. Client signs their portion
9. Final PDF has both signatures
```

### Dokobit Integration for Sequential Signing

```typescript
class DokobitMultiSignerService {
  async createSigningSession(
    agreement: Agreement,
    signers: AgreementSigner[],
    signingOrder: 'sequential' | 'parallel'
  ): Promise<SigningSession> {
    // Generate PDF with signature placeholders
    const pdfBuffer = await this.generateAgreementPdf(agreement);
    
    // Create Dokobit signing session
    const session = await this.dokobit.createSession({
      document: pdfBuffer,
      documentName: `Agreement-${agreement.id}.pdf`,
      signers: signers.map((s, index) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        // For sequential: assign order; for parallel: all same order
        signingOrder: signingOrder === 'sequential' ? s.signingOrder : 0,
      })),
      // Webhook for status updates
      callbackUrl: `${env.APP_URL}/api/webhooks/dokobit`,
    });
    
    return session;
  }
  
  async processSignerCallback(
    sessionId: string,
    signerId: string,
    status: 'signed' | 'declined',
    signatureData?: SignatureData
  ) {
    const signer = await this.getSignerByDokobitId(signerId);
    
    if (status === 'signed') {
      await this.updateSignerStatus(signer.id, 'signed', signatureData);
      
      // Check if all required signers have signed
      const allSigned = await this.checkAllSignersComplete(signer.agreementId);
      if (allSigned) {
        await this.finalizeAgreement(signer.agreementId);
      } else {
        // Activate next signer in sequence
        await this.activateNextSigner(signer.agreementId);
      }
    } else {
      await this.updateSignerStatus(signer.id, 'declined');
      await this.notifySignerDeclined(signer);
    }
  }
  
  async activateNextSigner(agreementId: string) {
    const nextSigner = await db.query.agreementSigners.findFirst({
      where: and(
        eq(agreementSigners.agreementId, agreementId),
        eq(agreementSigners.status, 'pending'),
      ),
      orderBy: agreementSigners.signingOrder,
    });
    
    if (nextSigner) {
      // Generate unique signing link
      const token = generateSecureToken();
      await db.update(agreementSigners)
        .set({
          accessToken: token,
          tokenExpiresAt: addDays(new Date(), 14),
          status: 'invited',
          invitedAt: new Date(),
        })
        .where(eq(agreementSigners.id, nextSigner.id));
      
      // Return link for manual sending
      return `${env.APP_URL}/c/${token}`;
    }
  }
}
```

---

## Variable System (Shared with Proposals)

### Agreement-Specific Variables

| Category | Examples | Source |
|----------|----------|--------|
| **Client** | `{{client.name}}`, `{{client.companyCode}}`, `{{client.representative}}` | Prospect |
| **Provider** | `{{provider.name}}`, `{{provider.vatNumber}}`, `{{provider.representative}}` | Workspace |
| **Services** | `{{services.list}}`, `{{services.monthly}}`, `{{services.setup}}` | Proposal |
| **Agreement** | `{{agreement.startDate}}`, `{{agreement.endDate}}`, `{{agreement.city}}` | Agreement |
| **Signatures** | `{{signer1.name}}`, `{{signer1.title}}`, `{{signer2.name}}` | Signers |
| **Payment** | `{{payment.terms}}`, `{{payment.dueDate}}`, `{{payment.method}}` | Invoice config |

### Variable Resolution Service

```typescript
class AgreementVariableService {
  async resolveVariables(
    agreementId: string,
    locale: 'en' | 'lt' = 'en'
  ): Promise<Record<string, string>> {
    const agreement = await this.getAgreement(agreementId);
    const proposal = await this.getProposal(agreement.proposalId);
    const prospect = await this.getProspect(proposal.prospectId);
    const workspace = await this.getWorkspace(agreement.workspaceId);
    const services = await this.getProposalServices(proposal.id);
    const signers = await this.getSigners(agreementId);
    
    const providerSigner = signers.find(s => s.role === 'provider');
    const clientSigners = signers.filter(s => s.role === 'client');
    
    return {
      // Client variables
      '{{client.name}}': prospect.companyName,
      '{{client.companyCode}}': prospect.companyCode || this.t('notProvided', locale),
      '{{client.vatNumber}}': prospect.vatNumber || this.t('notProvided', locale),
      '{{client.address}}': prospect.address || this.t('notProvided', locale),
      '{{client.representative}}': clientSigners[0]?.name || prospect.contactName,
      '{{client.representativeTitle}}': clientSigners[0]?.title || this.t('authorizedRep', locale),
      
      // Provider variables
      '{{provider.name}}': workspace.companyName,
      '{{provider.companyCode}}': workspace.companyCode,
      '{{provider.vatNumber}}': workspace.vatNumber,
      '{{provider.address}}': workspace.address,
      '{{provider.representative}}': providerSigner?.name || workspace.ownerName,
      '{{provider.representativeTitle}}': providerSigner?.title || this.t('director', locale),
      '{{provider.email}}': workspace.email,
      '{{provider.phone}}': workspace.phone,
      '{{provider.bankAccount}}': workspace.bankAccount,
      '{{provider.bankName}}': workspace.bankName,
      
      // Service variables
      '{{services.list}}': this.formatServiceList(services, locale),
      '{{services.monthly}}': this.formatCurrency(this.sumMonthly(services), locale),
      '{{services.setup}}': this.formatCurrency(this.sumSetup(services), locale),
      '{{services.total}}': this.formatCurrency(
        this.sumMonthly(services) + this.sumSetup(services),
        locale
      ),
      
      // Agreement variables
      '{{agreement.startDate}}': this.formatDate(agreement.startDate, locale),
      '{{agreement.endDate}}': agreement.endDate 
        ? this.formatDate(agreement.endDate, locale) 
        : this.t('indefinite', locale),
      '{{agreement.duration}}': agreement.durationMonths 
        ? `${agreement.durationMonths} ${this.t('months', locale)}`
        : this.t('indefinite', locale),
      '{{agreement.city}}': agreement.signingCity || workspace.city,
      '{{agreement.date}}': this.formatDate(new Date(), locale),
      
      // Signer variables
      '{{signer1.name}}': providerSigner?.name || '',
      '{{signer1.title}}': providerSigner?.title || '',
      '{{signer2.name}}': clientSigners[0]?.name || '',
      '{{signer2.title}}': clientSigners[0]?.title || '',
      '{{signer3.name}}': clientSigners[1]?.name || '',
      '{{signer3.title}}': clientSigners[1]?.title || '',
      
      // Payment variables
      '{{payment.terms}}': this.formatPaymentTerms(agreement.paymentTerms, locale),
      '{{payment.dueDate}}': `${agreement.paymentDueDays || 14} ${this.t('days', locale)}`,
    };
  }
  
  private t(key: string, locale: 'en' | 'lt'): string {
    const translations: Record<string, Record<'en' | 'lt', string>> = {
      notProvided: { en: 'Not provided', lt: 'Nepateikta' },
      authorizedRep: { en: 'Authorized Representative', lt: 'Įgaliotas atstovas' },
      director: { en: 'Director', lt: 'Direktorius' },
      indefinite: { en: 'Indefinite', lt: 'Neterminuota' },
      months: { en: 'months', lt: 'mėn.' },
      days: { en: 'days', lt: 'd.' },
    };
    return translations[key]?.[locale] || key;
  }
}
```

---

## Client Contract Page (`/c/:token`)

### Page Design

```
┌─────────────────────────────────────────────────────────────────┐
│  [Agency Logo]                              [LT | EN]           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│         SEO PASLAUGŲ SUTARTIS                                   │
│         Tarp TeveroSEO ir UAB Acme                              │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  Progress: ████████░░░░░░░░ 4 of 13 sections                    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 1. ŠALYS                                                   │ │
│  │                                                            │ │
│  │ Ši Sutartis sudaryta tarp:                                 │ │
│  │                                                            │ │
│  │ PASLAUGŲ TEIKĖJAS: UAB TeveroSEO, įmonės kodas            │ │
│  │ 123456789, registruota adresu Pavyzdinė g. 1, Vilnius,    │ │
│  │ atstovaujama direktoriaus Jonas Jonaitis.                  │ │
│  │                                                            │ │
│  │ KLIENTAS: UAB Acme, įmonės kodas 987654321,               │ │
│  │ registruota adresu Kliento g. 5, Vilnius,                 │ │
│  │ atstovaujama direktorės Janina Janinaitė.                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 2. PASLAUGOS                                               │ │
│  │                                                            │ │
│  │ Teikėjas įsipareigoja teikti šias paslaugas:              │ │
│  │                                                            │ │
│  │ • Growth SEO Package (€1,500/mėn.)                        │ │
│  │ • GMB SEO Optimization (€200/mėn.)                        │ │
│  │                                                            │ │
│  │ Pradinė įmoka: €2,500 (vienkartinė)                       │ │
│  │ Mėnesinė įmoka: €1,700                                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ... more sections ...                                           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 13. PARAŠAI                                                │ │
│  │                                                            │ │
│  │ TEIKĖJAS:                          KLIENTAS:              │ │
│  │ ┌──────────────────────┐          ┌──────────────────────┐│ │
│  │ │ ✓ Jonas Jonaitis     │          │ ○ Laukiama parašo   ││ │
│  │ │   Direktorius        │          │                      ││ │
│  │ │   2026-04-30 14:32   │          │                      ││ │
│  │ │   Smart-ID           │          │                      ││ │
│  │ └──────────────────────┘          └──────────────────────┘│ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  ☐ Perskaičiau ir sutinku su šios sutarties sąlygomis    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│      [Pasirašyti su Smart-ID]  [Pasirašyti su Mobile-ID]        │
│                                                                  │
│  Reikia pagalbos? Susisiekite pagalba@teveroseo.com             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Features

1. **Responsive** — Works on mobile (many sign on phone)
2. **Progress indicator** — Shows section progress
3. **Section navigation** — Click TOC to jump
4. **Language toggle** — Switch EN/LT seamlessly
5. **Branded** — Agency logo, colors
6. **Pre-signature visible** — Shows provider signature if pre-signed
7. **Consent checkbox** — Required before signing
8. **Multiple sign methods** — Smart-ID, Mobile-ID, ID card
9. **Success page** — Confirmation with PDF download

### Route Implementation

```typescript
// app/c/[token]/page.tsx
export default async function ContractPage({ 
  params,
  searchParams 
}: { 
  params: { token: string };
  searchParams: { lang?: 'en' | 'lt' };
}) {
  const locale = searchParams.lang || 'lt';
  
  // Get signer by token
  const signer = await getSignerByToken(params.token);
  if (!signer) return <NotFound locale={locale} />;
  
  // Check token expiry
  if (isTokenExpired(signer.tokenExpiresAt)) {
    return <TokenExpired locale={locale} />;
  }
  
  // Get agreement with resolved variables
  const agreement = await getAgreementById(signer.agreementId);
  const variables = await resolveVariables(agreement.id, locale);
  const content = await renderAgreement(agreement, variables, locale);
  
  // Get all signers for status display
  const allSigners = await getSigners(agreement.id);
  
  // Track view
  if (signer.status === 'invited') {
    await updateSignerStatus(signer.id, 'viewed');
  }
  
  // Check if agreement already fully signed
  if (agreement.status === 'signed') {
    return <AlreadySigned agreement={agreement} locale={locale} />;
  }
  
  // Check if this signer already signed
  if (signer.status === 'signed') {
    return <AlreadySignedBySigner signer={signer} locale={locale} />;
  }
  
  // Check if waiting for previous signer (sequential mode)
  const canSign = await canSignerSign(signer, allSigners);
  
  return (
    <ContractViewer 
      agreement={agreement}
      content={content}
      signer={signer}
      allSigners={allSigners}
      canSign={canSign}
      locale={locale}
    />
  );
}
```

---

## Template Editor UI (Drag-and-Drop Variables)

### Template Editor

```
┌─────────────────────────────────────────────────────────────────┐
│ Agreement Template Editor                      [Preview] [Save] │
├────────────────────────────────────┬────────────────────────────┤
│                                    │ Variables              [⌕] │
│ ⋮⋮ 1. PARTIES                      │ ─────────────────────────  │
│                                    │                            │
│ This Agreement is entered into     │ 📋 Client                  │
│ between:                           │ ├─ [client.name]          │
│                                    │ ├─ [client.companyCode]   │
│ PROVIDER: [provider.name],         │ └─ [client.representative]│
│ company code [provider.companyCode]│                            │
│ ...                                │ 🏢 Provider               │
│                                    │ ├─ [provider.name]        │
│ CLIENT: [client.name],             │ ├─ [provider.companyCode] │
│ company code [client.companyCode]  │ └─ [provider.representative│
│ ...                                │                            │
│                                    │ 💰 Services               │
│ ⋮⋮ 2. SERVICES                     │ ├─ [services.list]        │
│                                    │ ├─ [services.monthly]     │
│ Provider agrees to deliver:        │ └─ [services.setup]       │
│ [services.list]                    │                            │
│                                    │ 📅 Agreement              │
│ Monthly fee: [services.monthly]    │ ├─ [agreement.startDate]  │
│ Setup fee: [services.setup]        │ ├─ [agreement.endDate]    │
│                                    │ └─ [agreement.city]       │
│ [+ Add Clause]                     │                            │
│                                    │ ✍️ Signatures              │
│ ⋮⋮ 3. PAYMENT TERMS                │ ├─ [signer1.name]         │
│ ...                                │ ├─ [signer1.title]        │
│                                    │ ├─ [signer2.name]         │
│                                    │ └─ [signer2.title]        │
└────────────────────────────────────┴────────────────────────────┘
```

### Signature Configuration

```
┌─────────────────────────────────────────────────────────────────┐
│ Signature Requirements                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Provider Signatures                                              │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ☑ Provider Representative                         Required │ │
│ │   Default title (EN): [Director                       ]    │ │
│ │   Default title (LT): [Direktorius                    ]    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ Client Signatures                                                │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ☑ Primary Client Signer                           Required │ │
│ │   Default title (EN): [Authorized Representative      ]    │ │
│ │   Default title (LT): [Įgaliotas atstovas             ]    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ☐ Secondary Client Signer                          Optional│ │
│ │   Default title (EN): [CFO                            ]    │ │
│ │   Default title (LT): [Finansų direktorius            ]    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ [+ Add Signer Requirement]                                      │
│                                                                  │
│ ─────────────────────────────────────────────────────────────── │
│                                                                  │
│ Signing Order                                                    │
│ ● Sequential (Provider signs first, then Client)                │
│ ○ Parallel (Any order)                                          │
│                                                                  │
│ ☑ Enable pre-signing (Provider signs before sending to client) │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Agreement Creation Flow

### Create Agreement Modal

```
┌─────────────────────────────────────────────────────────────────┐
│ Create Agreement                                           [×]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Template                                                         │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Standard SEO Service Agreement                         ▾   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ─────────────────────────────────────────────────────────────── │
│                                                                  │
│ Agreement Details                                                │
│                                                                  │
│ Start Date      [May 1, 2026                              📅]  │
│ Duration        [12 months                                 ▾]  │
│ Signing City    [Vilnius                                    ]  │
│                                                                  │
│ ─────────────────────────────────────────────────────────────── │
│                                                                  │
│ Signers                                                          │
│                                                                  │
│ Provider (You)                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Name:  [John Smith                                    ]    │ │
│ │ Title: [Director                                      ]    │ │
│ │ Email: [john@teveroseo.com                            ]    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ Client                                                           │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Name:  [Jane Doe                                      ]    │ │
│ │ Title: [CEO                                           ]    │ │
│ │ Email: [jane@acme.com                                 ]    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ [+ Add Another Client Signer]                                   │
│                                                                  │
│ ─────────────────────────────────────────────────────────────── │
│                                                                  │
│ Signing Options                                                  │
│ ● Sign now as provider, then send to client (Recommended)       │
│ ○ Send to all parties for parallel signing                      │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                    [Cancel]  [Preview]  [Create & Sign →]        │
└─────────────────────────────────────────────────────────────────┘
```

---

## PDF Generation

### Professional PDF with Branding

```typescript
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

class AgreementPdfService {
  async generatePdf(
    agreement: Agreement,
    variables: Record<string, string>,
    locale: 'en' | 'lt',
    options: {
      includeSignatures?: boolean;
      signers?: AgreementSigner[];
    } = {}
  ): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    
    // Embed custom fonts
    const regularFontBytes = await fs.readFile('./fonts/Inter-Regular.ttf');
    const boldFontBytes = await fs.readFile('./fonts/Inter-Bold.ttf');
    const regularFont = await pdfDoc.embedFont(regularFontBytes);
    const boldFont = await pdfDoc.embedFont(boldFontBytes);
    
    // Get branding
    const workspace = await this.getWorkspace(agreement.workspaceId);
    const logo = workspace.logoUrl 
      ? await pdfDoc.embedPng(await fetchBuffer(workspace.logoUrl))
      : null;
    
    // Get template and clauses
    const template = await this.getTemplate(agreement.templateId);
    const clauses = await this.getClauses(template.id);
    
    // Render each clause
    let currentPage = pdfDoc.addPage([595, 842]); // A4
    let yPosition = 800;
    
    // Header with logo
    if (logo) {
      currentPage.drawImage(logo, { x: 50, y: 770, width: 100, height: 30 });
    }
    
    // Title
    const title = locale === 'lt' ? template.titleLt : template.titleEn;
    currentPage.drawText(title || template.title, {
      x: 50,
      y: 740,
      size: 18,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    
    yPosition = 710;
    
    // Render clauses
    for (const clause of clauses) {
      const content = this.resolveVariables(
        locale === 'lt' ? clause.contentLt : clause.contentEn || clause.content,
        variables
      );
      
      // Check if need new page
      const textHeight = this.calculateTextHeight(content, regularFont, 11, 495);
      if (yPosition - textHeight < 50) {
        currentPage = pdfDoc.addPage([595, 842]);
        yPosition = 800;
      }
      
      // Clause title
      const clauseTitle = locale === 'lt' ? clause.titleLt : clause.titleEn || clause.title;
      currentPage.drawText(clauseTitle, {
        x: 50,
        y: yPosition,
        size: 12,
        font: boldFont,
      });
      yPosition -= 20;
      
      // Clause content
      yPosition = this.drawWrappedText(currentPage, content, {
        x: 50,
        y: yPosition,
        maxWidth: 495,
        font: regularFont,
        size: 11,
        lineHeight: 16,
      });
      
      yPosition -= 20;
    }
    
    // Signature section
    if (options.includeSignatures && options.signers) {
      yPosition = this.renderSignatureSection(
        currentPage,
        yPosition,
        options.signers,
        boldFont,
        regularFont,
        locale
      );
    }
    
    // Footer with page numbers
    const pages = pdfDoc.getPages();
    pages.forEach((page, index) => {
      page.drawText(`${index + 1} / ${pages.length}`, {
        x: 280,
        y: 20,
        size: 9,
        font: regularFont,
        color: rgb(0.5, 0.5, 0.5),
      });
    });
    
    return Buffer.from(await pdfDoc.save());
  }
}
```

---

## Success Page

```
┌─────────────────────────────────────────────────────────────────┐
│  [Agency Logo]                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                          ✓                                       │
│                                                                  │
│              Sutartis sėkmingai pasirašyta!                     │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  Sutarties numeris: AGR-2026-0042                               │
│  Pasirašyta: 2026-04-30 15:45                                   │
│  Pasirašymo būdas: Smart-ID                                     │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│                    [📄 Atsisiųsti PDF]                          │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  Kas toliau?                                                     │
│                                                                  │
│  1. Gausite patvirtinimą el. paštu su sutarties kopija         │
│  2. Mūsų komanda susisieks su jumis per 24 valandas            │
│  3. Pradėsime SEO darbų planavimą                               │
│                                                                  │
│  Turite klausimų? Susisiekite pagalba@teveroseo.com            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## i18n Implementation

### Translation Files

```typescript
// locales/en/agreement.json
{
  "viewer": {
    "title": "Service Agreement",
    "progress": "{{current}} of {{total}} sections",
    "consent": "I have read and agree to the terms of this agreement",
    "signWithSmartId": "Sign with Smart-ID",
    "signWithMobileId": "Sign with Mobile-ID",
    "signWithIdCard": "Sign with ID Card",
    "waitingForPreviousSigner": "Waiting for {{name}} to sign first",
    "alreadySigned": "You have already signed this agreement",
    "agreementFullySigned": "This agreement has been fully executed",
    "needHelp": "Need help? Contact {{email}}"
  },
  "success": {
    "title": "Agreement Successfully Signed!",
    "agreementNumber": "Agreement number",
    "signedAt": "Signed",
    "signedVia": "Signed via",
    "downloadPdf": "Download PDF",
    "whatsNext": "What's next?",
    "steps": {
      "confirmation": "You'll receive a confirmation email with the agreement copy",
      "contact": "Our team will contact you within 24 hours",
      "planning": "We'll begin SEO work planning"
    }
  },
  "status": {
    "pending": "Pending",
    "invited": "Invited",
    "viewed": "Viewed",
    "signing": "Signing",
    "signed": "Signed",
    "declined": "Declined"
  }
}

// locales/lt/agreement.json
{
  "viewer": {
    "title": "Paslaugų sutartis",
    "progress": "{{current}} iš {{total}} skyrių",
    "consent": "Perskaičiau ir sutinku su šios sutarties sąlygomis",
    "signWithSmartId": "Pasirašyti su Smart-ID",
    "signWithMobileId": "Pasirašyti su Mobile-ID",
    "signWithIdCard": "Pasirašyti su tapatybės kortele",
    "waitingForPreviousSigner": "Laukiama {{name}} parašo",
    "alreadySigned": "Jūs jau pasirašėte šią sutartį",
    "agreementFullySigned": "Ši sutartis jau pilnai įvykdyta",
    "needHelp": "Reikia pagalbos? Susisiekite {{email}}"
  },
  "success": {
    "title": "Sutartis sėkmingai pasirašyta!",
    "agreementNumber": "Sutarties numeris",
    "signedAt": "Pasirašyta",
    "signedVia": "Pasirašymo būdas",
    "downloadPdf": "Atsisiųsti PDF",
    "whatsNext": "Kas toliau?",
    "steps": {
      "confirmation": "Gausite patvirtinimą el. paštu su sutarties kopija",
      "contact": "Mūsų komanda susisieks su jumis per 24 valandas",
      "planning": "Pradėsime SEO darbų planavimą"
    }
  },
  "status": {
    "pending": "Laukiama",
    "invited": "Pakviesta",
    "viewed": "Peržiūrėta",
    "signing": "Pasirašoma",
    "signed": "Pasirašyta",
    "declined": "Atmesta"
  }
}
```

---

## API Endpoints

```
# Templates
GET    /api/templates/agreements              # List agreement templates
GET    /api/templates/agreements/:id          # Get template details
POST   /api/templates/agreements              # Create template
PUT    /api/templates/agreements/:id          # Update template
DELETE /api/templates/agreements/:id          # Delete template

# Agreement CRUD
GET    /api/agreements                        # List agreements
GET    /api/agreements/:id                    # Get agreement details
POST   /api/agreements                        # Create agreement
PUT    /api/agreements/:id                    # Update agreement
DELETE /api/agreements/:id                    # Delete agreement

# Signers
GET    /api/agreements/:id/signers            # List signers
POST   /api/agreements/:id/signers            # Add signer
PUT    /api/agreements/:id/signers/:sid       # Update signer
DELETE /api/agreements/:id/signers/:sid       # Remove signer
POST   /api/agreements/:id/signers/:sid/invite # Send invite (generate link)
POST   /api/agreements/:id/signers/:sid/remind # Send reminder

# Signing flow
POST   /api/agreements/:id/sign/init          # Initialize provider signing
GET    /api/agreements/:id/sign/status        # Check signing status
POST   /api/webhooks/dokobit                  # Dokobit callback

# Public client routes (no auth)
GET    /api/contracts/:token                  # Get contract for viewing
GET    /api/contracts/:token/status           # Check signing status
POST   /api/contracts/:token/sign/init        # Initialize client signing
GET    /api/contracts/:token/pdf              # Download PDF

# Preview
POST   /api/agreements/:id/preview            # Generate preview
GET    /api/agreements/:id/pdf                # Download PDF
```

---

## Success Criteria

1. Template selector shown when creating agreement
2. Drag-and-drop variables into template content
3. Configure 1-3 signers with roles
4. Sequential signing (provider first) works
5. Pre-signing flow completes successfully
6. `/c/:token` route renders agreement beautifully
7. Progress indicator shows section completion
8. Language toggle switches EN/LT seamlessly
9. Consent checkbox required before signing
10. Dokobit signing completes (Smart-ID, Mobile-ID)
11. Success page shows with PDF download
12. PDF has professional formatting with logo
13. Multi-signer status tracking works
14. All UI available in English and Lithuanian

---

## Plans

| Plan | Focus | Wave |
|------|-------|------|
| 59-01 | Schema + Template System + i18n | 1 |
| 59-02 | Multi-Signer Architecture + Dokobit | 1 |
| 59-03 | Variable Resolution Service | 2 |
| 59-04 | Client Contract Page `/c/:token` | 2 |
| 59-05 | Template Editor + Variable Drag-Drop | 3 |
| 59-06 | Pre-Signing Flow | 3 |
| 59-07 | PDF Generation + Branding | 4 |
| 59-08 | Success Page + Status Tracking | 4 |

---

## Out of Scope

- Automated email sending (manual via magic link)
- Contract amendments/addendums (separate document)
- E-signature audit trail UI (data exists, no UI yet)
- Witness signatures
- Notarization integration
