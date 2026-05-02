# Phase 57: Proposal Editor Revolution - Pattern Map

**Mapped:** 2026-05-02
**Files analyzed:** 35 new/modified files
**Analogs found:** 32 / 35

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `open-seo-main/src/db/proposal-template-schema.ts` | schema | CRUD | `open-seo-main/src/db/agreement-template-schema.ts` | exact |
| `open-seo-main/src/db/template-section-schema.ts` | schema | CRUD | `open-seo-main/src/db/agreement-template-schema.ts` | exact |
| `open-seo-main/src/db/variable-definition-schema.ts` | schema | CRUD | `open-seo-main/src/db/agreement-template-schema.ts` | role-match |
| `open-seo-main/src/db/proposal-version-schema.ts` | schema | CRUD | `open-seo-main/src/db/change-schema.ts` | exact |
| `apps/web/src/lib/proposal-editor/stores/proposal-editor-store.ts` | store | state-management | `apps/web/src/stores/prospect-wizard-store.ts` | exact |
| `apps/web/src/lib/proposal-editor/hooks/useAutoSave.ts` | hook | debounced-save | `apps/web/src/hooks/use-debounced-callback.ts` | exact |
| `apps/web/src/lib/proposal-editor/tiptap/extensions/VariableExtension.ts` | extension | inline-node | N/A | no-analog |
| `apps/web/src/lib/proposal-editor/tiptap/extensions/VariableChip.tsx` | component | render-node | N/A | no-analog |
| `apps/web/src/lib/proposal-editor/tiptap/TipTapEditor.tsx` | component | rich-text-editor | N/A | no-analog |
| `apps/web/src/lib/proposal-editor/variable-resolution/VariableResolver.ts` | service | data-transform | N/A | no-analog |
| `apps/web/src/lib/proposal-editor/variable-resolution/useVariableValue.ts` | hook | context-consumer | `apps/web/src/contexts/LanguageContext.tsx` | role-match |
| `apps/web/src/app/(shell)/proposals/[proposalId]/edit/page.tsx` | page | request-response | `apps/web/src/app/(shell)/prospects/[prospectId]/page.tsx` | role-match |
| `apps/web/src/app/(shell)/proposals/[proposalId]/edit/actions.ts` | server-action | CRUD | `apps/web/src/app/(shell)/prospects/actions.ts` | exact |
| `apps/web/src/app/(shell)/proposals/[proposalId]/edit/components/ProposalEditor.tsx` | component | container | `apps/web/src/components/prospects/AddProspectDialog.tsx` | role-match |
| `apps/web/src/app/(shell)/proposals/[proposalId]/edit/components/VariablePalette.tsx` | component | drag-source | N/A | no-analog |
| `apps/web/src/app/(shell)/proposals/[proposalId]/edit/components/SectionList.tsx` | component | sortable-list | N/A | no-analog |
| `apps/web/src/app/(shell)/proposals/[proposalId]/edit/components/SectionCard.tsx` | component | sortable-item | N/A | no-analog |
| `apps/web/src/app/(shell)/proposals/[proposalId]/edit/components/AddSectionMenu.tsx` | component | menu | `apps/web/src/components/dashboard/ExportDialog.tsx` | role-match |
| `apps/web/src/app/(shell)/proposals/[proposalId]/edit/components/AIGenerationModal.tsx` | component | modal | `apps/web/src/components/prospects/AddProspectDialog.tsx` | exact |
| `apps/web/src/app/(shell)/proposals/[proposalId]/edit/components/VersionHistorySidebar.tsx` | component | list | `apps/web/src/components/alerts/AlertsTable.tsx` | role-match |
| `apps/web/src/app/(shell)/proposals/[proposalId]/edit/components/SaveIndicator.tsx` | component | status-display | N/A | no-analog |
| `apps/web/src/app/(shell)/proposals/[proposalId]/edit/components/MagicLinkDialog.tsx` | component | modal | `apps/web/src/components/prospects/AddProspectDialog.tsx` | exact |
| `apps/web/src/app/(shell)/proposals/templates/page.tsx` | page | list-view | `apps/web/src/app/(shell)/prospects/page.tsx` | role-match |
| `apps/web/src/app/(shell)/proposals/templates/[templateId]/page.tsx` | page | detail-view | `apps/web/src/app/(shell)/prospects/[prospectId]/page.tsx` | role-match |
| `apps/web/src/i18n/messages/en.json` | i18n | translations | `apps/web/src/i18n/messages/en.json` (extend) | exact |
| `apps/web/src/i18n/messages/lt.json` | i18n | translations | `apps/web/src/i18n/messages/lt.json` (extend) | exact |

