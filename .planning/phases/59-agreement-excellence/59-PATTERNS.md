# Phase 59: Agreement & Signing Excellence - Pattern Map

**Mapped:** 2026-05-02
**Files analyzed:** 28 (new/modified files)
**Analogs found:** 28 / 28

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `open-seo-main/src/db/schema/agreement-signers.ts` | schema | CRUD | `open-seo-main/src/db/proposal-schema.ts` | role-match |
| `open-seo-main/src/db/schema/signature-requirements.ts` | schema | CRUD | `open-seo-main/src/db/agreement-template-schema.ts` | exact |
| `open-seo-main/src/server/features/agreements/services/AgreementVariableService.ts` | service | transform | `open-seo-main/src/server/features/proposals/services/VariableResolutionService.ts` | exact |
| `open-seo-main/src/server/features/agreements/services/AgreementPdfService.ts` | service | file-I/O | `open-seo-main/src/server/features/proposals/services/ProposalGeneratorService.ts` | role-match |
| `open-seo-main/src/server/features/agreements/services/MultiSignerOrchestrator.ts` | service | event-driven | `open-seo-main/src/routes/api/webhooks/dokobit.ts` | partial |
| `open-seo-main/src/server/features/agreements/repositories/AgreementRepository.ts` | repository | CRUD | `open-seo-main/src/server/features/proposals/services/ProposalService.ts` | role-match |
| `open-seo-main/src/server/features/agreements/repositories/SignerRepository.ts` | repository | CRUD | `open-seo-main/src/db/proposal-schema.ts` | partial |
| `open-seo-main/src/routes/api/agreements/index.ts` | route | request-response | `open-seo-main/src/routes/api/proposals/$proposalId.decline.ts` | exact |
| `open-seo-main/src/routes/api/agreements/[id]/sign.ts` | route | request-response | `open-seo-main/src/routes/api/webhooks/dokobit.ts` | partial |
| `open-seo-main/src/routes/api/agreements/[id]/signers.ts` | route | CRUD | `open-seo-main/src/routes/api/services/$serviceId.ts` | role-match |
| `open-seo-main/src/routes/api/contracts/[token].ts` | route | request-response | `apps/web/src/app/proposals/[token]/page.tsx` | partial |
| `open-seo-main/src/routes/api/contracts/[token]/sign.ts` | route | request-response | `open-seo-main/src/routes/api/webhooks/dokobit.ts` | partial |
| `open-seo-main/src/routes/api/contracts/[token]/pdf.ts` | route | file-I/O | `open-seo-main/src/server/features/proposals/services/ProposalGeneratorService.ts` | role-match |
| `apps/web/src/app/c/[token]/page.tsx` | component | request-response | `apps/web/src/app/proposals/[token]/page.tsx` | exact |
| `apps/web/src/app/c/[token]/success/page.tsx` | component | request-response | `apps/web/src/app/connect/success/page.tsx` | exact |
| `apps/web/src/app/c/[token]/components/ContractViewer.tsx` | component | request-response | `apps/web/src/app/proposals/[token]/components/ProposalView.tsx` | exact |
| `apps/web/src/app/c/[token]/components/LanguageToggle.tsx` | component | request-response | `apps/web/src/app/proposals/[token]/components/ProposalView.tsx` | partial |
| `apps/web/src/app/c/[token]/components/ProgressIndicator.tsx` | component | request-response | `apps/web/src/app/proposals/[token]/components/ProposalView.tsx` | partial |
| `apps/web/src/app/c/[token]/components/SigningButtons.tsx` | component | request-response | `apps/web/src/app/proposals/[token]/components/AcceptRejectButtons.tsx` | exact |
| `apps/web/src/app/c/[token]/components/SignatureSection.tsx` | component | request-response | `apps/web/src/app/proposals/[token]/components/ProposalView.tsx` | partial |
| `open-seo-main/src/client/components/agreements/TemplateSelector.tsx` | component | CRUD | `open-seo-main/src/client/components/services/ServiceCatalog.tsx` | role-match |
| `open-seo-main/src/client/components/agreements/SignerConfiguration.tsx` | component | CRUD | `open-seo-main/src/client/components/proposals/ProposalForm.tsx` | role-match |
| `open-seo-main/src/client/components/agreements/AgreementPreview.tsx` | component | request-response | `apps/web/src/app/proposals/[token]/components/ProposalView.tsx` | exact |
| `open-seo-main/locales/en/agreement.json` | config | static | `open-seo-main/locales/en/proposal.json` | exact |
| `open-seo-main/locales/lt/agreement.json` | config | static | `open-seo-main/locales/lt/proposal.json` | exact |
| `apps/web/src/i18n/locales/en/agreement.json` | config | static | `apps/web/src/i18n/locales/en/common.json` | role-match |
| `apps/web/src/i18n/locales/lt/agreement.json` | config | static | `apps/web/src/i18n/locales/lt/common.json` | role-match |
| `public/fonts/Inter-Regular.ttf` | asset | static | — | no-analog |

