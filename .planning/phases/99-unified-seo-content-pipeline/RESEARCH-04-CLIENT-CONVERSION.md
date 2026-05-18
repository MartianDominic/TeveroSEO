# Research 04: Prospect to Client Conversion Flow

> **Phase 99**: Unified SEO Content Pipeline
> **Research Date**: 2026-05-11
> **Status**: Complete

---

## Executive Summary

When a prospect signs an agreement, they become a client. This document details the data migration, trigger mechanisms, GSC/GA4 connection flow, content calendar seeding, and v6 UI design for the conversion confirmation screen.

---

## 1. Data Migration Schema

### 1.1 What Moves from Prospect to Client

| Source Table | Source Field | Target Table | Target Field | Notes |
|--------------|--------------|--------------|--------------|-------|
| `prospects` | `domain` | `shared_clients` | `domain` | Direct copy |
| `prospects` | `company_name` | `shared_clients` | `name` | Required field |
| `prospects` | `contact_email` | `shared_clients` | `contact_email` | Direct copy |
| `prospects` | `contact_name` | `shared_clients` | `contact_name` | Direct copy |
| `prospects` | `industry` | `shared_clients` | `industry` | Direct copy |
| `prospects` | `preferred_language` | `shared_clients` | `preferred_language` | Direct copy |
| `prospects` | `country` | `shared_clients` | `country` | ISO 3166-1 alpha-2 |
| `prospect_analyses` | `domain_metrics` | `shared_clients` | `baseline_metrics` | Transform to BaselineMetrics |
| `prospect_keywords` | (aggregated) | `shared_clients` | `target_keywords` | Top-tier keywords as string[] |
| `proposals` | `clusters` | (new table) | `client_keywords` | Full keyword data with clusters |

### 1.2 Voice Profile Migration

| Source | Target | Notes |
|--------|--------|-------|
| `proposals.content.hero` | `shared_voice_profiles.brand_voice_description` | Extract brand positioning |
| `prospect_analyses.scraped_content.business_info` | `shared_voice_profiles.industry_template` | Industry context |
| (AI extraction during conversion) | `shared_voice_profiles.*` | Generate draft voice profile |

### 1.3 Platform Connections Migration

```
platform_connections (prospect-level)
         |
         v
platform_connections (client-level)
  - prospectId -> NULL
  - clientId -> new_client.id (new FK to add)
```

**Key Point**: Platform connections currently reference `prospectId`. Post-conversion, the connection should reference the client instead. Add `clientId` FK to `platform_connections` schema.

---

## 2. Conversion Trigger: Agreement Signed

### 2.1 State Machine

```
PROSPECT PIPELINE STAGES:
new -> analyzing -> scored -> qualified -> contacted -> negotiating -> converted -> archived

PROPOSAL STATUS:
draft -> sent -> viewed -> accepted -> signed -> paid -> onboarded
                                         ^
                                         |
                               CONVERSION TRIGGER
```

### 2.2 Trigger Sequence

```typescript
// Triggered when all signers complete signing (agreementSigners.status = 'signed')
async function onAgreementFullySigned(agreementId: string): Promise<void> {
  // 1. Get proposal from agreement
  const agreement = await getAgreementWithProposal(agreementId);
  const proposal = agreement.proposal;
  
  // 2. Update proposal status
  await updateProposalStatus(proposal.id, 'signed');
  
  // 3. Check if payment required or auto-convert
  if (proposal.setupFeeCents > 0) {
    // Wait for payment webhook
    await initiateStripeCheckout(proposal);
  } else {
    // Free tier / prepaid - convert immediately
    await convertProspectToClient(proposal);
  }
}

// Triggered by Stripe webhook or immediate conversion
async function convertProspectToClient(proposal: Proposal): Promise<Client> {
  return db.transaction(async (tx) => {
    // 1. Create client record
    const client = await createClientFromProspect(tx, proposal);
    
    // 2. Migrate keywords with clusters
    await migrateKeywordsToClient(tx, proposal, client.id);
    
    // 3. Generate draft voice profile
    await createDraftVoiceProfile(tx, proposal, client.id);
    
    // 4. Migrate platform connections
    await migratePlatformConnections(tx, proposal.prospectId, client.id);
    
    // 5. Update prospect status
    await updateProspectStatus(tx, proposal.prospectId, 'converted', client.id);
    
    // 6. Update proposal status
    await updateProposalStatus(tx, proposal.id, 'onboarded');
    
    // 7. Trigger onboarding emails
    await queueOnboardingEmails(client);
    
    // 8. Log activity
    await logActivity(tx, 'prospect_converted', { prospectId, clientId: client.id });
    
    return client;
  });
}
```