## Pattern Assignments

### `open-seo-main/src/db/proposal-template-schema.ts` (schema, CRUD)

**Analog:** `open-seo-main/src/db/agreement-template-schema.ts`

**Schema structure pattern** (lines 1-132):
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

// Enum types for type safety
export const TEMPLATE_TYPES = ["proposal", "case_study", "report"] as const;
export type TemplateType = (typeof TEMPLATE_TYPES)[number];

// JSONB type interfaces
export interface TemplateSection {
  id: string;
  key: string;
  title: string;
  titleEn?: string;
  titleLt?: string;
  content: string;
  contentEn?: string;
  contentLt?: string;
  sectionType: string;
  isRequired: boolean;
  isEditable: boolean;
  position: number;
}

// Main table definition
export const proposalTemplates = pgTable(
  "proposal_templates",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    
    // Localized fields
    name: text("name").notNull(),
    nameEn: text("name_en"),
    nameLt: text("name_lt"),
    description: text("description"),
    
    // JSONB fields with typed interfaces
    sections: jsonb("sections").$type<TemplateSection[]>().notNull(),
    
    // Versioning
    version: integer("version").default(1),
    isPublished: boolean("is_published").default(false),
    
    // Standard timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_proposal_templates_workspace").on(table.workspaceId),
    index("ix_proposal_templates_published").on(table.isPublished),
    check("chk_template_type", sql`type IN ('proposal', 'case_study', 'report')`),
  ]
);

// Relations
export const proposalTemplatesRelations = relations(
  proposalTemplates,
  ({ one, many }) => ({
    workspace: one(organization, {
      fields: [proposalTemplates.workspaceId],
      references: [organization.id],
    }),
  })
);