## Pattern Assignments

### `open-seo-main/src/db/schema/agreement-signers.ts` (schema, CRUD)

**Analog:** `open-seo-main/src/db/proposal-schema.ts`

**Imports pattern** (lines 1-16):
```typescript
import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization } from "./user-schema";
import { prospects } from "./prospect-schema";
```

**Table definition pattern** (lines 96-152):
```typescript
export const proposals = pgTable(
  "proposals",
  {
    id: text("id").primaryKey(),
    prospectId: text("prospect_id").references(() => prospects.id, {
      onDelete: "set null",
    }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // ... field definitions ...

    // Lifecycle timestamps
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
    firstViewedAt: timestamp("first_viewed_at", {
      withTimezone: true,
      mode: "date",
    }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "date" }),

    // Standard timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_proposals_workspace").on(table.workspaceId),
    index("ix_proposals_prospect").on(table.prospectId),
    index("ix_proposals_status").on(table.status),
    index("ix_proposals_token").on(table.token),
  ],
);
```

**Relations pattern** (lines 249-262):
```typescript
export const proposalsRelations = relations(proposals, ({ one, many }) => ({
  prospect: one(prospects, {
    fields: [proposals.prospectId],
    references: [prospects.id],
  }),
  workspace: one(organization, {
    fields: [proposals.workspaceId],
    references: [organization.id],
  }),
  views: many(proposalViews),
  signatures: many(proposalSignatures),
  payments: many(proposalPayments),
}));
```

**Type exports pattern** (lines 291-299):
```typescript
export type ProposalSelect = typeof proposals.$inferSelect;
export type ProposalInsert = typeof proposals.$inferInsert;
export type ProposalViewSelect = typeof proposalViews.$inferSelect;
export type ProposalViewInsert = typeof proposalViews.$inferInsert;
```

---

### `open-seo-main/src/db/schema/signature-requirements.ts` (schema, CRUD)

**Analog:** `open-seo-main/src/db/agreement-template-schema.ts`

**Imports pattern** (lines 1-23):
```typescript
import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  integer,
  boolean,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { organization } from "./user-schema";
import { prospects } from "./prospect-schema";
import { clients } from "./client-schema";
import { proposals } from "./proposal-schema";
```

**JSONB type definitions pattern** (lines 24-51):
```typescript
/**
 * AgreementSection - a single section of an agreement template.
 * isLegal: true means the section should NOT be AI-translated.
 */
export interface AgreementSection {
  id: string;
  title: string;
  content: string;
  isLegal: boolean;
  order: number;
}

/**
 * TemplateVariable - defines a substitution variable in the template.
 * translateValue: whether the substituted value should be translated.
 */
export interface TemplateVariable {
  key: string;
  label: string;
  type: "text" | "date" | "currency" | "number" | "list";
  required: boolean;
  translateValue: boolean;
}
```