### 2.3 API Endpoints

```
POST /api/agreements/:agreementId/complete-signing
  - Called by Dokobit webhook when signature complete
  - Checks if all required signers have signed
  - Triggers conversion flow

POST /api/proposals/:proposalId/convert
  - Manual conversion (admin override)
  - Skips payment if authorized

POST /api/stripe/webhook
  - payment_intent.succeeded event
  - Triggers conversion for paid proposals
```

---

## 3. GSC/GA4 Connection Flow Post-Conversion

### 3.1 Connection Options

```
                          CLIENT CREATED
                               |
              +----------------+----------------+
              |                                 |
    PROSPECT HAD CONNECTION            NO PRIOR CONNECTION
              |                                 |
    Migrate connection to client      Send GSC Invite Email
              |                                 |
    Status: active                    Client clicks link
              |                                 |
              +----------------+----------------+
                               |
                        CLIENT DASHBOARD
                               |
                    +---------+---------+
                    |                   |
              GSC Connected        GA4 Connected
                    |                   |
              Schedule sync       Schedule sync
```

### 3.2 GSC Invite Email Flow

```typescript
// Called during onboarding if no GSC connection exists
async function sendGscInviteEmail(client: Client): Promise<void> {
  const connectUrl = generateOAuthUrl({
    platform: 'google_search_console',
    clientId: client.id,
    redirectUri: `${APP_URL}/api/oauth/gsc/callback`,
    state: encodeState({ clientId: client.id, action: 'connect' }),
  });
  
  await emailService.send({
    to: client.contactEmail,
    template: 'gsc-invite',
    data: {
      clientName: client.contactName,
      domain: client.domain,
      connectUrl,
    },
  });
}
```

### 3.3 Property Selection Modal

After OAuth callback, user selects which GSC/GA4 property to connect:

```
+----------------------------------------------------------+
|  Select Google Search Console Property                   |
+----------------------------------------------------------+
|                                                          |
|  We found 3 properties in your account:                  |
|                                                          |
|  ( ) sc-domain:example.com          [Recommended]        |
|      Domain property - tracks all subdomains             |
|                                                          |
|  ( ) https://example.com/                                |
|      URL prefix - exact match only                       |
|                                                          |
|  ( ) https://www.example.com/                            |
|      URL prefix - www subdomain                          |
|                                                          |
|  [Cancel]                              [Connect Property]|
+----------------------------------------------------------+
```

---

## 4. Content Calendar Seeding from Proposal Keywords

### 4.1 Keyword Cluster to Calendar Mapping

```typescript
interface CalendarSeed {
  clientId: string;
  keywords: Array<{
    keyword: string;
    cluster: string;
    funnelStage: 'tofu' | 'mofu' | 'bofu';
    priority: number;
    suggestedPublishWeek: number; // Week offset from start
  }>;
}

async function seedContentCalendar(
  clientId: string,
  proposal: Proposal
): Promise<CalendarSeed> {
  const clusters = proposal.clusters || [];
  const distribution = proposal.distribution || { bofu: 0.3, mofu: 0.4, tofu: 0.3 };
  
  // Sort clusters by priority (BOFU first for quick revenue)
  const prioritizedKeywords = clusters
    .flatMap(cluster => cluster.keywords.map(kw => ({
      ...kw,
      cluster: cluster.label,
      funnelStage: cluster.funnelStage,
    })))
    .sort((a, b) => {
      // BOFU > MOFU > TOFU
      const stageOrder = { bofu: 0, mofu: 1, tofu: 2 };
      return stageOrder[a.funnelStage] - stageOrder[b.funnelStage];
    });
  
  // Assign publish weeks (4 articles/week cadence)
  const ARTICLES_PER_WEEK = 4;
  const calendarItems = prioritizedKeywords.map((kw, index) => ({
    keyword: kw.keyword,
    cluster: kw.cluster,
    funnelStage: kw.funnelStage,
    priority: kw.priority || index + 1,
    suggestedPublishWeek: Math.floor(index / ARTICLES_PER_WEEK) + 1,
  }));
  
  return {
    clientId,
    keywords: calendarItems,
  };
}
```

### 4.2 Calendar Integration

