"use client";

/**
 * RuleEditor Component
 * Phase 43-05: Custom extraction rule editor
 *
 * Allows users to create and edit extraction rules with:
 * - URL patterns (glob format)
 * - Multiple fields with selectors and fallbacks
 * - Field types (text, attribute, html)
 * - Transform functions (trim, lowercase, number, price)
 */

import { useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Badge,
} from "@tevero/ui";
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp } from "lucide-react";
import { nanoid } from "nanoid";
import type { ExtractionRule, ExtractionField } from "../actions";

interface RuleEditorProps {
  rule: ExtractionRule;
  onChange: (rule: ExtractionRule) => void;
  onDelete?: () => void;
  onTest?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

const PAGE_TYPES = [
  { value: "product", label: "Product" },
  { value: "category", label: "Category" },
  { value: "brand", label: "Brand" },
  { value: "other", label: "Other" },
] as const;

const FIELD_TYPES = [
  { value: "text", label: "Text Content" },
  { value: "attribute", label: "Attribute" },
  { value: "html", label: "Inner HTML" },
] as const;

const TRANSFORM_OPTIONS = [
  { value: "", label: "None" },
  { value: "trim", label: "Trim Whitespace" },
  { value: "lowercase", label: "Lowercase" },
  { value: "number", label: "Extract Number" },
  { value: "price", label: "Extract Price" },
] as const;

function FieldEditor({
  field,
  onChange,
  onDelete,
}: {
  field: ExtractionField;
  onChange: (field: ExtractionField) => void;
  onDelete: () => void;
}) {
  const updateField = (updates: Partial<ExtractionField>) => {
    onChange({ ...field, ...updates });
  };

  const addSelector = () => {
    updateField({ selectors: [...field.selectors, ""] });
  };

  const updateSelector = (index: number, value: string) => {
    const newSelectors = [...field.selectors];
    newSelectors[index] = value;
    updateField({ selectors: newSelectors });
  };

  const removeSelector = (index: number) => {
    if (field.selectors.length === 1) return;
    const newSelectors = field.selectors.filter((_, i) => i !== index);
    updateField({ selectors: newSelectors });
  };

  return (
    <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Field Name</Label>
            <Input
              value={field.name}
              onChange={(e) => updateField({ name: e.target.value })}
              placeholder="e.g., title, price, brand"
              className="h-8"
            />
          </div>
          <div>
            <Label className="text-xs">Type</Label>
            <Select
              value={field.type}
              onValueChange={(v) =>
                updateField({ type: v as ExtractionField["type"] })
              }
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-destructive hover:text-destructive h-8"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {field.type === "attribute" && (
        <div>
          <Label className="text-xs">Attribute Name</Label>
          <Input
            value={field.attribute || ""}
            onChange={(e) => updateField({ attribute: e.target.value })}
            placeholder="e.g., href, src, data-sku"
            className="h-8"
          />
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1">
          <Label className="text-xs">
            CSS Selectors (first match wins, fallbacks below)
          </Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={addSelector}
            className="h-6 text-xs"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Fallback
          </Button>
        </div>
        <div className="space-y-2">
          {field.selectors.map((selector, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <Input
                value={selector}
                onChange={(e) => updateSelector(idx, e.target.value)}
                placeholder={
                  idx === 0
                    ? "Primary selector, e.g., .product-title"
                    : "Fallback selector"
                }
                className="h-8 flex-1"
              />
              {idx === 0 && (
                <Badge variant="secondary" className="text-xs">
                  Primary
                </Badge>
              )}
              {field.selectors.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeSelector(idx)}
                  className="h-8 w-8 p-0"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-xs">Transform</Label>
        <Select
          value={field.transform || ""}
          onValueChange={(v) =>
            updateField({
              transform: v ? (v as ExtractionField["transform"]) : undefined,
            })
          }
        >
          <SelectTrigger className="h-8">
            <SelectValue placeholder="No transformation" />
          </SelectTrigger>
          <SelectContent>
            {TRANSFORM_OPTIONS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function RuleEditor({
  rule,
  onChange,
  onDelete,
  onTest,
  isExpanded = true,
  onToggleExpand,
}: RuleEditorProps) {
  const updateRule = (updates: Partial<ExtractionRule>) => {
    onChange({ ...rule, ...updates });
  };

  const addField = () => {
    const newField: ExtractionField = {
      name: "",
      selectors: [""],
      type: "text",
    };
    updateRule({ fields: [...rule.fields, newField] });
  };

  const updateField = (index: number, field: ExtractionField) => {
    const newFields = [...rule.fields];
    newFields[index] = field;
    updateRule({ fields: newFields });
  };

  const removeField = (index: number) => {
    if (rule.fields.length === 1) return;
    const newFields = rule.fields.filter((_, i) => i !== index);
    updateRule({ fields: newFields });
  };

  return (
    <Card className={!rule.enabled ? "opacity-60" : undefined}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Switch
              checked={rule.enabled}
              onCheckedChange={(enabled) => updateRule({ enabled })}
            />
            <CardTitle className="text-base font-medium">
              {rule.name || "Untitled Rule"}
            </CardTitle>
            <Badge variant="outline">{rule.pageType}</Badge>
          </div>
          <div className="flex items-center gap-2">
            {onTest && (
              <Button variant="outline" size="sm" onClick={onTest}>
                Test Rule
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            {onToggleExpand && (
              <Button variant="ghost" size="sm" onClick={onToggleExpand}>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Rule Name</Label>
              <Input
                value={rule.name}
                onChange={(e) => updateRule({ name: e.target.value })}
                placeholder="e.g., Product Pages"
              />
            </div>
            <div>
              <Label>Page Type</Label>
              <Select
                value={rule.pageType}
                onValueChange={(v) =>
                  updateRule({ pageType: v as ExtractionRule["pageType"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>URL Pattern (glob)</Label>
            <Input
              value={rule.urlPattern}
              onChange={(e) => updateRule({ urlPattern: e.target.value })}
              placeholder="e.g., /products/*, /collections/*"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Use * for wildcards. Example: /products/* matches all product URLs.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <Label>Extraction Fields</Label>
              <Button variant="outline" size="sm" onClick={addField}>
                <Plus className="h-4 w-4 mr-1" />
                Add Field
              </Button>
            </div>
            <div className="space-y-3">
              {rule.fields.map((field, idx) => (
                <FieldEditor
                  key={idx}
                  field={field}
                  onChange={(f) => updateField(idx, f)}
                  onDelete={() => removeField(idx)}
                />
              ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/**
 * Create a new empty extraction rule.
 */
export function createEmptyRule(): ExtractionRule {
  return {
    id: `rule_${nanoid(8)}`,
    name: "",
    urlPattern: "",
    pageType: "product",
    fields: [
      {
        name: "title",
        selectors: [".product-title", "h1"],
        type: "text",
        transform: "trim",
      },
      {
        name: "price",
        selectors: [".product-price", ".price"],
        type: "text",
        transform: "price",
      },
    ],
    enabled: true,
  };
}