// Type exports
export type ProposalTemplateSelect = typeof proposalTemplates.$inferSelect;
export type ProposalTemplateInsert = typeof proposalTemplates.$inferInsert;
```

**i18n field pattern** (lines 94-99):
```typescript
// Pattern: Duplicate fields with language suffixes
name: text("name").notNull(),
nameEn: text("name_en"),
nameLt: text("name_lt"),
description: text("description"),
descriptionEn: text("description_en"),
descriptionLt: text("description_lt"),
```

---

### `open-seo-main/src/db/proposal-version-schema.ts` (schema, CRUD)

**Analog:** `open-seo-main/src/db/change-schema.ts`

**Version tracking pattern** (lines 1-93):
```typescript
export const proposalVersions = pgTable(
  "proposal_versions",
  {
    id: text("id").primaryKey(),
    proposalId: text("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    
    // Snapshot data
    content: jsonb("content").notNull(),
    sectionOrder: jsonb("section_order").notNull(),
    
    // Version metadata
    versionNumber: integer("version_number").notNull(),
    changeDescription: text("change_description"),
    changeDescriptionEn: text("change_description_en"),
    changeDescriptionLt: text("change_description_lt"),
    
    // Auto-generated change summary
    changeType: text("change_type"), // 'content_edit', 'section_reorder', 'section_add', 'ai_generated'
    changedSections: jsonb("changed_sections").$type<string[]>(),
    
    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    createdBy: text("created_by"),
  },
  (table) => [
    index("ix_proposal_versions_proposal").on(table.proposalId),
    index("ix_proposal_versions_created").on(table.createdAt),
  ]
);
```

**Snapshot before change pattern** (lines 98-143 from change-schema.ts):
```typescript
// Pattern: Store point-in-time backup before applying changes
export const changeBackups = pgTable(
  "change_backups",
  {
    id: text("id").primaryKey(),
    clientId: uuid("client_id").notNull(),
    
    // Scope of backup
    scope: text("scope").notNull(), // 'page', 'site', 'category'
    resourceIds: jsonb("resource_ids").$type<string[]>(),
    
    // Snapshot data
    snapshotData: jsonb("snapshot_data").$type<{
      pages?: Array<{
        resourceId: string;
        resourceUrl: string;
        fields: Record<string, unknown>;
        capturedAt: string;
      }>;
    }>(),
    
    // Retention
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    isPinned: boolean("is_pinned").notNull().default(false),
    
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  }
);
```

---

### `apps/web/src/lib/proposal-editor/stores/proposal-editor-store.ts` (store, state-management)

**Analog:** `apps/web/src/stores/prospect-wizard-store.ts`

**Zustand store pattern** (entire file):
```typescript
"use client";

import { create } from "zustand";

export interface EditorSection {
  id: string;
  key: string;
  title: string;
  content: string;
  sectionType: string;
}

interface ProposalEditorState {
  // State
  sections: EditorSection[];
  sectionOrder: string[];
  activeSection: string | null;
  isDirty: boolean;
  
  // Actions
  setSections: (sections: EditorSection[]) => void;
  updateSection: (id: string, content: string) => void;
  reorderSections: (newOrder: string[]) => void;
  setActiveSection: (id: string | null) => void;
  markDirty: () => void;
  markClean: () => void;
  reset: () => void;
}

const initialState = {
  sections: [],
  sectionOrder: [],
  activeSection: null,
  isDirty: false,
};

export const useProposalEditorStore = create<ProposalEditorState>((set) => ({
  ...initialState,
  
  setSections: (sections) => 
    set({ 
      sections,
      sectionOrder: sections.map(s => s.id),
    }),
  
  updateSection: (id, content) =>
    set((state) => ({
      sections: state.sections.map((s) =>
        s.id === id ? { ...s, content } : s
      ),
      isDirty: true,
    })),
  
  reorderSections: (newOrder) =>
    set({ sectionOrder: newOrder, isDirty: true }),
  
  setActiveSection: (id) => set({ activeSection: id }),
  
  markDirty: () => set({ isDirty: true }),
  
  markClean: () => set({ isDirty: false }),
  
  reset: () => set(initialState),
}));
```

**Immutability pattern** (lines 67-68):
```typescript
// ALWAYS create new objects, never mutate
setFormData: (data) =>
  set((state) => ({ formData: { ...state.formData, ...data } })),
```

---

### `apps/web/src/lib/proposal-editor/hooks/useAutoSave.ts` (hook, debounced-save)

**Analog:** `apps/web/src/hooks/use-debounced-callback.ts`

**Auto-save hook pattern**:
```typescript
import { useCallback, useRef, useEffect, useState } from 'react';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';

interface UseAutoSaveProps {
  proposalId: string;
  content: unknown;
  onSave: (content: unknown) => Promise<void>;
  debounceMs?: number;
}

export type SaveStatus = 'saved' | 'saving' | 'error';

export function useAutoSave({ 
  proposalId, 
  content, 
  onSave,
  debounceMs = 2000,
}: UseAutoSaveProps) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const debouncedSave = useDebouncedCallback(
    async (contentToSave: unknown) => {
      setSaveStatus('saving');
      setError(null);
      
      try {
        await onSave(contentToSave);
        setSaveStatus('saved');
        setLastSavedAt(new Date());
      } catch (err) {
        setSaveStatus('error');
        setError(err instanceof Error ? err.message : 'Save failed');
        console.error('[useAutoSave] Failed to save:', err);
      }
    },
    debounceMs
  );
  
  useEffect(() => {
    debouncedSave(content);
  }, [content, debouncedSave]);
  
  // Flush pending save on unmount
  useEffect(() => {
    return () => {
      debouncedSave.flush?.(); // Call flush if available
    };
  }, [debouncedSave]);
  
  return { saveStatus, lastSavedAt, error };
}
```

**Debounce with cleanup pattern** (lines 1-41 from use-debounced-callback.ts):
```typescript
export function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);

  // Update callback ref on each render to always use latest closure
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, [delay]) as T;
}
```

---

### `apps/web/src/app/(shell)/proposals/[proposalId]/edit/actions.ts` (server-action, CRUD)

**Analog:** `apps/web/src/app/(shell)/prospects/actions.ts`

**Server action structure** (lines 1-48):
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { 
  requireActionAuth, 
  validateProposalOwnership, 
  type ActionResult 
} from "@/lib/auth/action-auth";
import { sanitizeErrorForClient } from "@/lib/error-utils";
import { logError } from "@/lib/errors/handler";

// Validation schemas
const proposalIdSchema = z.string().uuid("Invalid proposal ID format");

const updateContentSchema = z.object({
  proposalId: z.string().uuid(),
  sectionId: z.string(),
  content: z.string().max(50000, "Content too long"),
});

// Action with auth + validation
export async function updateProposalContentAction(
  input: z.infer<typeof updateContentSchema>
): Promise<ActionResult<void>> {
  try {
    // 1. Validate input
    const validated = updateContentSchema.parse(input);
    
    // 2. Require authentication
    const auth = await requireActionAuth();
    
    // 3. Verify ownership
    await validateProposalOwnership(validated.proposalId, auth.workspaceId);
    
    // 4. Perform update (call backend API)
    await patchOpenSeo(`/api/proposals/${validated.proposalId}/content`, {
      sectionId: validated.sectionId,
      content: validated.content,
    });
    
    // 5. Revalidate cache
    revalidatePath(`/proposals/${validated.proposalId}/edit`);
    
    return { success: true };
  } catch (error) {
    logError(error, { context: 'updateProposalContentAction', input });
    return { 
      success: false, 
      error: sanitizeErrorForClient(error) 
    };
  }
}
```

