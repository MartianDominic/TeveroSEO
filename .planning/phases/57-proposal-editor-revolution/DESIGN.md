# Phase 57: Proposal Editor Revolution

**Goal:** Transform proposal editing into a Google Docs meets website builder experience with template system, drag-and-drop variables, and AI generation

**Depends on:** Phase 56 (prospect input complete)

**Estimated effort:** 60-70 hours

**i18n:** All UI, templates, and variable labels support EN/LT

---

## Problem Statement

Current proposal editing is clunky:

1. **Textarea editing** — not inline, requires modal/page switch
2. **Fixed section order** — cannot reorder sections
3. **No custom sections** — locked to 6 predefined sections
4. **Manual save only** — risk of losing work
5. **No clone/duplicate** — must recreate from scratch
6. **No version history** — cannot recover previous versions
7. **No undo/redo** — accidents cannot be reversed
8. **No template system** — agencies recreate from scratch each time
9. **Hardcoded variables** — no drag-and-drop variable insertion
10. **No AI generation** — manual content creation only

The experience is functional but not delightful. Users expect Notion/Google Docs-level editing.

---

## User Journey (Target State)

```
Agency User creates/edits proposal:
1. Select template or start blank
2. See live preview with editable sections
3. Click any text → cursor appears → type to edit (inline)
4. Drag variables from palette into content
5. Drag section handles to reorder
6. Click "+" to add custom section (text, image, testimonial, etc.)
7. Changes auto-save (debounced, no save button needed)
8. Undo with Cmd+Z, redo with Cmd+Shift+Z
9. View version history in sidebar
10. Click "Generate with AI" to draft content from prospect data
11. Clone proposal with one click
12. Generate magic link for manual sending
```

---

## Template System Architecture

### Three-Layer Hierarchy

```
System Templates (TeveroSEO defaults)
    └── Workspace Templates (agency customizations)
            └── Proposal Instances (per-prospect documents)
```

### Template Schema

```typescript
export const proposalTemplates = pgTable("proposal_templates", {
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
  type: text("type").notNull().default('proposal'), // 'proposal' | 'case_study' | 'report'
  category: text("category"), // 'seo', 'local_seo', 'ecommerce', 'enterprise'
  
  // Section definitions
  sections: jsonb("sections").notNull(), // TemplateSection[]
  sectionOrder: jsonb("section_order").notNull(), // string[] of section IDs
  
  // Variable definitions available in this template
  variables: jsonb("variables").notNull(), // VariableDefinition[]
  
  // Styling
  brandingSettings: jsonb("branding_settings"), // Colors, fonts, logo position
  
  // Versioning
  version: integer("version").default(1),
  isPublished: boolean("is_published").default(false),
  isDefault: boolean("is_default").default(false),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: text("created_by"),
});

// Template sections (reusable building blocks)
export const templateSections = pgTable("template_sections", {
  id: text("id").primaryKey(),
  templateId: text("template_id").references(() => proposalTemplates.id),
  
  // Section identity
  key: text("key").notNull(), // 'hero', 'current_state', 'opportunities', etc.
  
  // Localized titles
  title: text("title").notNull(),
  titleEn: text("title_en"),
  titleLt: text("title_lt"),
  
  // Localized content with variable placeholders
  content: text("content").notNull(),
  contentEn: text("content_en"),
  contentLt: text("content_lt"),
  
  // Section configuration
  sectionType: text("section_type").notNull(), 
  // 'text' | 'hero' | 'services' | 'pricing' | 'testimonial' | 'case_study' | 'roi' | 'cta'
  
  isRequired: boolean("is_required").default(true),
  isEditable: boolean("is_editable").default(true),
  position: integer("position").notNull(),
  
  // Conditional rendering
  conditions: jsonb("conditions"), // When to show this section
  
  // AI generation hints
  aiPromptHint: text("ai_prompt_hint"), // Guidance for AI content generation
  
  createdAt: timestamp("created_at").defaultNow(),
});
```

