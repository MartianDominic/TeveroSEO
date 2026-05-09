/**
 * RuleEditor - UI component for editing extraction rules
 * Phase 43: Prospect Keyword Pipeline - Scrape Configuration
 *
 * Allows users to:
 * - Define URL patterns for matching pages
 * - Configure field selectors with fallbacks
 * - Set extraction type and transforms
 * - Test rules against sample HTML
 */
import { useState, useCallback } from "react";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { Trash2, Plus, GripVertical, TestTube2 } from "lucide-react";
import type {
  ExtractionRule,
  ExtractionField,
} from "@/db/prospect-scrape-config-schema";

interface RuleEditorProps {
  rule: ExtractionRule;
  onChange: (rule: ExtractionRule) => void;
  onDelete?: () => void;
  onTest?: (rule: ExtractionRule) => void;
  isLoading?: boolean;
}

const PAGE_TYPES = [
  { value: "product", label: "Product Page" },
  { value: "category", label: "Category Page" },
  { value: "brand", label: "Brand Page" },
  { value: "other", label: "Other" },
] as const;

const FIELD_TYPES = [
  { value: "text", label: "Text Content" },
  { value: "attribute", label: "Attribute Value" },
  { value: "html", label: "HTML Content" },
] as const;

const TRANSFORMS = [
  { value: "none", label: "None" },
  { value: "trim", label: "Trim Whitespace" },
  { value: "lowercase", label: "Lowercase" },
  { value: "number", label: "Extract Number" },
  { value: "price", label: "Extract Price" },
] as const;