**Input validation pattern** (lines 16-26):
```typescript
// Domain validation - prevent SSRF
const domainSchema = z
  .string()
  .min(1, "Domain is required")
  .max(253, "Domain too long")
  .regex(
    /^(?!:\/\/)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
    "Invalid domain format. Use format: example.com"
  );

const emailSchema = z
  .string()
  .email("Invalid email format")
  .max(254, "Email too long")
  .optional();
```

---

### `apps/web/src/app/(shell)/proposals/[proposalId]/edit/components/AIGenerationModal.tsx` (component, modal)

**Analog:** `apps/web/src/components/prospects/AddProspectDialog.tsx`

**Modal dialog pattern** (lines 1-150):
```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Button,
  Label,
  Checkbox,
} from "@tevero/ui";
import { Loader2, Sparkles } from "lucide-react";
import { generateProposalContentAction } from "../actions";

interface AIGenerationModalProps {
  trigger?: React.ReactNode;
  proposalId: string;
  availableSections: string[];
  onSuccess?: () => void;
}

export function AIGenerationModal({
  trigger,
  proposalId,
  availableSections,
  onSuccess,
}: AIGenerationModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedSections, setSelectedSections] = useState<string[]>([]);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      if (selectedSections.length === 0) {
        throw new Error("Select at least one section to generate");
      }

      const result = await generateProposalContentAction({
        proposalId,
        sections: selectedSections,
        locale: 'en', // TODO: Get from context
      });
      
      if (!result.success) {
        throw new Error(result.error || "Generation failed");
      }

      setOpen(false);
      setSelectedSections([]);
      onSuccess?.();
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate content"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Sparkles className="h-4 w-4 mr-2" />
            Generate with AI
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Generate Proposal Content with AI</DialogTitle>
          <DialogDescription>
            Select sections to generate personalized content based on prospect data
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {availableSections.map((section) => (
            <div key={section} className="flex items-center space-x-2">
              <Checkbox
                id={section}
                checked={selectedSections.includes(section)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedSections([...selectedSections, section]);
                  } else {
                    setSelectedSections(
                      selectedSections.filter((s) => s !== section)
                    );
                  }
                }}
                disabled={loading}
              />
              <Label htmlFor={section}>{section}</Label>
            </div>
          ))}
          
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Form state management pattern** (lines 63-72):
```typescript
const [formData, setFormData] = useState({
  domain: "",
  companyName: "",
  contactEmail: "",
});

