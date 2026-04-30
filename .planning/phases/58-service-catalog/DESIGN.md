# Phase 58: Service Catalog & Extra Services

**Goal:** Enable structured service packages with add-on services (GMB, Reviews, Website, CRM/Booking) as proposal line items

**Depends on:** Phase 57 (proposal editor complete)

**Estimated effort:** 35-45 hours

---

## Problem Statement

Current service handling is limited:

1. **Text-only services** — `investment.inclusions: string[]` is free-text
2. **No service catalog** — agencies recreate service lists for each proposal
3. **Single pricing tier** — only setup fee + monthly fee
4. **No add-on services** — cannot offer GMB, Reviews, Website as options
5. **No service terms** — services don't have associated agreement clauses

Agencies need structured, reusable service packages with flexible pricing.

---

## Service Categories

### Core SEO Packages (Tiers)

| Package | Monthly | Setup | Includes |
|---------|---------|-------|----------|
| Starter | €500 | €1,000 | 5 keywords, monthly reporting, basic optimization |
| Growth | €1,500 | €2,500 | 15 keywords, bi-weekly reporting, content briefs |
| Enterprise | €3,000 | €5,000 | Unlimited keywords, weekly reporting, dedicated manager |

### Add-On Services

| Service | Pricing Model | Description |
|---------|---------------|-------------|
| **GMB SEO** | €200/mo | Google Business Profile optimization, posts, Q&A |
| **Google Reviews** | €150/mo | Review generation system, response management |
| **Website Design** | €2,000-10,000 one-time | Custom website or redesign |
| **CRM Setup** | €500-2,000 one-time | GoHighLevel setup and configuration |
| **Booking System** | €100/mo | Calendar booking integration |
| **Content Writing** | €200/article | SEO-optimized blog articles |

---

## Data Model

### Service Catalog Schema

```typescript
// Service templates (workspace-level reusable definitions)
export const serviceTemplates = pgTable("service_templates", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  
  // Classification
  category: text("category").notNull(), // 'seo_package' | 'addon' | 'one_time'
  name: text("name").notNull(),
  nameEn: text("name_en"),
  nameLt: text("name_lt"),
  description: text("description"),
  descriptionEn: text("description_en"),
  descriptionLt: text("description_lt"),
  
  // Pricing
  pricingType: text("pricing_type").notNull(), // 'monthly' | 'one_time' | 'per_unit'
  basePriceCents: integer("base_price_cents"),
  setupFeeCents: integer("setup_fee_cents"),
  currency: text("currency").default("EUR"),
  unitLabel: text("unit_label"), // e.g., "per article", "per hour"
  
  // Deliverables
  inclusions: jsonb("inclusions"), // string[] of what's included
  
  // Agreement terms
  termsTemplate: text("terms_template"), // Legal clause for this service
  
  // Display
  icon: text("icon"), // Lucide icon name
  displayOrder: integer("display_order"),
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Services selected for a specific proposal
export const proposalServices = pgTable("proposal_services", {
  id: text("id").primaryKey(),
  proposalId: text("proposal_id").references(() => proposals.id),
  serviceTemplateId: text("service_template_id").references(() => serviceTemplates.id),
  
  // Customized pricing (can override template)
  customPriceCents: integer("custom_price_cents"),
  customSetupCents: integer("custom_setup_cents"),
  quantity: integer("quantity").default(1),
  
  // Custom description override
  customDescription: text("custom_description"),
  
  // Scheduling
  startMonth: integer("start_month"), // 0 = immediate, 1 = month 2, etc.
  durationMonths: integer("duration_months"), // null = ongoing
  
  isIncluded: boolean("is_included").default(true),
  displayOrder: integer("display_order"),
  
  createdAt: timestamp("created_at").defaultNow(),
});
```

---

## User Interface

### Service Selector in Proposal Builder

```
┌─────────────────────────────────────────────────────────────────┐
│ Investment                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Core SEO Package                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ○ Starter    €500/mo + €1,000 setup                         │ │
│ │ ● Growth     €1,500/mo + €2,500 setup  [Recommended]        │ │
│ │ ○ Enterprise €3,000/mo + €5,000 setup                       │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ Add-On Services                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ☑ GMB SEO Optimization          €200/mo              [Edit] │ │
│ │ ☐ Google Reviews Management     €150/mo              [Edit] │ │
│ │ ☐ Website Design/Redesign       from €2,000          [Edit] │ │
│ │ ☐ CRM & Automation Setup        from €500            [Edit] │ │
│ │ ☐ Booking System Integration    €100/mo              [Edit] │ │
│ │ [+ Add Custom Service]                                      │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Summary                                                     │ │
│ │ Monthly Total:     €1,700/mo                                │ │
│ │ One-Time Setup:    €2,500                                   │ │
│ │ First Month Total: €4,200                                   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Service Management (Settings)

```
Settings > Services

┌─────────────────────────────────────────────────────────────────┐
│ Service Catalog                                    [+ Add New]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ SEO Packages                                                     │
│ ├── Starter      €500/mo + €1,000    [Edit] [Duplicate] [···]  │
│ ├── Growth       €1,500/mo + €2,500  [Edit] [Duplicate] [···]  │
│ └── Enterprise   €3,000/mo + €5,000  [Edit] [Duplicate] [···]  │
│                                                                  │
│ Add-On Services                                                  │
│ ├── GMB SEO            €200/mo       [Edit] [Duplicate] [···]  │
│ ├── Google Reviews     €150/mo       [Edit] [Duplicate] [···]  │
│ ├── Website Design     from €2,000   [Edit] [Duplicate] [···]  │
│ ├── CRM Setup          from €500     [Edit] [Duplicate] [···]  │
│ └── Booking System     €100/mo       [Edit] [Duplicate] [···]  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Service Editor Modal