---

## Variable System

### Variable Categories

| Category | Examples | Source | Color |
|----------|----------|--------|-------|
| **Client** | `{{client.name}}`, `{{client.companyCode}}`, `{{client.industry}}` | Prospect record | Blue |
| **Provider** | `{{provider.name}}`, `{{provider.vatNumber}}`, `{{provider.address}}` | Workspace settings | Green |
| **Pricing** | `{{totals.monthly}}`, `{{totals.setup}}`, `{{services.list}}` | Proposal services | Orange |
| **Audit** | `{{audit.score}}`, `{{audit.issues}}`, `{{audit.topKeywords}}` | Website audit | Purple |
| **Dates** | `{{proposal.date}}`, `{{proposal.validUntil}}`, `{{today}}` | Computed | Gray |
| **Custom** | `{{custom.projectCode}}`, `{{custom.specialTerms}}` | Agency-defined | Teal |

### Variable Definition Schema

```typescript
export const variableDefinitions = pgTable("variable_definitions", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id"), // null = system variable
  templateId: text("template_id"), // Optional - template-specific
  
  // Variable identity
  key: text("key").notNull().unique(), // 'client.name', 'totals.monthly'
  
  // Localized labels
  label: text("label").notNull(),
  labelEn: text("label_en"),
  labelLt: text("label_lt"),
  
  description: text("description"),
  descriptionEn: text("description_en"),
  descriptionLt: text("description_lt"),
  
  // Classification
  category: text("category").notNull(), // 'client', 'provider', 'pricing', 'audit', 'dates', 'custom'
  
  // Value resolution
  sourceType: text("source_type").notNull(), // 'entity', 'computed', 'custom', 'input'
  sourcePath: text("source_path"), // For entity: 'prospect.companyName'
  computation: text("computation"), // For computed: formula or function name
  
  // Formatting
  format: text("format"), // 'currency', 'date', 'number', 'text', 'list', 'percentage'
  formatOptions: jsonb("format_options"), // Currency symbol, date format, etc.
  defaultValue: text("default_value"),
  defaultValueEn: text("default_value_en"),
  defaultValueLt: text("default_value_lt"),
  
  // Validation
  isRequired: boolean("is_required").default(false),
  validationRules: jsonb("validation_rules"),
  
  // Display
  icon: text("icon"), // Lucide icon name
  displayOrder: integer("display_order"),
  
  createdAt: timestamp("created_at").defaultNow(),
});
```

### Variable Resolution Service