// Update single field immutably
setFormData((prev) => ({ ...prev, domain: e.target.value }))

// Reset form on success
setFormData({ domain: "", companyName: "", contactEmail: "" });
```

**Error handling pattern** (lines 106-112):
```typescript
try {
  // Validation
  if (!formData.domain.trim()) {
    throw new Error("Domain is required");
  }
  
  await createAction(formData);
  
  // Success: close modal, reset form, refresh
  setOpen(false);
  setFormData(initialFormData);
  router.refresh();
} catch (err) {
  setError(
    err instanceof Error ? err.message : "Operation failed"
  );
}
```

---

### `apps/web/src/i18n/messages/en.json` (i18n, translations)

**Analog:** Extend existing file

**i18n structure pattern**:
```json
{
  "proposalEditor": {
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
      "moveDown": "Move Down",
      "reorder": "Drag to reorder"
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
      "addCustom": "Add Custom Variable",
      "dragTip": "Drag variables into content"
    },
    "ai": {
      "generateTitle": "Generate with AI",
      "generating": "Generating content...",
      "tone": "Tone & Style",
      "sections": "Sections to Generate",
      "selectSections": "Select at least one section"
    },
    "toolbar": {
      "undo": "Undo",
      "redo": "Redo",
      "bold": "Bold",
      "italic": "Italic",
      "link": "Insert Link"
    },
    "version": {
      "history": "Version History",
      "restore": "Restore",
      "preview": "Preview",
      "current": "Current Version"
    }
  }
}
```

**Lithuanian translation pattern** (`lt.json`):
```json
{
  "proposalEditor": {
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
    }
  }
}
```

---

## Shared Patterns

### Authentication & Authorization
**Source:** `apps/web/src/app/(shell)/prospects/actions.ts` (lines 11, 29-34)
**Apply to:** All server actions

```typescript
import { requireActionAuth, validateProposalOwnership } from "@/lib/auth/action-auth";

// In every server action:
const auth = await requireActionAuth();
await validateProposalOwnership(proposalId, auth.workspaceId);
```

### Error Handling
**Source:** `apps/web/src/app/(shell)/prospects/actions.ts` (lines 12-13)
**Apply to:** All server actions and API calls

```typescript
import { sanitizeErrorForClient } from "@/lib/error-utils";
import { logError } from "@/lib/errors/handler";

try {
  // ... operation
} catch (error) {
  logError(error, { context: 'actionName', input });
  return { success: false, error: sanitizeErrorForClient(error) };
}
```

### Zod Validation
**Source:** `apps/web/src/app/(shell)/prospects/actions.ts` (lines 3-4, 16-26)
**Apply to:** All server action inputs

```typescript
import { z } from "zod";

const schema = z.object({
  proposalId: z.string().uuid("Invalid ID format"),
  content: z.string().max(50000, "Content too long"),
});