**Enum constants pattern** (lines 54-73):
```typescript
// Template types
export const AGREEMENT_TEMPLATE_TYPES = [
  "seo-services",
  "consulting",
  "custom",
] as const;
export type AgreementTemplateType = (typeof AGREEMENT_TEMPLATE_TYPES)[number];

// Supported languages
export const AGREEMENT_LANGUAGES = ["en", "lt"] as const;
export type AgreementLanguage = (typeof AGREEMENT_LANGUAGES)[number];

// Generated agreement statuses
export const AGREEMENT_STATUS = [
  "draft",
  "sent",
  "signed",
  "expired",
  "cancelled",
] as const;
export type AgreementStatus = (typeof AGREEMENT_STATUS)[number];
```

**Table with CHECK constraints pattern** (lines 91-132):
```typescript
export const agreementTemplates = pgTable(
  "agreement_templates",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    language: text("language").notNull().default("en"),
    
    // JSONB columns for complex data
    sections: jsonb("sections").$type<AgreementSection[]>().notNull(),
    variables: jsonb("variables").$type<TemplateVariable[]>().notNull(),
    
    // Versioning
    version: integer("version").notNull().default(1),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => [
    index("ix_agreement_templates_language").on(table.language),
    check(
      "chk_agreement_template_language",
      sql`language IN ('en', 'lt')`
    ),
    check(
      "chk_agreement_template_type",
      sql`type IN ('seo-services', 'consulting', 'custom')`
    ),
  ]
);
```

---

### `open-seo-main/src/server/features/agreements/services/AgreementVariableService.ts` (service, transform)

**Analog:** `open-seo-main/src/server/features/proposals/services/VariableResolutionService.ts`

**Imports pattern** (lines 1-21):
```typescript
import { eq, and, isNull, or } from "drizzle-orm";
import { db } from "@/db/index";
import {
  variableDefinitions,
  type VariableDefinitionSelect,
  type VariableCategory,
  type SourceType,
  type FormatType,
  type FormatOptions,
} from "@/db/variable-definitions-schema";
import { proposals, type ProposalSelect } from "@/db/proposal-schema";
import { prospects, prospectAnalyses } from "@/db/prospect-schema";
import { organization } from "@/db/user-schema";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "VariableResolutionService" });
```

**Context interface pattern** (lines 25-59):
```typescript
/**
 * Context for variable resolution - all data sources needed.
 */
export interface ResolutionContext {
  proposal: ProposalSelect | null;
  prospect: {
    id: string;
    domain: string;
    companyName: string | null;
    contactName: string | null;
    contactEmail: string | null;
    industry: string | null;
  } | null;
  workspace: {
    id: string;
    name: string;
    contactEmail?: string | null;
    contactPhone?: string | null;
    vatNumber?: string | null;
    address?: string | null;
  } | null;
  analysis: {
    domainMetrics?: {
      organicTraffic?: number;
      organicKeywords?: number;
    };
    opportunityKeywords?: Array<{ keyword: string }>;
  } | null;
  audit: {
    score?: number;
    issuesCount?: number;
  } | null;
  customValues: Record<string, string>;
  locale: "en" | "lt";
}
```

