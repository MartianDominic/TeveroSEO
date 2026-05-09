"use client";

/**
 * Variable Inserter Component
 * Phase 59-05: Template Editor with Drag-Drop Variables
 *
 * Draggable variable chip that can be dropped into clause editors.
 */

import { useCallback } from "react";

import { Copy, GripHorizontal } from "lucide-react";

import { Badge, Button } from "@tevero/ui";

interface VariableInserterProps {
  variable: string;
}

export function VariableInserter({ variable }: VariableInserterProps) {
  /**
   * Handle drag start - set the variable name as transfer data.
   */
  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData("text/plain", variable);
      e.dataTransfer.effectAllowed = "copy";
    },
    [variable]
  );

  /**
   * Copy the variable placeholder to clipboard.
   */
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`{{${variable}}}`);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = `{{${variable}}}`;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }
  }, [variable]);

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="group flex items-center justify-between p-2 bg-muted/50 rounded-md cursor-grab hover:bg-muted active:cursor-grabbing transition-colors"
    >
      <div className="flex items-center gap-2">
        <GripHorizontal className="w-3 h-3 text-muted-foreground opacity-50 group-hover:opacity-100" />
        <Badge variant="secondary" className="font-mono text-xs">
          {variable}
        </Badge>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleCopy}
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Copy to clipboard"
      >
        <Copy className="w-3 h-3" />
        <span className="sr-only">Copy variable</span>
      </Button>
    </div>
  );
}

export default VariableInserter;
