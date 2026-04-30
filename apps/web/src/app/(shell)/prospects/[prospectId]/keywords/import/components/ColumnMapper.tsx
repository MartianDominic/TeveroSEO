"use client";

/**
 * ColumnMapper Component
 * Phase 43-03: CSV Import + Metric Detection
 *
 * Displays detected column mappings and allows manual override.
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@tevero/ui";
import type { ColumnMapping } from "../actions";

const FIELD_OPTIONS = [
  { value: "keyword", label: "Keyword" },
  { value: "volume", label: "Search Volume" },
  { value: "difficulty", label: "Difficulty" },
  { value: "cpc", label: "CPC" },
  { value: "position", label: "Position" },
  { value: "url", label: "URL" },
  { value: "ignore", label: "(Ignore)" },
] as const;

interface ColumnMapperProps {
  mappings: ColumnMapping[];
  onChange: (mappings: ColumnMapping[]) => void;
}

export function ColumnMapper({ mappings, onChange }: ColumnMapperProps) {
  const handleChange = (
    index: number,
    newField: ColumnMapping["targetField"]
  ) => {
    const updated = [...mappings];
    updated[index] = { ...updated[index], targetField: newField };
    onChange(updated);
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.9) {
      return (
        <Badge className="ml-2 text-[12px] bg-success-soft text-success">
          Auto
        </Badge>
      );
    }
    if (confidence >= 0.7) {
      return (
        <Badge className="ml-2 text-[12px] bg-info-soft text-info">
          Likely
        </Badge>
      );
    }
    return null;
  };

  return (
    <div className="rounded-[var(--radius-card)] shadow-card bg-surface overflow-hidden">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Your Column</TableHead>
          <TableHead>Maps To</TableHead>
          <TableHead>Sample</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {mappings.map((mapping, idx) => (
          <TableRow key={idx}>
            <TableCell className="font-medium">
              {mapping.sourceColumn}
              {getConfidenceBadge(mapping.confidence)}
            </TableCell>
            <TableCell>
              <Select
                value={mapping.targetField}
                onValueChange={(val) =>
                  handleChange(idx, val as ColumnMapping["targetField"])
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell className="text-text-3 text-[12px] truncate max-w-[200px]">
              {mapping.sampleValue}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>
  );
}
