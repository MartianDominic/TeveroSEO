"use client";

/**
 * Template Editor Container
 * Phase 59-05: Template Editor with Drag-Drop Variables
 *
 * Main container for agreement template editing with:
 * - Clause reordering via drag-and-drop
 * - Variable palette for insertion
 * - Live preview with sample data
 * - Auto-save and manual save
 */

import { useState, useCallback, useTransition } from "react";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { Save, Eye, Edit3, Loader2 } from "lucide-react";

import {
  saveTemplate,
  reorderClauses,
  type TemplateData,
  type TemplateClause,
} from "@/app/[locale]/(shell)/templates/[templateId]/edit/actions";
import { logger } from '@/lib/logger';

import { Tabs, TabsContent, TabsList, TabsTrigger, Input, Button } from "@tevero/ui";


import { ClauseList } from "./ClauseList";
import { PreviewPane } from "./PreviewPane";
import { VariablePalette } from "./VariablePalette";


interface TemplateEditorProps {
  initialData: TemplateData;
}

export function TemplateEditor({ initialData }: TemplateEditorProps) {
  const [template, setTemplate] = useState<TemplateData>(initialData);
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Configure drag sensors for both mouse and keyboard
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before starting drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  /**
   * Handle clause reorder via drag-and-drop.
   */
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = template.clauseOrder.indexOf(active.id as string);
        const newIndex = template.clauseOrder.indexOf(over.id as string);
        const newOrder = arrayMove(template.clauseOrder, oldIndex, newIndex);

        // Optimistic update
        setTemplate((prev) => ({ ...prev, clauseOrder: newOrder }));

        // Persist to server
        startTransition(() => {
          reorderClauses(template.id, newOrder);
        });
      }
    },
    [template.id, template.clauseOrder]
  );

  /**
   * Handle save button click.
   */
  const handleSave = useCallback(async () => {
    setSaveStatus("saving");

    const result = await saveTemplate(template.id, {
      name: template.name,
      description: template.description,
      clauses: template.clauses,
      clauseOrder: template.clauseOrder,
      variables: template.variables,
    });

    if (result.success) {
      setSaveStatus("saved");
      // Reset status after 2 seconds
      setTimeout(() => setSaveStatus("idle"), 2000);
    } else {
      setSaveStatus("error");
      logger.error("Save failed", { error: result.error });
    }
  }, [template]);

  /**
   * Handle variable insertion into a clause.
   */
  const handleInsertVariable = useCallback(
    (clauseId: string, variable: string, position: number) => {
      setTemplate((prev) => ({
        ...prev,
        clauses: prev.clauses.map((c) =>
          c.id === clauseId
            ? {
                ...c,
                content:
                  c.content.slice(0, position) +
                  `{{${variable}}}` +
                  c.content.slice(position),
              }
            : c
        ),
      }));
    },
    []
  );

  /**
   * Handle clause content update.
   */
  const handleClauseUpdate = useCallback((clauseId: string, content: string) => {
    setTemplate((prev) => ({
      ...prev,
      clauses: prev.clauses.map((c) =>
        c.id === clauseId ? { ...c, content } : c
      ),
    }));
  }, []);

  /**
   * Handle clause title update.
   */
  const handleClauseTitleUpdate = useCallback((clauseId: string, title: string) => {
    setTemplate((prev) => ({
      ...prev,
      clauses: prev.clauses.map((c) =>
        c.id === clauseId ? { ...c, title } : c
      ),
    }));
  }, []);

  /**
   * Handle template name change.
   */
  const handleNameChange = useCallback((name: string) => {
    setTemplate((prev) => ({ ...prev, name }));
  }, []);

  /**
   * Handle template description change.
   */
  const handleDescriptionChange = useCallback((description: string) => {
    setTemplate((prev) => ({ ...prev, description: description || null }));
  }, []);

  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[600px]">
      {/* Left Panel: Variable Palette */}
      <aside className="w-64 border-r border-border bg-muted/30 p-4 overflow-y-auto flex-shrink-0">
        <VariablePalette onInsert={handleInsertVariable} />
      </aside>

      {/* Main Editor Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header with template name and save */}
        <header className="flex items-center gap-4 p-4 border-b border-border">
          <div className="flex-1 space-y-2">
            <Input
              value={template.name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="text-xl font-semibold border-none bg-transparent p-0 h-auto focus-visible:ring-0"
              placeholder="Template name"
            />
            <Input
              value={template.description || ""}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              className="text-sm text-muted-foreground border-none bg-transparent p-0 h-auto focus-visible:ring-0"
              placeholder="Template description (optional)"
            />
          </div>
          <Button
            onClick={handleSave}
            disabled={saveStatus === "saving"}
            variant={saveStatus === "saved" ? "outline" : "default"}
          >
            {saveStatus === "saving" ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : saveStatus === "saved" ? (
              <>
                <Save className="w-4 h-4 mr-2" />
                Saved
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save
              </>
            )}
          </Button>
        </header>

        {/* Tabs for Edit/Preview */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "edit" | "preview")}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="px-4 pt-2 border-b border-border">
            <TabsList>
              <TabsTrigger value="edit" className="flex items-center gap-2">
                <Edit3 className="w-4 h-4" />
                Edit
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Preview
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="edit" className="flex-1 overflow-y-auto p-4 m-0">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={template.clauseOrder}
                strategy={verticalListSortingStrategy}
              >
                <ClauseList
                  clauses={template.clauses}
                  order={template.clauseOrder}
                  onUpdate={handleClauseUpdate}
                  onTitleUpdate={handleClauseTitleUpdate}
                />
              </SortableContext>
            </DndContext>
            {isPending && (
              <div className="fixed bottom-4 right-4 bg-muted px-3 py-2 rounded-md text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Updating order...
              </div>
            )}
          </TabsContent>

          <TabsContent value="preview" className="flex-1 overflow-y-auto p-4 m-0">
            <PreviewPane clauses={template.clauses} order={template.clauseOrder} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default TemplateEditor;
