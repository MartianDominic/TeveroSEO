"use client";

import { useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Textarea,
  cn,
} from "@tevero/ui";
import { RefreshCw, Save, GripVertical, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import type { GeneratedSection } from "../actions";
import { regenerateSection, updateSection } from "../actions";

interface SectionEditorProps {
  proposalId: string;
  section: GeneratedSection;
  onUpdate: (section: GeneratedSection) => void;
}

export function SectionEditor({
  proposalId,
  section,
  onUpdate,
}: SectionEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [content, setContent] = useState(section.content);
  const [isPending, startTransition] = useTransition();

  const handleRegenerate = () => {
    startTransition(async () => {
      const newSection = await regenerateSection(proposalId, section.type);
      setContent(newSection.content);
      onUpdate(newSection);
    });
  };

  const handleSave = () => {
    startTransition(async () => {
      await updateSection(proposalId, section.type, content);
      onUpdate({ ...section, content });
      setIsEditing(false);
    });
  };

  const handleCancel = () => {
    setContent(section.content);
    setIsEditing(false);
  };

  return (
    <Card className="group">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardTitle className="text-base">{section.title}</CardTitle>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {section.language === "lt" ? "LT" : "EN"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRegenerate}
              disabled={isPending}
            >
              <RefreshCw
                className={cn("h-4 w-4 mr-1", isPending && "animate-spin")}
              />
              Regenerate
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent>
          {isEditing ? (
            <div className="space-y-3">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isPending}>
                  <Save className="h-4 w-4 mr-1" />
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <div className="relative group/content">
              <div className="prose prose-sm max-w-none p-3 rounded-md whitespace-pre-wrap">
                {content}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 opacity-0 group-hover/content:opacity-100 transition-opacity"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