```
PROPOSAL CLUSTERS                    CONTENT CALENDAR
+------------------+                 +------------------+
| BOFU Cluster 1   |                 | Week 1           |
|  - keyword A     | ─────────────>  |  - keyword A     |
|  - keyword B     |                 |  - keyword B     |
+------------------+                 |  - keyword C     |
| MOFU Cluster 1   |                 |  - keyword D     |
|  - keyword C     | ─────────────>  +------------------+
|  - keyword D     |                 | Week 2           |
+------------------+                 |  - keyword E     |
| TOFU Cluster 1   |                 |  - keyword F     |
|  - keyword E     | ─────────────>  |  ...             |
+------------------+                 +------------------+
```

---

## 5. Conversion Confirmation Screen (v6 Design)

### 5.1 Design System Components Used

From `design-system-v6.md`:
- **Card Primitive** (section 4) - Glass effect cards
- **Button System** (section 5) - Primary/Secondary actions
- **KPI Numeral** (section 7.2) - Progress indicators
- **Pipeline Stages** (section 14.5) - Onboarding progress

### 5.2 ASCII Wireframe - Conversion Confirmation Modal

```
+------------------------------------------------------------------+
|                                                              [X] |
|                                                                  |
|                      [checkmark icon]                            |
|                                                                  |
|              Welcome to TeveroSEO, Acme Corp!                    |
|                                                                  |
|    Your agreement has been signed and payment received.          |
|    Let's get your SEO campaign started.                          |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  WHAT'S BEEN SET UP                                              |
|  ─────────────────────────────────────────────────────────────   |
|                                                                  |
|  +------------------+  +------------------+  +------------------+ |
|  |      127         |  |     Draft        |  |    Pending       | |
|  |    Keywords      |  |  Voice Profile   |  |  GSC Connect     | |
|  |    imported      |  |    created       |  |                  | |
|  +------------------+  +------------------+  +------------------+ |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  NEXT STEPS                                                      |
|  ─────────────────────────────────────────────────────────────   |
|                                                                  |
|  [1]──────[2]──────[3]──────[4]──────[5]                        |
|   GSC      Voice    First    Review   Go                        |
|  Connect   Setup   Article   & Tune   Live                      |
|    ●         ○        ○        ○       ○                        |
|                                                                  |
|  Step 1: Connect Google Search Console                           |
|                                                                  |
|  We've sent an invite to john@acme.com. Click the link to        |
|  authorize access, or connect now:                               |
|                                                                  |
|  [Connect GSC]  [Skip for now]                                   |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|           [Go to Dashboard]                                      |
|                                                                  |
+------------------------------------------------------------------+
```

### 5.3 State Variations

**Variation A: GSC Already Connected (from prospect)**
```
  +------------------+
  |     Active       |
  |  GSC Connected   |
  |   example.com    |
  +------------------+
```

**Variation B: Payment Pending**
```
+------------------------------------------------------------------+
|                      [clock icon]                                |
|                                                                  |
|              Almost there, Acme Corp!                            |
|                                                                  |
|    Your agreement has been signed. Complete payment to           |
|    activate your SEO campaign.                                   |
|                                                                  |
|  [Complete Payment - EUR 499]                                    |
+------------------------------------------------------------------+
```

### 5.4 Responsive Behavior

```
DESKTOP (>1024px)           TABLET (768-1024px)        MOBILE (<768px)
+------------------+        +------------------+       +---------------+
| [X]              |        | [X]              |       | [X]           |
|                  |        |                  |       |               |
| [check]          |        | [check]          |       | [check]       |
|                  |        |                  |       |               |
| Welcome...       |        | Welcome...       |       | Welcome...    |
|                  |        |                  |       |               |
| [127] [Voice]    |        | [127] [Voice]    |       | [127]         |
|       [GSC]      |        |       [GSC]      |       | [Voice]       |
|                  |        |                  |       | [GSC]         |
| [1]-[2]-[3]-[4]  |        | [1]-[2]-[3]-[4]  |       | [1]           |
|                  |        |                  |       | [2]           |
| [Connect GSC]    |        | [Connect GSC]    |       | [3]           |
+------------------+        +------------------+       +---------------+
```

---

## 6. Database Schema Changes Required

### 6.1 New FK: platform_connections.clientId

```sql
-- Migration: add_client_id_to_platform_connections.sql
ALTER TABLE platform_connections
ADD COLUMN client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX idx_platform_connections_client ON platform_connections(client_id);
```

### 6.2 New Table: client_keywords (migrated from prospect)