export function RuleEditor({
  rule,
  onChange,
  onDelete,
  onTest,
  isLoading,
}: RuleEditorProps) {
  const [expandedFields, setExpandedFields] = useState<Set<number>>(new Set());

  const updateRule = useCallback(
    (updates: Partial<ExtractionRule>) => {
      onChange({ ...rule, ...updates });
    },
    [rule, onChange],
  );

  const updateField = useCallback(
    (index: number, updates: Partial<ExtractionField>) => {
      const newFields = [...rule.fields];
      newFields[index] = { ...newFields[index], ...updates };
      updateRule({ fields: newFields });
    },
    [rule.fields, updateRule],
  );

  const addField = useCallback(() => {
    const newField: ExtractionField = {
      name: `field_${rule.fields.length + 1}`,
      selectors: [""],
      type: "text",
    };
    updateRule({ fields: [...rule.fields, newField] });
    setExpandedFields((prev) => new Set([...prev, rule.fields.length]));
  }, [rule.fields, updateRule]);

  const removeField = useCallback(
    (index: number) => {
      const newFields = rule.fields.filter((_, i) => i !== index);
      updateRule({ fields: newFields });
      setExpandedFields((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    },
    [rule.fields, updateRule],
  );

  const updateSelector = useCallback(
    (fieldIndex: number, selectorIndex: number, value: string) => {
      const newFields = [...rule.fields];
      const newSelectors = [...newFields[fieldIndex].selectors];
      newSelectors[selectorIndex] = value;
      newFields[fieldIndex] = { ...newFields[fieldIndex], selectors: newSelectors };
      updateRule({ fields: newFields });
    },
    [rule.fields, updateRule],
  );

  const addSelector = useCallback(
    (fieldIndex: number) => {
      const newFields = [...rule.fields];
      newFields[fieldIndex] = {
        ...newFields[fieldIndex],
        selectors: [...newFields[fieldIndex].selectors, ""],
      };
      updateRule({ fields: newFields });
    },
    [rule.fields, updateRule],
  );

  const removeSelector = useCallback(
    (fieldIndex: number, selectorIndex: number) => {
      const newFields = [...rule.fields];
      const newSelectors = newFields[fieldIndex].selectors.filter(
        (_, i) => i !== selectorIndex,
      );
      newFields[fieldIndex] = { ...newFields[fieldIndex], selectors: newSelectors };
      updateRule({ fields: newFields });
    },
    [rule.fields, updateRule],
  );

  const toggleField = useCallback((index: number) => {
    setExpandedFields((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  return (
    <div className="border rounded-lg p-4 space-y-4">
      {/* Rule Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
          <Input
            value={rule.name}
            onChange={(e) => updateRule({ name: e.target.value })}
            placeholder="Rule name"
            className="w-48 font-medium"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={rule.enabled}
              onChange={(e) => updateRule({ enabled: e.target.checked })}
              className="rounded border-gray-300"
            />
            Enabled
          </label>
          {onTest && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onTest(rule)}
              disabled={isLoading}
            >
              <TestTube2 className="h-4 w-4 mr-1" />
              Test
            </Button>
          )}
          {onDelete && (
            <Button variant="ghost" size="sm" onClick={onDelete}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </div>

      {/* URL Pattern & Page Type */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`pattern-${rule.id}`}>URL Pattern</Label>
          <Input
            id={`pattern-${rule.id}`}
            value={rule.urlPattern}
            onChange={(e) => updateRule({ urlPattern: e.target.value })}
            placeholder="/products/*"
          />
          <p className="text-xs-safe text-muted-foreground">
            Use glob patterns: * matches any, ** matches nested paths
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`pageType-${rule.id}`}>Page Type</Label>
          <Select
            value={rule.pageType}
            onValueChange={(value) =>
              updateRule({ pageType: value as ExtractionRule["pageType"] })
            }
          >
            <SelectTrigger id={`pageType-${rule.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Extraction Fields</Label>
          <Button variant="outline" size="sm" onClick={addField}>
            <Plus className="h-4 w-4 mr-1" />
            Add Field
          </Button>
        </div>

        <div className="space-y-2">
          {rule.fields.map((field, fieldIndex) => (
            <div
              key={fieldIndex}
              className="border rounded p-3 space-y-2 bg-muted/30"
            >
              {/* Field Header */}
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleField(fieldIndex)}
              >
                <div className="flex items-center gap-2">
                  <Input
                    value={field.name}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateField(fieldIndex, { name: e.target.value });
                    }}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Field name"
                    className="w-32 h-8"
                  />
                  <span className="text-xs-safe text-muted-foreground">
                    ({field.selectors.length} selector
                    {field.selectors.length !== 1 ? "s" : ""})
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeField(fieldIndex);
                  }}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>

              {/* Field Details (expanded) */}
              {expandedFields.has(fieldIndex) && (
                <div className="space-y-3 pt-2 border-t">
                  {/* Selectors */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs-safe">CSS Selectors</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addSelector(fieldIndex)}
                        className="h-6 text-xs-safe"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Fallback
                      </Button>
                    </div>
                    {field.selectors.map((selector, selectorIndex) => (
                      <div key={selectorIndex} className="flex items-center gap-2">
                        <span className="text-xs-safe text-muted-foreground w-16">
                          {selectorIndex === 0 ? "Primary" : `Fallback ${selectorIndex}`}
                        </span>
                        <Input
                          value={selector}
                          onChange={(e) =>
                            updateSelector(fieldIndex, selectorIndex, e.target.value)
                          }
                          placeholder=".product-title"
                          className="flex-1 h-8 font-mono text-sm"
                        />
                        {selectorIndex > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSelector(fieldIndex, selectorIndex)}
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Type & Transform */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs-safe">Type</Label>
                      <Select
                        value={field.type}
                        onValueChange={(value) =>
                          updateField(fieldIndex, {
                            type: value as ExtractionField["type"],
                          })
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {field.type === "attribute" && (
                      <div className="space-y-1">
                        <Label className="text-xs-safe">Attribute</Label>
                        <Input
                          value={field.attribute || ""}
                          onChange={(e) =>
                            updateField(fieldIndex, { attribute: e.target.value })
                          }
                          placeholder="href"
                          className="h-8"
                        />
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label className="text-xs-safe">Transform</Label>
                      <Select
                        value={field.transform || "none"}
                        onValueChange={(value) =>
                          updateField(fieldIndex, {
                            transform:
                              value === "none"
                                ? undefined
                                : (value as ExtractionField["transform"]),
                          })
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TRANSFORMS.map((transform) => (
                            <SelectItem key={transform.value} value={transform.value}>
                              {transform.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
