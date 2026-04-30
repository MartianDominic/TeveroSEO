# Phase 59: Agreement & Signing Excellence

**Goal:** Create a 3-click signing experience with client contract viewing page and polished UX

**Depends on:** Phase 58 (service catalog complete)

**Estimated effort:** 45-55 hours

---

## Problem Statement

Critical gaps in the agreement flow:

1. **No client contract page** — `/c/:token` does not exist, clients cannot view contracts
2. **Email not wired up** — contracts cannot be delivered (using magic link instead)
3. **Hardcoded variables** — contracts have placeholder data, not real client info
4. **No preview** — agencies cannot see what they're sending
5. **8+ clicks to sign** — far from the target of 3 clicks
6. **Basic PDF** — Helvetica font, no branded polish

---

## User Journeys

### Agency Journey (Creating & Sending Agreement)

```
1. Proposal accepted → "Create Agreement" button appears
2. Click "Create Agreement"
3. Preview modal shows full agreement with real data
4. Optional: Click any clause to customize/edit
5. Click "Generate Link"
6. Copy magic link, send manually (email, WhatsApp, etc.)
7. Track: "Viewed" → "Signed" status in dashboard
```

### Client Journey (Viewing & Signing)

```
1. Receive magic link from agency
2. Click link → Opens /c/:token
3. See professional, branded agreement page
4. Scroll through sections (progress indicator)
5. Click "Sign with Smart-ID" (or Mobile-ID)
6. Authenticate (Dokobit redirect or inline)
7. Success page with PDF download
```

**Target: 3 clicks from link to signed**
1. Open link (auto)
2. Scroll and review
3. Click "Sign"

---

## Client Contract Page (`/c/:token`)

### Design

```
┌─────────────────────────────────────────────────────────────────┐
│  [Agency Logo]                              [LT | EN]           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│         SEO SERVICES AGREEMENT                                   │
│         Between TeveroSEO and Acme Corporation                   │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  Progress: ████████░░░░░░░░ 4 of 13 sections                    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 1. PARTIES                                                 │ │
│  │                                                            │ │
│  │ This Agreement is entered into between:                    │ │
│  │                                                            │ │
│  │ PROVIDER: UAB TeveroSEO, company code 123456789,          │ │
│  │ registered at Example Street 1, Vilnius, Lithuania,       │ │
│  │ represented by John Smith, acting as Director.            │ │
│  │                                                            │ │
│  │ CLIENT: Acme Corporation, company code 987654321,         │ │
│  │ registered at Client Street 5, Vilnius, Lithuania,        │ │
│  │ represented by Jane Doe, acting as CEO.                   │ │
│  │                                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 2. SERVICES                                                │ │
│  │                                                            │ │
│  │ Provider agrees to deliver the following services:         │ │
│  │                                                            │ │
│  │ • Growth SEO Package (€1,500/month)                       │ │
│  │ • GMB SEO Optimization (€200/month)                       │ │
│  │                                                            │ │
│  │ Setup fee: €2,500 (one-time)                              │ │
│  │ Monthly fee: €1,700                                        │ │
│  │                                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ... more sections ...                                           │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  ☐ I have read and agree to the terms of this agreement   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│                [Sign with Smart-ID]  [Sign with Mobile-ID]       │
│                                                                  │
│  Need help? Contact support@teveroseo.com                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Features

1. **Responsive** — Works on mobile (many clients sign on phone)
2. **Progress indicator** — Shows section progress
3. **Section navigation** — Click TOC to jump
4. **Language toggle** — Switch EN/LT
5. **Branded** — Agency logo, colors
6. **Consent checkbox** — Required before signing
7. **Multiple sign methods** — Smart-ID, Mobile-ID, ID card
8. **Success page** — Confirmation with PDF download

---

## Variable Resolution

### Data Sources

```typescript
interface VariableContext {
  // From prospect/client
  client: {
    name: string;
    companyCode: string;
    address: string;
    representative: string;
    representativeTitle: string;
    email: string;
  };
  
  // From workspace settings
  provider: {
    name: string;
    companyCode: string;
    address: string;
    representative: string;
    representativeTitle: string;
  };
  
  // From proposal
  services: {
    name: string;
    price: number;
    setupFee: number;
  }[];
  
  // Calculated
  totals: {
    monthlyTotal: number;
    setupTotal: number;
    firstMonthTotal: number;
  };
  