```typescript
class VariableResolutionService {
  async resolveVariables(
    proposalId: string,
    locale: 'en' | 'lt' = 'en'
  ): Promise<Record<string, string>> {
    const proposal = await this.getProposal(proposalId);
    const prospect = await this.getProspect(proposal.prospectId);
    const workspace = await this.getWorkspace(proposal.workspaceId);
    const services = await this.getProposalServices(proposalId);
    const audit = await this.getAuditResults(prospect.websiteUrl);
    
    return {
      // Client variables
      '{{client.name}}': prospect.companyName,
      '{{client.companyCode}}': prospect.companyCode || this.t('notProvided', locale),
      '{{client.address}}': prospect.address || this.t('notProvided', locale),
      '{{client.representative}}': prospect.contactName,
      '{{client.industry}}': prospect.industry,
      '{{client.website}}': prospect.websiteUrl,
      
      // Provider variables
      '{{provider.name}}': workspace.companyName,
      '{{provider.companyCode}}': workspace.companyCode,
      '{{provider.vatNumber}}': workspace.vatNumber,
      '{{provider.address}}': workspace.address,
      '{{provider.representative}}': workspace.ownerName,
      '{{provider.email}}': workspace.email,
      '{{provider.phone}}': workspace.phone,
      
      // Pricing variables
      '{{totals.monthly}}': this.formatCurrency(this.sumMonthly(services), locale),
      '{{totals.setup}}': this.formatCurrency(this.sumSetup(services), locale),
      '{{totals.firstMonth}}': this.formatCurrency(
        this.sumMonthly(services) + this.sumSetup(services), 
        locale
      ),
      '{{services.list}}': this.formatServiceList(services, locale),
      '{{services.count}}': String(services.length),
      
      // Audit variables
      '{{audit.score}}': String(audit?.overallScore || this.t('pending', locale)),
      '{{audit.issues}}': String(audit?.criticalIssues || 0),
      '{{audit.topKeywords}}': this.formatKeywordList(audit?.topKeywords, locale),
      '{{audit.competitors}}': this.formatCompetitorList(audit?.competitors, locale),
      
      // Date variables
      '{{today}}': this.formatDate(new Date(), locale),
      '{{proposal.date}}': this.formatDate(proposal.createdAt, locale),
      '{{proposal.validUntil}}': this.formatDate(
        addDays(proposal.createdAt, 30), 
        locale
      ),
    };
  }
  
  private t(key: string, locale: 'en' | 'lt'): string {
    const translations = {
      notProvided: { en: 'Not provided', lt: 'Nepateikta' },
      pending: { en: 'Pending', lt: 'Laukiama' },
    };
    return translations[key]?.[locale] || key;
  }
  
  private formatCurrency(cents: number, locale: 'en' | 'lt'): string {
    const euros = cents / 100;
    return new Intl.NumberFormat(locale === 'lt' ? 'lt-LT' : 'en-GB', {
      style: 'currency',
      currency: 'EUR',
    }).format(euros);
  }
  
  private formatDate(date: Date, locale: 'en' | 'lt'): string {
    return new Intl.DateTimeFormat(locale === 'lt' ? 'lt-LT' : 'en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  }
}
```

---

## Drag-and-Drop Variable UI

### Variable Palette

```
┌─────────────────────────────────────────────────────────────────┐
│ Proposal Editor                                    [Preview] [⚙] │
├────────────────────────────────────┬────────────────────────────┤
│                                    │ Variables              [⌕] │
│ ⋮⋮ Hero Section                    │ ─────────────────────────  │
│                                    │                            │
│ Unlock Your Website's              │ 📋 Client                  │
│ Full Potential                     │ ├─ [client.name]          │
│                                    │ ├─ [client.website]       │
│ Hi [client.representative],        │ ├─ [client.industry]      │
│                                    │ └─ [client.representative]│
│ We've analyzed [client.website]    │                            │
│ and found significant              │ 🏢 Provider               │
│ opportunities...                   │ ├─ [provider.name]        │
│                                    │ └─ [provider.email]       │
│ ▼ Drop variable here               │                            │
│                                    │ 💰 Pricing                 │
│ ⋮⋮ Current State                   │ ├─ [totals.monthly]       │
│                                    │ ├─ [totals.setup]         │
│ Your website currently scores      │ ├─ [totals.firstMonth]    │
│ [audit.score] in our analysis...   │ └─ [services.list]        │
│                                    │                            │
│ ⋮⋮ Opportunities                   │ 📊 Audit Results          │
│                                    │ ├─ [audit.score]          │
│ We identified [audit.issues]       │ ├─ [audit.issues]         │
│ critical issues and these top      │ └─ [audit.topKeywords]    │
│ keyword opportunities:             │                            │
│ [audit.topKeywords]                │ 📅 Dates                   │
│                                    │ ├─ [today]                │
│ [+ Add Section]                    │ ├─ [proposal.date]        │
│                                    │ └─ [proposal.validUntil]  │
│ ⋮⋮ Investment                      │                            │
│                                    │ ➕ Custom                  │
│ Monthly: [totals.monthly]          │ └─ [+ Add Variable]       │
│ Setup: [totals.setup]              │                            │
│ ─────────────────────────          └────────────────────────────┤
│ First month: [totals.firstMonth]   │                            │
│                                    │                            │
└────────────────────────────────────┴────────────────────────────┘
```