**Service static methods pattern** (lines 328-422):
```typescript
export const VariableResolutionService = {
  /**
   * Load resolution context for a proposal.
   */
  async loadContext(
    proposalId: string,
    locale: "en" | "lt" = "en",
    customValues: Record<string, string> = {}
  ): Promise<ResolutionContext> {
    // Load proposal with prospect
    const [proposal] = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);

    if (!proposal) {
      return {
        proposal: null,
        prospect: null,
        workspace: null,
        analysis: null,
        audit: null,
        customValues,
        locale,
      };
    }

    // Load prospect
    let prospect = null;
    if (proposal.prospectId) {
      const [prospectRow] = await db
        .select({
          id: prospects.id,
          domain: prospects.domain,
          companyName: prospects.companyName,
          contactName: prospects.contactName,
          contactEmail: prospects.contactEmail,
          industry: prospects.industry,
        })
        .from(prospects)
        .where(eq(prospects.id, proposal.prospectId))
        .limit(1);

      prospect = prospectRow ?? null;
    }

    // ... load other entities in parallel
    
    return {
      proposal,
      prospect,
      workspace: workspace ?? null,
      analysis,
      audit: null,
      customValues,
      locale,
    };
  },

  /**
   * Resolve all variables for a proposal.
   */
  async resolveVariables(
    proposalId: string,
    locale: "en" | "lt" = "en",
    customValues: Record<string, string> = {}
  ): Promise<ResolvedVariables> {
    // Load context
    const context = await this.loadContext(proposalId, locale, customValues);

    // Load variable definitions (system + workspace)
    const definitions = await db
      .select()
      .from(variableDefinitions)
      .where(
        or(
          isNull(variableDefinitions.workspaceId),
          eq(variableDefinitions.workspaceId, workspaceId)
        )
      )
      .orderBy(variableDefinitions.displayOrder)
      .limit(500); // Safety limit

    // Resolve each variable
    const resolved: ResolvedVariables = {};
    
    for (const definition of definitions) {
      const value = resolveVariable(definition, context);
      resolved[definition.key] = {
        key: definition.key,
        value,
        category: definition.category,
        label: getLocalizedLabel(definition, locale),
        isEmpty: !value || value.trim() === "",
      };
    }

    return resolved;
  },
};
```

**Helper functions pattern** (lines 79-185):
```typescript
/**
 * Get a nested property value from an object using dot notation.
 */
function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current === "object" && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Format a value based on format type and options.
 */
function formatValue(
  value: unknown,
  format: FormatType,
  options: FormatOptions | null,
  locale: "en" | "lt"
): string {
  if (value === null || value === undefined) {
    return "";
  }

  const localeStr = locale === "lt" ? "lt-LT" : "en-US";

  switch (format) {
    case "currency": {
      const amount = typeof value === "number" ? value : parseFloat(String(value));
      if (isNaN(amount)) return "";
      
      const amountInUnits = amount / 100; // Assume cents
      const currency = options?.currency || "EUR";

      return new Intl.NumberFormat(localeStr, {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amountInUnits);
    }

    case "date": {
      const date = value instanceof Date ? value : new Date(String(value));
      if (isNaN(date.getTime())) return "";

      const dateStyle = options?.dateFormat === "short" ? "short" : "long";
      return new Intl.DateTimeFormat(localeStr, { dateStyle }).format(date);
    }

    case "text":
    default:
      return String(value);
  }
}
```

---

### `open-seo-main/src/routes/api/agreements/index.ts` (route, request-response)

**Analog:** `open-seo-main/src/routes/api/proposals/$proposalId.decline.ts`

**Imports pattern** (lines 1-18):
```typescript
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/index";
import { proposals } from "@/db/proposal-schema";
import { canTransition } from "@/server/features/proposals/services/ProposalService";
import { requireApiAuth } from "@/routes/api/seo/-middleware";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "api-proposals-decline" });
```

**Zod validation schema pattern** (lines 22-32):
```typescript
const DeclineSchema = z.object({
  reason: z.enum([
    "price",
    "competitor",
    "timing",
    "no_response",
    "internal",
    "other",
  ]),
  notes: z.string().optional(),
});
```