```
┌─────────────────────────────────────────────────────────────────┐
│ Edit Service                                              [×]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Name (EN)         [GMB SEO Optimization                    ]    │
│ Name (LT)         [GMB SEO optimizavimas                   ]    │
│                                                                  │
│ Category          [Add-On Service                         ▾]    │
│                                                                  │
│ Pricing Type      ○ Monthly  ○ One-Time  ○ Per Unit             │
│                                                                  │
│ Base Price        [€] [200    ] /month                          │
│ Setup Fee         [€] [0      ] one-time                        │
│                                                                  │
│ Description (EN)                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Complete Google Business Profile optimization including     │ │
│ │ weekly posts, Q&A management, and review responses.        │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ What's Included                                                  │
│ • [Profile optimization                               ] [−]     │
│ • [Weekly GMB posts (4/month)                         ] [−]     │
│ • [Q&A monitoring and responses                       ] [−]     │
│ • [Review response drafts                             ] [−]     │
│ [+ Add inclusion]                                               │
│                                                                  │
│ Agreement Terms (optional)                                       │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ GMB SEO services include optimization of the Client's      │ │
│ │ Google Business Profile. Provider does not guarantee...    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                    [Cancel]  [Save Service]     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Integration Points

### Proposal Builder
- Service selector component embedded in Investment section
- Package selection (radio) + add-ons (checkboxes)
- Price customization per proposal
- Auto-calculate totals

### Agreement Generation
- Selected services → agreement line items
- Service terms auto-appended to agreement
- Variable substitution for service-specific clauses

### Invoice Generation
- Services → invoice line items
- Split by pricing type (monthly vs one-time)
- Service start dates for pro-rating

---

## Default Service Templates (Seed Data)

```typescript
const defaultServices = [
  // SEO Packages
  {
    category: 'seo_package',
    name: 'Starter SEO',
    pricingType: 'monthly',
    basePriceCents: 50000,
    setupFeeCents: 100000,
    inclusions: ['5 target keywords', 'Monthly reporting', 'Basic on-page optimization'],
    icon: 'Zap',
  },
  {
    category: 'seo_package',
    name: 'Growth SEO',
    pricingType: 'monthly',
    basePriceCents: 150000,
    setupFeeCents: 250000,
    inclusions: ['15 target keywords', 'Bi-weekly reporting', 'Content briefs', 'Link building'],
    icon: 'TrendingUp',
  },
  {
    category: 'seo_package',
    name: 'Enterprise SEO',
    pricingType: 'monthly',
    basePriceCents: 300000,
    setupFeeCents: 500000,
    inclusions: ['Unlimited keywords', 'Weekly reporting', 'Dedicated manager', 'Priority support'],
    icon: 'Building',
  },
  // Add-ons
  {
    category: 'addon',
    name: 'GMB SEO Optimization',
    pricingType: 'monthly',
    basePriceCents: 20000,
    inclusions: ['Profile optimization', 'Weekly posts', 'Q&A management', 'Review responses'],
    icon: 'MapPin',
  },
  {
    category: 'addon',
    name: 'Google Reviews Management',
    pricingType: 'monthly',
    basePriceCents: 15000,
    inclusions: ['Review generation campaigns', 'Response management', 'Reputation monitoring'],
    icon: 'Star',
  },
  {
    category: 'addon',
    name: 'Website Design',
    pricingType: 'one_time',
    basePriceCents: 200000,
    inclusions: ['Custom design', 'Responsive layout', 'SEO-optimized structure', '3 revision rounds'],
    icon: 'Globe',
  },
  {
    category: 'addon',
    name: 'CRM & Automation Setup',
    pricingType: 'one_time',
    basePriceCents: 50000,
    inclusions: ['GoHighLevel setup', 'Pipeline configuration', 'Automation workflows', 'Training'],
    icon: 'Users',
  },
  {
    category: 'addon',
    name: 'Booking System',
    pricingType: 'monthly',
    basePriceCents: 10000,
    inclusions: ['Calendar integration', 'Automated reminders', 'Online scheduling'],
    icon: 'Calendar',
  },
];
```

---

## Success Criteria

1. Service catalog exists with default templates
2. Agencies can create/edit/delete service templates
3. Proposal builder shows service selector
4. Package selection (radio) with 3 default tiers
5. Add-on services (checkboxes) can be toggled
6. Prices can be customized per proposal
7. Summary shows calculated totals
8. Selected services appear in agreement
9. Service terms auto-included in agreement

---

## Plans

| Plan | Focus | Wave |
|------|-------|------|
| 58-01 | Schema + Service Templates CRUD | 1 |
| 58-02 | Service Selector Component | 1 |
| 58-03 | Proposal Integration + Pricing | 2 |
| 58-04 | Agreement Integration + Terms | 2 |

---

## Out of Scope

- Service bundles/packages (combining add-ons)
- Usage-based pricing
- Service-specific reporting
- GHL integration (just references GHL as a service option)