### Variable Chip Behavior

- **Drag** from palette → drop into content
- **Click** chip → edit/format options popup
- **Hover** → shows resolved value preview
- **Colors** by category (blue=client, green=provider, orange=pricing)
- **Red outline** if variable cannot be resolved
- **Tooltip** shows variable description

### Variable Chip Rendering in TipTap

```typescript
// TipTap extension for variable chips
const VariableExtension = Node.create({
  name: 'variable',
  group: 'inline',
  inline: true,
  atom: true,
  
  addAttributes() {
    return {
      key: { default: null },
      category: { default: 'custom' },
      label: { default: '' },
    };
  },
  
  parseHTML() {
    return [{ tag: 'span[data-variable]' }];
  },
  
  renderHTML({ HTMLAttributes }) {
    return ['span', {
      'data-variable': HTMLAttributes.key,
      'data-category': HTMLAttributes.category,
      class: `variable-chip variable-${HTMLAttributes.category}`,
    }, `{{${HTMLAttributes.key}}}`];
  },
  
  addNodeView() {
    return ReactNodeViewRenderer(VariableChipComponent);
  },
});

// React component for variable chip
function VariableChipComponent({ node, updateAttributes }) {
  const { key, category, label } = node.attrs;
  const { resolvedValue, isResolved } = useVariableValue(key);
  
  return (
    <NodeViewWrapper as="span" className="inline">
      <Tooltip content={isResolved ? resolvedValue : 'Value not available'}>
        <span 
          className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-md text-sm font-medium",
            "border cursor-default select-none",
            categoryColors[category],
            !isResolved && "border-red-500 border-dashed"
          )}
        >
          {label || key}
        </span>
      </Tooltip>
    </NodeViewWrapper>
  );
}
```

---

## AI Content Generation

### AI Generation Modal

```
┌─────────────────────────────────────────────────────────────────┐
│ Generate Proposal Content with AI                          [×]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Available Context                                                │
│ ☑ Website Audit Results      Score: 67/100         [View →]     │
│ ☑ Keyword Research           23 opportunities      [View →]     │
│ ☑ Prospect Information       Acme Corp             [View →]     │
│ ☐ Competitor Analysis        Not available                      │
│                                                                  │
│ ─────────────────────────────────────────────────────────────── │
│                                                                  │
│ Sections to Generate                                             │
│                                                                  │
│ ☑ Hero / Introduction                                           │
│   "Personalized opening hook based on their industry"           │
│                                                                  │
│ ☑ Current State Analysis                                        │
│   "Summary of audit findings and current performance"           │
│                                                                  │
│ ☑ Opportunities                                                 │
│   "SEO opportunities found in keyword research"                 │
│                                                                  │
│ ☑ ROI Projections                                               │
│   "Traffic and revenue potential calculations"                  │
│                                                                  │
│ ☐ Services                    Uses your service catalog         │
│ ☐ Investment                  Uses your pricing config          │
│                                                                  │
│ ─────────────────────────────────────────────────────────────── │
│                                                                  │
│ Tone & Style                                                     │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Professional, consultative, ROI-focused              ▾     │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ Language                                                         │
│ ○ English  ● Lietuvių (Lithuanian)                              │
│                                                                  │
│ ─────────────────────────────────────────────────────────────── │
│                                                                  │
│ ⓘ AI generates draft content you can edit. Legal and pricing    │
│   sections use your configured templates.                       │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                              [Cancel]  [Generate Draft →]        │
└─────────────────────────────────────────────────────────────────┘
```

### AI Generation Service

