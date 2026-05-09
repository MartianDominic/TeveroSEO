"use client";

/**
 * Clause Editor Component
 * Phase 59-05: Template Editor with Drag-Drop Variables
 *
 * Editable clause with variable drop zone for inserting template variables.
 */

import { useCallback, useRef, useState } from "react";

import { Card, CardContent, CardHeader, Input, Textarea } from "@tevero/ui";

interface ClauseEditorProps {
  clause: {
    id: string;
    title: string;
    content: string;
    isLegal: boolean;
  };
  index: number;
  onUpdate: (content: string) => void;
  onTitleUpdate: (title: string) => void;
}

export function ClauseEditor({
  clause,
  index,
  onUpdate,
  onTitleUpdate,
}: ClauseEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  /**
   * Handle variable drop - insert {{variable}} at cursor position.
   */
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const variable = e.dataTransfer.getData("text/plain");
      if (!variable) return;

      const textarea = textareaRef.current;
      if (!textarea) {
        // If no cursor position, append to end
        onUpdate(clause.content + `{{${variable}}}`);
        return;
      }

      // Get cursor position or selection
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      // Insert variable at cursor position
      const variableToken = `{{${variable}}}`;
      const newContent =
        clause.content.slice(0, start) +
        variableToken +
        clause.content.slice(end);

      onUpdate(newContent);

      // Move cursor after inserted variable
      requestAnimationFrame(() => {
        const newPosition = start + variableToken.length;
        textarea.focus();
        textarea.setSelectionRange(newPosition, newPosition);
      });
    },
    [clause.content, onUpdate]
  );

  /**
   * Handle drag over - show visual feedback.
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  }, []);

  /**
   * Handle drag leave - remove visual feedback.
   */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  return (
    <Card
      className={`transition-all duration-200 ${
        isDragOver
          ? "ring-2 ring-primary ring-offset-2 bg-primary/5"
          : ""
      }`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <span className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
            {index}
          </span>
          <Input
            value={clause.title}
            onChange={(e) => onTitleUpdate(e.target.value)}
            className="flex-1 font-medium border-none bg-transparent p-0 h-auto focus-visible:ring-0"
            placeholder="Clause title"
          />
          {clause.isLegal && (
            <span className="flex-shrink-0 text-xs px-2 py-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
              Legal
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div
          className={`relative rounded-md transition-colors ${
            isDragOver ? "bg-primary/10" : ""
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <Textarea
            ref={textareaRef}
            value={clause.content}
            onChange={(e) => onUpdate(e.target.value)}
            className="min-h-[120px] resize-y font-mono text-sm"
            placeholder="Enter clause content... Drag variables here to insert them."
          />
          {isDragOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-primary/10 rounded-md pointer-events-none">
              <span className="text-sm font-medium text-primary">
                Drop to insert variable
              </span>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Drag variables from the palette to insert them at cursor position.
          Variables use the format {"{{variable_name}}"}.
        </p>
      </CardContent>
    </Card>
  );
}

export default ClauseEditor;