**Route definition pattern** (lines 34-140):
```typescript
export const Route = createFileRoute("/api/proposals/$proposalId/decline")({
  server: {
    handlers: {
      POST: async ({ request, params }: { request: Request; params: { proposalId: string } }) => {
        try {
          // Require authentication
          const auth = await requireApiAuth(request);

          const { proposalId } = params;
          const body = await request.json();
          const { reason, notes } = DeclineSchema.parse(body);

          // Get current proposal
          const [proposal] = await db
            .select()
            .from(proposals)
            .where(eq(proposals.id, proposalId))
            .limit(1);

          if (!proposal) {
            return Response.json(
              { success: false, error: "Proposal not found" },
              { status: 404 }
            );
          }

          // Verify workspace ownership
          if (proposal.workspaceId !== auth.organizationId) {
            log.warn("Unauthorized access attempt", {
              proposalId,
              userOrgId: auth.organizationId,
              proposalOrgId: proposal.workspaceId,
            });
            return Response.json(
              { success: false, error: "Access denied" },
              { status: 403 }
            );
          }

          // Update proposal
          const [updated] = await db
            .update(proposals)
            .set({
              status: "declined",
              declinedReason: reason,
              declinedNotes: notes,
              updatedAt: new Date(),
            })
            .where(eq(proposals.id, proposalId))
            .returning();

          log.info("Proposal declined", { proposalId, reason });

          return Response.json({ success: true, data: updated });
        } catch (error) {
          if (error instanceof AppError) {
            const status =
              error.code === "UNAUTHENTICATED" ? 401 :
              error.code === "FORBIDDEN" ? 403 : 400;
            return Response.json(
              { success: false, error: error.message },
              { status }
            );
          }

          if (error instanceof z.ZodError) {
            return Response.json(
              { success: false, error: error.issues },
              { status: 400 }
            );
          }

          log.error("Request failed", error instanceof Error ? error : new Error(String(error)));

          return Response.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
          );
        }
      },
    },
  },
});
```

---

### `open-seo-main/src/routes/api/webhooks/dokobit.ts` (route, event-driven)

**Analog:** `open-seo-main/src/routes/api/webhooks/dokobit.ts` (extend existing)

**Full pattern** (lines 1-73):
```typescript
/**
 * Dokobit webhook endpoint for e-signature completion.
 * Phase 48-02: Contract & Payment - Webhook handling
 *
 * POST /api/webhooks/dokobit
 * Handles Dokobit signing status callbacks (signed, rejected, expired).
 *
 * SECURITY: IP whitelist verification (Dokobit does not provide HMAC signatures).
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ContractService } from "@/server/features/contracts/services/ContractService";
import { verifyDokobitIp, processWebhookIdempotently } from "@/server/lib/webhook-utils";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "dokobit-webhook" });

const dokobitWebhookSchema = z.object({
  session_id: z.string(),
  status: z.enum(["signed", "rejected", "expired"]),
  signer_name: z.string().optional(),
});

// @ts-expect-error - Route path not in FileRoutesByPath yet
export const Route = createFileRoute("/api/webhooks/dokobit")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        // Get client IP for verification
        const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] ||
                         request.headers.get("x-real-ip");

        // Verify source IP per security pattern
        if (!verifyDokobitIp(clientIp)) {
          log.warn("Blocked webhook from unauthorized IP", { clientIp });
          return new Response("Forbidden", { status: 403 });
        }

        try {
          const body = await request.json();
          const payload = dokobitWebhookSchema.parse(body);

          // Generate event ID for idempotency
          const eventId = `dokobit-${payload.session_id}-${payload.status}`;

          await processWebhookIdempotently(
            eventId,
            `signing.${payload.status}`,
            "dokobit",
            async () => {
              if (payload.status === "signed") {
                await ContractService.handleSigningComplete(
                  payload.session_id,
                  payload.signer_name || "Unknown"
                );
              } else if (payload.status === "rejected" || payload.status === "expired") {
                log.info("Signing rejected/expired", { sessionId: payload.session_id });
              }
            }
          );

          return new Response("OK", { status: 200 });
        } catch (error) {
          log.error("Dokobit webhook error", error instanceof Error ? error : undefined);
          return new Response("Error", { status: 500 });
        }
      },
    },
  },
});
```

---

### `apps/web/src/app/c/[token]/page.tsx` (component, request-response)