```typescript
class ProposalAIGenerationService {
  async generateContent(
    proposalId: string,
    sections: string[],
    locale: 'en' | 'lt',
    tone: string
  ): Promise<GeneratedContent[]> {
    const proposal = await this.getProposal(proposalId);
    const context = await this.buildContext(proposal);
    
    const results: GeneratedContent[] = [];
    
    for (const sectionKey of sections) {
      const prompt = this.buildPrompt(sectionKey, context, locale, tone);
      const content = await this.llm.generate(prompt);
      
      results.push({
        sectionKey,
        content,
        confidence: this.assessConfidence(content, context),
        suggestedVariables: this.extractVariableSuggestions(content),
      });
    }
    
    return results;
  }
  
  private buildPrompt(
    sectionKey: string, 
    context: ProposalContext, 
    locale: 'en' | 'lt',
    tone: string
  ): string {
    const templates = {
      hero: {
        en: `Write a compelling proposal introduction for ${context.prospect.companyName}, 
             a ${context.prospect.industry} company. Their website ${context.audit.websiteUrl} 
             scored ${context.audit.score}/100 in our SEO audit. 
             Tone: ${tone}. 2-3 paragraphs max.`,
        lt: `Parašykite įtikinamą pasiūlymo įžangą ${context.prospect.companyName}, 
             ${context.prospect.industry} įmonei. Jų svetainė ${context.audit.websiteUrl} 
             gavo ${context.audit.score}/100 mūsų SEO audite.
             Tonas: ${tone}. Maksimum 2-3 pastraipos.`,
      },
      current_state: {
        en: `Analyze the current SEO state of ${context.audit.websiteUrl}. 
             Key findings: ${context.audit.findings.join(', ')}. 
             Present professionally but highlight the urgency. 
             Tone: ${tone}. Use bullet points.`,
        lt: `Išanalizuokite dabartinę ${context.audit.websiteUrl} SEO būklę.
             Pagrindinės išvados: ${context.audit.findings.join(', ')}.
             Pateikite profesionaliai, bet pabrėžkite skubumą.
             Tonas: ${tone}. Naudokite ženklelius.`,
      },
      // ... more section templates
    };
    
    return templates[sectionKey]?.[locale] || templates[sectionKey]?.en;
  }
}
```

---

## Inline Editing (TipTap)

### Implementation

```typescript
// Main editor component
function ProposalInlineEditor({ 
  content, 
  onUpdate,
  variables,
  locale 
}: ProposalEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: locale === 'lt' 
          ? 'Pradėkite rašyti arba vilkite kintamąjį...'
          : 'Start typing or drag a variable...',
      }),
      Typography,
      VariableExtension,
      Link,
      Highlight,
    ],
    content,
    onUpdate: ({ editor }) => {
      onUpdate(editor.getHTML());
    },
  });
  
  return (
    <div className="prose prose-sm max-w-none">
      <EditorContent editor={editor} />
    </div>
  );
}
```

**Behavior:**
- Click any text → cursor appears
- Type to edit directly
- Rich text: bold, italic, links, bullet points
- Placeholder text when empty (localized)
- Real-time character count

---

## Drag-and-Drop Sections

### Implementation with @dnd-kit

```typescript
function SectionList({ sections, onReorder }: SectionListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={sections.map(s => s.id)}
        strategy={verticalListSortingStrategy}
      >
        {sections.map((section) => (
          <SortableSection key={section.id} section={section} />
        ))}
      </SortableContext>
    </DndContext>
  );
}
```

**Section order stored:**
```typescript
sectionOrder: ['hero', 'current_state', 'opportunities', 'custom_1', 'roi', 'investment', 'cta']
```

---

## Custom Sections

### Types Available

| Type | Description | Content Fields |
|------|-------------|----------------|
| **text** | Rich text block | `content: string` |
| **image** | Image with caption | `url: string, caption: string, alt: string` |
| **testimonial** | Quote with attribution | `quote: string, author: string, company: string, image?: string` |
| **case_study** | Mini case study | `title: string, metrics: {label, value}[], description: string` |
| **video** | Embedded video | `url: string, platform: 'youtube' | 'vimeo' | 'loom'` |
| **comparison** | Before/after table | `items: {aspect: string, before: string, after: string}[]` |
| **timeline** | Project phases | `phases: {title: string, duration: string, description: string}[]` |