  // From agreement
  agreement: {
    startDate: Date;
    endDate: Date;
    city: string;
  };
}
```

### Variable Resolution Service

```typescript
class VariableResolutionService {
  async resolveVariables(
    agreementId: string
  ): Promise<Record<string, string>> {
    const agreement = await this.getAgreement(agreementId);
    const proposal = await this.getProposal(agreement.proposalId);
    const prospect = await this.getProspect(proposal.prospectId);
    const workspace = await this.getWorkspace(agreement.workspaceId);
    
    return {
      '{{clientName}}': prospect.companyName,
      '{{clientCode}}': prospect.companyCode || 'N/A',
      '{{clientAddress}}': prospect.address || 'N/A',
      '{{clientRepresentative}}': prospect.contactName,
      '{{clientRepresentativeTitle}}': prospect.contactTitle || 'Director',
      '{{providerName}}': workspace.companyName,
      '{{providerCode}}': workspace.companyCode,
      '{{providerAddress}}': workspace.address,
      '{{providerRepresentative}}': workspace.ownerName,
      '{{startDate}}': this.formatDate(agreement.startDate),
      '{{monthlyFee}}': this.formatCurrency(proposal.monthlyFeeCents),
      '{{setupFee}}': this.formatCurrency(proposal.setupFeeCents),
      // ... etc
    };
  }
}
```

---

## Preview Modal (Agency Side)

```
┌─────────────────────────────────────────────────────────────────┐
│ Agreement Preview                                          [×]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Desktop] [Mobile] preview toggle                              │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                                                            │ │
│  │  (Live preview of what client will see)                   │ │
│  │                                                            │ │
│  │  ... rendered agreement content ...                        │ │
│  │                                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Customizations:                                                 │
│  ☐ Add confidentiality clause                                   │
│  ☐ Add non-compete clause                                       │
│  ☐ Add data processing agreement reference                      │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                         [Cancel]  [Generate Magic Link]         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technical Implementation

### Routes

```typescript
// Client-facing contract page
// apps/web/src/app/c/[token]/page.tsx
export default async function ContractPage({ params }: { params: { token: string } }) {
  const agreement = await getAgreementByToken(params.token);
  if (!agreement) return <NotFound />;
  if (agreement.status === 'signed') return <AlreadySigned agreement={agreement} />;
  if (isExpired(agreement)) return <Expired />;
  
  return <ContractViewer agreement={agreement} />;
}

// Success page after signing
// apps/web/src/app/c/[token]/success/page.tsx
export default function SigningSuccess({ params }) {
  return <SigningConfirmation token={params.token} />;
}
```

### Components

```
apps/web/src/app/c/[token]/
├── page.tsx                    # Main contract viewing page
├── success/page.tsx            # Post-signing confirmation
├── components/
│   ├── ContractViewer.tsx      # Full contract display
│   ├── SectionCard.tsx         # Individual section
│   ├── ProgressIndicator.tsx   # Section progress
│   ├── TableOfContents.tsx     # Section navigation
│   ├── ConsentCheckbox.tsx     # Agreement checkbox
│   ├── SigningButtons.tsx      # Smart-ID / Mobile-ID buttons
│   ├── LanguageToggle.tsx      # EN/LT switch
│   └── PdfDownload.tsx         # Download signed PDF
```

### API Endpoints

```
GET  /api/contracts/:token            # Get contract for viewing (public)
POST /api/contracts/:token/sign       # Initiate signing (creates Dokobit session)
GET  /api/contracts/:token/status     # Check signing status
GET  /api/contracts/:token/pdf        # Download signed PDF

POST /api/contracts/:id/preview       # Generate preview (agency)
POST /api/contracts/:id/generate-link # Generate magic link (agency)
```

### Dokobit Flow Optimization

Current: Redirect to Dokobit → Sign → Redirect back
Target: Inline iframe if possible, or minimal redirect

```typescript
// Check if Dokobit supports iframe embed
const signingSession = await dokobit.createSession({
  document: pdfBuffer,
  returnUrl: `${baseUrl}/c/${token}/success`,
  // Try iframe mode if available
  displayMode: 'iframe',
});
```

---

## PDF Quality Improvements

### Current Issues
- Helvetica font (generic)
- No branded header
- Basic layout

### Improvements
- Use pdf-lib with embedded fonts (Geist or similar)
- Branded header with logo
- Professional section headers
- Proper line spacing
- Footer with page numbers

```typescript
// PDF generation with better fonts
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

async function generatePdf(agreement: Agreement) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  
  // Embed custom font
  const fontBytes = await fs.readFile('./fonts/GeistRegular.ttf');
  const customFont = await pdfDoc.embedFont(fontBytes);
  
  // Add branded header
  const logoBytes = await fetchLogo(agreement.workspaceId);
  const logo = await pdfDoc.embedPng(logoBytes);
  
  // ... generate pages with custom font and branding
}
```

---

## Success Criteria

1. `/c/:token` route exists and renders agreement
2. Agreement shows real data (no placeholders)
3. Preview modal shows exactly what client sees
4. Magic link generation works
5. Mobile-responsive viewing
6. Section progress indicator works
7. Language toggle switches content
8. Consent checkbox required before signing
9. Dokobit signing completes successfully
10. Success page shows with PDF download
11. PDF has professional formatting

---

## Plans

| Plan | Focus | Wave |
|------|-------|------|
| 59-01 | Variable Resolution Service | 1 |
| 59-02 | Client Contract Page `/c/:token` | 1 |
| 59-03 | Preview Modal + Magic Link | 2 |
| 59-04 | Signing Flow + Success Page | 2 |
| 59-05 | PDF Quality + Polish | 3 |

---

## Out of Scope

- Automated email sending (using magic links)
- Multiple signers per agreement
- Contract amendments/addendums
- E-signature audit trail UI (data exists, no UI)