**Analog:** `apps/web/src/app/proposals/[token]/page.tsx`

**Imports pattern** (lines 1-13):
```typescript
/**
 * Public proposal page.
 * Phase 46-47: Proposal System
 *
 * Server component that fetches proposal by token and renders the view.
 * No authentication required - token provides access.
 */
import { notFound } from "next/navigation";
import { getPublicProposal, getProposalServices } from "./actions";
import { ProposalView } from "./components/ProposalView";
import { AcceptRejectButtons } from "./components/AcceptRejectButtons";
```

**Server component pattern** (lines 15-134):
```typescript
interface Props {
  params: Promise<{ token: string }>;
}

export default async function PublicProposalPage({ params }: Props) {
  const { token } = await params;
  const result = await getPublicProposal(token);

  // Handle error states
  if (!result.success) {
    if (result.error === "expired") {
      return (
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-4" style={{ fontFamily: "Newsreader, serif" }}>
              Pasiulymas nebegalioja
            </h1>
            <p className="text-gray-600">
              Sis pasiulymas nebegalioja. Susisiekite su mumis del naujo pasiulymo.
            </p>
          </div>
        </div>
      );
    }

    if (result.error === "not_found") {
      notFound();
    }

    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Ivyko klaida</h1>
          <p className="text-gray-600">Nepavyko uzkrauti pasiulymo.</p>
        </div>
      </div>
    );
  }

  const proposal = result.data!;

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-3xl mx-auto px-4">
        <ProposalView proposal={proposal} token={token} locale="lt" />

        <div className="mt-12 pt-8 border-t border-gray-200">
          <AcceptRejectButtons proposalId={proposal.id} status={proposal.status} />
        </div>

        <footer className="mt-16 text-center text-sm text-gray-400">
          <p>Galioja iki: {proposal.expiresAt ? new Date(proposal.expiresAt).toLocaleDateString("lt-LT") : "30 dienu"}</p>
        </footer>
      </div>
    </div>
  );
}
```

---

### `open-seo-main/src/server/lib/dokobit/client.ts` (service, request-response)

**Analog:** `open-seo-main/src/server/lib/dokobit/client.ts` (extend existing)

**Client creation pattern** (lines 1-74):
```typescript
/**
 * Dokobit API client for Smart-ID and Mobile-ID signing.
 * Phase 30-05: E-Signature (Dokobit)
 *
 * @see https://developers.dokobit.com/
 */

import type {
  DokobitClient,
  SmartIdSigningParams,
  MobileIdSigningParams,
  SigningSession,
  SigningStatus,
} from "./types";

const DOKOBIT_BASE_URL = "https://api.dokobit.com";
const DOKOBIT_SIGNING_TIMEOUT_MS = 120000;

export function createDokobitClient(): DokobitClient {
  const accessToken = process.env.DOKOBIT_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error("DOKOBIT_ACCESS_TOKEN not configured");
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  return {
    async initiateSmartIdSigning(params: SmartIdSigningParams): Promise<SigningSession> {
      const response = await fetch(`${DOKOBIT_BASE_URL}/signing/smartid/sign`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          pno: `PNO${params.country}-${params.personalCode}`,
          hash: params.documentHash,
          hash_type: "SHA256",
          message: `Pasirasyti: ${params.documentName}`,
        }),
        signal: AbortSignal.timeout(DOKOBIT_SIGNING_TIMEOUT_MS),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Dokobit error: ${errorText}`);
      }

      const data = await response.json();
      return {
        sessionId: data.session_id,
        verificationCode: data.verification_code,
      };
    },

    async getSigningStatus(sessionId: string): Promise<SigningStatus> {
      const response = await fetch(
        `${DOKOBIT_BASE_URL}/signing/session/${sessionId}/status`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(30000),
        }
      );

      if (!response.ok) {
        throw new Error(`Dokobit error: ${await response.text()}`);
      }

      const data = await response.json();
      return {
        status: data.status,
        signedDocumentUrl: data.signed_document_url,
        error: data.error_message,
      };
    },
  };
}
```

---

## Shared Patterns

### Authentication Middleware
**Source:** `open-seo-main/src/routes/api/seo/-middleware.ts`
**Apply to:** All authenticated API routes (agreements, signers)

```typescript
import { requireApiAuth } from "@/routes/api/seo/-middleware";