### Add Section Menu

```
┌─────────────────────────────────────────────────────────────────┐
│ Add Section                                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐        │
│ │    📝     │ │    🖼️     │ │    💬     │ │    📊     │        │
│ │   Text    │ │   Image   │ │Testimonial│ │Case Study │        │
│ └───────────┘ └───────────┘ └───────────┘ └───────────┘        │
│                                                                  │
│ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐        │
│ │    🎬     │ │    ⚖️     │ │    📅     │ │    ➕     │        │
│ │   Video   │ │Comparison │ │ Timeline  │ │  Custom   │        │
│ └───────────┘ └───────────┘ └───────────┘ └───────────┘        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Auto-Save System

### Implementation

```typescript
function useAutoSave(proposalId: string, content: ProposalContent) {
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  
  const debouncedSave = useDebouncedCallback(
    async (content: ProposalContent) => {
      setSaveStatus('saving');
      try {
        await saveProposal(proposalId, content);
        setSaveStatus('saved');
        setLastSavedAt(new Date());
      } catch (error) {
        setSaveStatus('error');
        // Queue for retry
        queueOfflineSave(proposalId, content);
      }
    },
    2000 // 2 second debounce
  );
  
  useEffect(() => {
    debouncedSave(content);
  }, [content]);
  
  return { saveStatus, lastSavedAt };
}
```

### Status Indicator (Localized)

```typescript
function SaveIndicator({ status, lastSavedAt, locale }: SaveIndicatorProps) {
  const labels = {
    saving: { en: 'Saving...', lt: 'Išsaugoma...' },
    saved: { en: 'Saved', lt: 'Išsaugota' },
    error: { en: 'Save failed', lt: 'Išsaugoti nepavyko' },
  };
  
  return (
    <span className="text-sm text-muted-foreground">
      {labels[status][locale]}
      {status === 'saved' && lastSavedAt && (
        <span className="ml-1">
          {formatRelativeTime(lastSavedAt, locale)}
        </span>
      )}
    </span>
  );
}
```

---

## Version History

### Schema

```typescript
export const proposalVersions = pgTable("proposal_versions", {
  id: text("id").primaryKey(),
  proposalId: text("proposal_id").references(() => proposals.id).onDelete('cascade'),
  
  // Snapshot
  content: jsonb("content").notNull(),
  sectionOrder: jsonb("section_order").notNull(),
  
  // Version metadata
  versionNumber: integer("version_number").notNull(),
  changeDescription: text("change_description"),
  changeDescriptionEn: text("change_description_en"),
  changeDescriptionLt: text("change_description_lt"),
  
  // Auto-generated change summary
  changeType: text("change_type"), // 'content_edit', 'section_reorder', 'section_add', 'ai_generated'
  changedSections: jsonb("changed_sections"), // string[] of section IDs
  
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: text("created_by"),
});
```

### Version History UI

```
┌─────────────────────────────────────────────────────────────────┐
│ Version History                                            [×]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ● Current Version                                               │
│   Today 15:32 · John Smith                                      │
│   Edited Hero section                                           │
│                                                                  │
│ ○ Version 4                                                     │
│   Today 14:15 · John Smith                                      │
│   AI generated Opportunities section                            │
│   [Preview] [Restore]                                           │
│                                                                  │
│ ○ Version 3                                                     │
│   Yesterday 18:45 · John Smith                                  │
│   Added testimonial section                                     │
│   [Preview] [Restore]                                           │
│                                                                  │
│ ○ Version 2                                                     │
│   Yesterday 16:20 · John Smith                                  │
│   Reordered sections                                            │
│   [Preview] [Restore]                                           │
│                                                                  │
│ ○ Version 1 (Original)                                          │
│   Apr 28, 2026 · John Smith                                     │
│   Created from template                                         │
│   [Preview] [Restore]                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Clone/Duplicate