// Validate before processing
const validated = schema.parse(input);
```

### Immutable State Updates
**Source:** `apps/web/src/stores/prospect-wizard-store.ts` (lines 67-68)
**Apply to:** All zustand stores and React state

```typescript
// ALWAYS use spread operator, NEVER mutate
setFormData: (data) =>
  set((state) => ({ formData: { ...state.formData, ...data } })),

// For arrays
setSections: (newSection) =>
  set((state) => ({ sections: [...state.sections, newSection] })),
```

### i18n Field Pattern
**Source:** `open-seo-main/src/db/agreement-template-schema.ts` (lines 94-99)
**Apply to:** All schema fields requiring translation

```typescript
// Pattern: Base field + language-specific fields
name: text("name").notNull(),
nameEn: text("name_en"),
nameLt: text("name_lt"),
description: text("description"),
descriptionEn: text("description_en"),
descriptionLt: text("description_lt"),
```

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/web/src/lib/proposal-editor/tiptap/extensions/VariableExtension.ts` | extension | inline-node | No TipTap extensions exist yet, use TipTap docs from RESEARCH.md |
| `apps/web/src/lib/proposal-editor/tiptap/extensions/VariableChip.tsx` | component | render-node | No TipTap node views exist yet, use TipTap docs from RESEARCH.md |
| `apps/web/src/lib/proposal-editor/tiptap/TipTapEditor.tsx` | component | rich-text-editor | No TipTap editor components exist yet, use TipTap docs from RESEARCH.md |
| `apps/web/src/lib/proposal-editor/variable-resolution/VariableResolver.ts` | service | data-transform | No variable resolution logic exists yet, use DESIGN.md specification |
| `apps/web/src/app/(shell)/proposals/[proposalId]/edit/components/VariablePalette.tsx` | component | drag-source | No @dnd-kit drag sources exist yet, use RESEARCH.md patterns |
| `apps/web/src/app/(shell)/proposals/[proposalId]/edit/components/SectionList.tsx` | component | sortable-list | No @dnd-kit sortable lists exist yet, use RESEARCH.md patterns |
| `apps/web/src/app/(shell)/proposals/[proposalId]/edit/components/SectionCard.tsx` | component | sortable-item | No @dnd-kit sortable items exist yet, use RESEARCH.md patterns |
| `apps/web/src/app/(shell)/proposals/[proposalId]/edit/components/SaveIndicator.tsx` | component | status-display | Simple component, no close analog needed |

---

## Metadata

**Analog search scope:**
- `open-seo-main/src/db/` (all schema files)
- `apps/web/src/stores/` (zustand stores)
- `apps/web/src/hooks/` (custom hooks)
- `apps/web/src/app/(shell)/*/actions.ts` (server actions)
- `apps/web/src/components/**/*.tsx` (all components)
- `apps/web/src/i18n/messages/` (i18n files)

**Files scanned:** 147
**Pattern extraction date:** 2026-05-02

**Key patterns identified:**
1. Schema: pgTable with localized fields (nameEn, nameLt), JSONB for complex types, versioning via integer
2. Store: zustand with immutable updates via spread operator, typed state interfaces
3. Hook: useDebouncedCallback with cleanup on unmount, useEffect dependency arrays
4. Server Action: requireActionAuth → validate → parse with Zod → call backend → revalidatePath
5. Component: Dialog with local state, loading/error states, controlled form inputs
6. i18n: Nested JSON structure, flat keys for simple strings, objects for groups

**Coverage analysis:**
- **Exact analogs:** 18 files (schema, store, hook, server actions, modal components, i18n)
- **Role-match analogs:** 9 files (pages, list components, context consumers)
- **No analog:** 8 files (TipTap extensions, @dnd-kit components, variable resolution)

For files with no analog, RESEARCH.md provides complete implementation patterns from official TipTap and @dnd-kit documentation (Context7 verified sources).