```typescript
export const clientKeywords = pgTable(
  "client_keywords",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => sharedClients.id, { onDelete: "cascade" }),
    
    // Keyword data (from prospect_keywords)
    keyword: text("keyword").notNull(),
    normalizedKeyword: text("normalized_keyword").notNull(),
    searchVolume: integer("search_volume"),
    keywordDifficulty: real("keyword_difficulty"),
    cpc: real("cpc"),
    
    // Cluster assignment (from proposal)
    clusterLabel: text("cluster_label"),
    funnelStage: text("funnel_stage"), // tofu | mofu | bofu
    
    // Calendar assignment
    calendarWeek: integer("calendar_week"),
    articleId: uuid("article_id"), // FK to articles when created
    
    // Status
    status: text("status").default("pending"), // pending | scheduled | published
    
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("ix_client_keywords_client").on(table.clientId),
    index("ix_client_keywords_cluster").on(table.clusterLabel),
    index("ix_client_keywords_status").on(table.status),
    uniqueIndex("ix_client_keywords_unique").on(table.clientId, table.normalizedKeyword),
  ]
);
```

---

## 7. API Endpoints Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/agreements/:id/complete-signing` | Dokobit webhook handler |
| POST | `/api/proposals/:id/convert` | Manual conversion trigger |
| POST | `/api/stripe/webhook` | Payment completion handler |
| GET | `/api/clients/:id/onboarding-status` | Check onboarding progress |
| POST | `/api/clients/:id/connect-gsc` | Initiate GSC OAuth |
| POST | `/api/oauth/gsc/callback` | GSC OAuth callback |
| GET | `/api/clients/:id/calendar` | Get seeded content calendar |

---

## 8. Event Flow Diagram

```
                    AGREEMENT SIGNED
                          |
                          v
              +------------------------+
              | Dokobit Webhook        |
              | POST /complete-signing |
              +------------------------+
                          |
                          v
              +------------------------+
              | Check all signers      |
              | signed?                |
              +------------------------+
                    |           |
                   YES          NO
                    |           |
                    v           v
              Update proposal   Wait for
              status='signed'   remaining signers
                    |
                    v
              +------------------------+
              | Payment required?      |
              +------------------------+
                    |           |
                   YES          NO
                    |           |
                    v           v
              Stripe Checkout   Direct conversion
                    |                  |
                    v                  |
              +------------------------+
              | Stripe Webhook        |
              | payment_intent.ok     |
              +------------------------+
                          |
                          v
              +------------------------+
              | convertProspectToClient|
              | (Transaction)          |
              +------------------------+
                          |
          +---------------+---------------+
          |               |               |
          v               v               v
    Create client   Migrate KWs    Create voice
          |               |          profile
          |               |               |
          +---------------+---------------+
                          |
                          v
              +------------------------+
              | Queue onboarding       |
              | - GSC invite email     |
              | - Kickoff scheduling   |
              | - Welcome email        |
              +------------------------+
                          |
                          v
              +------------------------+
              | Log activity           |
              | 'prospect_converted'   |
              +------------------------+
                          |
                          v
                  CONVERSION COMPLETE
                  Show confirmation modal
```

---

## 9. Implementation Checklist

- [ ] Add `client_id` FK to `platform_connections` schema
- [ ] Create `client_keywords` table schema
- [ ] Implement `convertProspectToClient` transaction function
- [ ] Implement `migrateKeywordsToClient` function
- [ ] Implement `createDraftVoiceProfile` function  
- [ ] Implement `migratePlatformConnections` function
- [ ] Implement `seedContentCalendar` function
- [ ] Create Dokobit webhook handler
- [ ] Create Stripe webhook handler for payment completion
- [ ] Build ConversionConfirmationModal component (v6 design)
- [ ] Build PropertySelectionModal component (v6 design)
- [ ] Add E2E tests for full conversion flow
- [ ] Add unit tests for each migration function

---

## References

- `open-seo-main/src/db/prospect-schema.ts` - Prospect data model
- `open-seo-main/src/db/client-schema.ts` - Client data model
- `open-seo-main/src/db/proposal-schema.ts` - Proposal with clusters
- `open-seo-main/src/db/schema/shared-clients.ts` - Unified client schema
- `open-seo-main/src/db/schema/shared-voice-profiles.ts` - Voice profile schema
- `open-seo-main/src/db/platform-connection-schema.ts` - OAuth connections
- `open-seo-main/src/db/schema/agreement-signers-schema.ts` - Signing flow
- `.planning/design/v7-master-design-architecture.md` - Pattern D: Prospect to Client
- `.planning/design/design-system-v6.md` - UI component specs