### Endpoint

```typescript
// POST /api/proposals/:id/duplicate
async function duplicateProposal(req: Request) {
  const { id } = req.params;
  const { keepProspect = false, newName } = req.body;
  
  const original = await getProposal(id);
  
  const duplicate = await createProposal({
    ...original,
    id: generateId(),
    name: newName || `Copy of ${original.name}`,
    prospectId: keepProspect ? original.prospectId : null,
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  
  // Copy all sections
  await copyProposalSections(id, duplicate.id);
  
  // Copy services
  await copyProposalServices(id, duplicate.id);
  
  return duplicate;
}
```

---

## Undo/Redo

### Implementation with zustand

```typescript
const useProposalStore = create<ProposalState>()(
  temporal(
    (set) => ({
      content: initialContent,
      sectionOrder: initialOrder,
      
      updateSection: (sectionId, content) => set((state) => ({
        content: {
          ...state.content,
          [sectionId]: content,
        },
      })),
      
      reorderSections: (newOrder) => set({ sectionOrder: newOrder }),
    }),
    {
      limit: 50, // Keep last 50 states
    }
  )
);

// In component
const { undo, redo, canUndo, canRedo } = useProposalStore.temporal.getState();
```

**Keyboard shortcuts:**
- `Cmd+Z` / `Ctrl+Z` → Undo
- `Cmd+Shift+Z` / `Ctrl+Shift+Z` → Redo

---

## Magic Link Generation

```typescript
// Generate shareable link
async function generateProposalLink(proposalId: string): Promise<string> {
  const token = generateSecureToken();
  
  await db.update(proposals)
    .set({
      accessToken: token,
      tokenExpiresAt: addDays(new Date(), 30),
    })
    .where(eq(proposals.id, proposalId));
  
  return `${env.APP_URL}/p/${token}`;
}
```

### Magic Link UI

```
┌─────────────────────────────────────────────────────────────────┐
│ Share Proposal                                             [×]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Magic Link                                                       │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ https://app.teveroseo.com/p/abc123xyz789         [Copy 📋] │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ Link expires: May 30, 2026                                       │
│                                                                  │
│ [Regenerate Link]  (invalidates previous link)                  │
│                                                                  │
│ ─────────────────────────────────────────────────────────────── │
│                                                                  │
│ Send via:                                                        │
│ [📧 Email]  [💬 WhatsApp]  [📱 Copy to Clipboard]               │
│                                                                  │
│ ⓘ When the prospect opens the link, you'll be notified.        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## i18n Implementation

### Translation Files

```typescript
// apps/web/src/locales/en/proposal-editor.json
{
  "editor": {
    "title": "Edit Proposal",
    "saveStatus": {
      "saving": "Saving...",
      "saved": "Saved",
      "error": "Save failed"
    },
    "sections": {
      "addSection": "Add Section",
      "deleteSection": "Delete Section",
      "moveUp": "Move Up",
      "moveDown": "Move Down"
    },
    "variables": {
      "title": "Variables",
      "search": "Search variables...",
      "categories": {
        "client": "Client",
        "provider": "Provider",
        "pricing": "Pricing",
        "audit": "Audit Results",
        "dates": "Dates",
        "custom": "Custom"
      },
      "addCustom": "Add Custom Variable"
    },
    "ai": {
      "generateTitle": "Generate with AI",
      "generating": "Generating content...",
      "tone": "Tone & Style",
      "sections": "Sections to Generate"
    }
  }
}