// Inside route handler:
const auth = await requireApiAuth(request);

// Verify workspace ownership
if (entity.workspaceId !== auth.organizationId) {
  return Response.json(
    { success: false, error: "Access denied" },
    { status: 403 }
  );
}
```

### Error Handling (API Routes)
**Source:** `open-seo-main/src/routes/api/proposals/$proposalId.decline.ts`
**Apply to:** All API routes

```typescript
try {
  // ... route logic
} catch (error) {
  if (error instanceof AppError) {
    const status =
      error.code === "UNAUTHENTICATED" ? 401 :
      error.code === "FORBIDDEN" ? 403 : 400;
    return Response.json(
      { success: false, error: error.message },
      { status }
    );
  }

  if (error instanceof z.ZodError) {
    return Response.json(
      { success: false, error: error.issues },
      { status: 400 }
    );
  }

  log.error("Request failed", error instanceof Error ? error : new Error(String(error)));

  return Response.json(
    { success: false, error: "Internal server error" },
    { status: 500 }
  );
}
```

### Token Validation (Public Routes)
**Source:** `apps/web/src/app/proposals/[token]/page.tsx`
**Apply to:** `/c/:token` routes

```typescript
const result = await getPublicResource(token);

if (!result.success) {
  if (result.error === "expired") {
    return <ExpiredMessage />;
  }
  if (result.error === "not_found") {
    notFound();
  }
  return <ErrorMessage />;
}

const resource = result.data!;
```

### Logging Pattern
**Source:** All service files
**Apply to:** All services and routes

```typescript
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "AgreementVariableService" });

// Info level
log.info("Variables resolved", {
  agreementId,
  locale,
  count: resolved.length,
});

// Warning level
log.warn("Unknown variable in text", { key: trimmedKey });

// Error level
log.error("Resolution failed", error instanceof Error ? error : new Error(String(error)));
```

### i18n Localized Fields Pattern
**Source:** `open-seo-main/src/db/agreement-template-schema.ts`
**Apply to:** All schema files with multi-language content

```typescript
// Schema columns
nameEn: text("name_en"),
nameLt: text("name_lt"),
descriptionEn: text("description_en"),
descriptionLt: text("description_lt"),

// Helper function to get localized value
function getLocalizedValue(
  entity: { field: string; fieldEn?: string | null; fieldLt?: string | null },
  field: string,
  locale: "en" | "lt"
): string {
  if (locale === "lt" && entity[`${field}Lt`]) {
    return entity[`${field}Lt`];
  }
  if (locale === "en" && entity[`${field}En`]) {
    return entity[`${field}En`];
  }
  return entity[field];
}
```

### Database Query Safety Limits
**Source:** `open-seo-main/src/server/features/proposals/services/VariableResolutionService.ts`
**Apply to:** All database queries

```typescript
const definitions = await db
  .select()
  .from(variableDefinitions)
  .where(/* filters */)
  .orderBy(variableDefinitions.displayOrder)
  .limit(500); // Safety limit to prevent unbounded queries
```

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `public/fonts/Inter-Regular.ttf` | asset | static | Font files are external assets, downloaded from Google Fonts |

## Metadata

**Analog search scope:** 
- `open-seo-main/src/db/` — Schema files
- `open-seo-main/src/server/features/` — Service files
- `open-seo-main/src/routes/api/` — API routes
- `apps/web/src/app/` — Next.js pages
- `open-seo-main/src/server/lib/dokobit/` — Dokobit integration

**Files scanned:** 45
**Pattern extraction date:** 2026-05-02