// apps/web/src/locales/lt/proposal-editor.json
{
  "editor": {
    "title": "Redaguoti pasiūlymą",
    "saveStatus": {
      "saving": "Išsaugoma...",
      "saved": "Išsaugota",
      "error": "Išsaugoti nepavyko"
    },
    "sections": {
      "addSection": "Pridėti sekciją",
      "deleteSection": "Ištrinti sekciją",
      "moveUp": "Perkelti aukštyn",
      "moveDown": "Perkelti žemyn"
    },
    "variables": {
      "title": "Kintamieji",
      "search": "Ieškoti kintamųjų...",
      "categories": {
        "client": "Klientas",
        "provider": "Teikėjas",
        "pricing": "Kainodara",
        "audit": "Audito rezultatai",
        "dates": "Datos",
        "custom": "Pasirinktiniai"
      },
      "addCustom": "Pridėti pasirinktinį kintamąjį"
    },
    "ai": {
      "generateTitle": "Generuoti su AI",
      "generating": "Generuojamas turinys...",
      "tone": "Tonas ir stilius",
      "sections": "Generuojamos sekcijos"
    }
  }
}
```

---

## API Endpoints

```
# Templates
GET    /api/templates/proposals              # List proposal templates
GET    /api/templates/proposals/:id          # Get template details
POST   /api/templates/proposals              # Create template
PUT    /api/templates/proposals/:id          # Update template
DELETE /api/templates/proposals/:id          # Delete template

# Variables
GET    /api/variables                        # List all variables
GET    /api/variables/categories             # List variable categories
POST   /api/variables                        # Create custom variable
PUT    /api/variables/:id                    # Update variable
DELETE /api/variables/:id                    # Delete custom variable

# Proposal editing
PUT    /api/proposals/:id/content            # Auto-save content
PUT    /api/proposals/:id/sections/order     # Update section order
POST   /api/proposals/:id/sections           # Add custom section
PUT    /api/proposals/:id/sections/:sid      # Update section
DELETE /api/proposals/:id/sections/:sid      # Remove section

# AI generation
POST   /api/proposals/:id/generate           # AI generate content
GET    /api/proposals/:id/generate/status    # Generation status

# Versioning
GET    /api/proposals/:id/versions           # List versions
GET    /api/proposals/:id/versions/:vid      # Get version
POST   /api/proposals/:id/versions/:vid/restore  # Restore version

# Clone & Share
POST   /api/proposals/:id/duplicate          # Clone proposal
POST   /api/proposals/:id/link               # Generate magic link
```

---

## Success Criteria

1. Template selector shown when creating proposal
2. Click any section text to edit inline
3. Drag variables from palette into content
4. Variables render as colored chips with preview
5. Drag sections to reorder with smooth animation
6. Add custom sections (text, image, testimonial, etc.)
7. Auto-save within 2 seconds of last change
8. Clone proposal creates full copy with one click
9. View and restore previous versions
10. Undo/redo works with Cmd+Z / Cmd+Shift+Z
11. AI generates personalized content per section
12. Magic link generation with copy button
13. All UI available in English and Lithuanian
14. Variable labels and content support both languages

---

## Plans

| Plan | Focus | Wave |
|------|-------|------|
| 57-01 | Schema + Template CRUD + i18n Setup | 1 |
| 57-02 | Variable System + Resolution Service | 1 |
| 57-03 | Inline Editing (TipTap) + Variable Chips | 2 |
| 57-04 | Drag-and-Drop Sections (@dnd-kit) | 2 |
| 57-05 | Custom Sections + Add Section Menu | 3 |
| 57-06 | Auto-Save + Version History | 3 |
| 57-07 | AI Content Generation | 4 |
| 57-08 | Clone + Undo/Redo + Magic Link | 4 |

---

## Dependencies

- TipTap: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-placeholder`
- Drag-and-drop: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- State: `zustand`, `zundo` (for temporal)
- i18n: `next-intl` or `react-i18next`
- Debounce: `use-debounce`

---

## Out of Scope

- PDF export (handled in Phase 59)
- Email sending (manual via magic link)
- Collaborative editing (single user per proposal)
- Comments/annotations
