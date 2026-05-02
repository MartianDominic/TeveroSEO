"use client";

/**
 * Preview Pane Component
 * Phase 59-05: Template Editor with Drag-Drop Variables
 *
 * Live preview of template with resolved sample data.
 * Shows visual feedback for resolved vs unknown variables.
 *
 * SECURITY: Uses DOMPurify with restricted ALLOWED_TAGS.
 * Source: admin-created template content + hardcoded sample data.
 */

import { useMemo } from "react";
import DOMPurify from "dompurify";
import { Card, CardContent, CardHeader } from "@tevero/ui";
import { AlertCircle, CheckCircle } from "lucide-react";
import type { TemplateClause } from "@/app/[locale]/(shell)/templates/[templateId]/edit/actions";

interface PreviewPaneProps {
  clauses: TemplateClause[];
  order: string[];
}

/**
 * Sample data for preview - matches 59-03 variable structure.
 * All values are static/fake, not real client data.
 */
const SAMPLE_DATA: Record<string, string> = {
  // Client
  "client.name": "John Smith",
  "client.company": "Smith & Co.",
  "client.email": "john@smithco.com",
  "client.phone": "+1 555-0123",
  "client.address": "123 Main St, New York, NY 10001",

  // Provider
  "provider.name": "Acme Services",
  "provider.company": "Acme Services LLC",
  "provider.email": "hello@acme.com",
  "provider.phone": "+1 555-0456",
  "provider.address": "456 Oak Ave, San Francisco, CA 94102",

  // Services
  "services.list": "SEO Audit, Content Strategy, Link Building",
  "services.total": "$5,000.00",
  "services.breakdown":
    "SEO Audit: $2,000 | Content Strategy: $1,500 | Link Building: $1,500",

  // Agreement
  "agreement.date": "May 2, 2026",
  "agreement.validUntil": "May 2, 2027",
  "agreement.number": "AGR-2026-0042",

  // Signer
  "signer.name": "John Smith",
  "signer.email": "john@smithco.com",
  "signer.role": "CEO",

  // Payment
  "payment.amount": "$5,000.00",
  "payment.currency": "USD",
  "payment.dueDate": "May 15, 2026",
  "payment.method": "Bank Transfer",
};

/**
 * Sanitize HTML with DOMPurify using restricted allowed tags.
 * Defense-in-depth: even though source is admin-created, we sanitize.
 */
function sanitizeHtml(html: string): string {
  // Only allow safe formatting tags - no scripts, iframes, etc.
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["p", "br", "strong", "em", "span", "ul", "ol", "li", "b", "i"],
    ALLOWED_ATTR: ["class"],
  });
}

/**
 * Resolve variables in content with sample data.
 * Returns HTML with colored spans for resolved/unknown variables.
 */
function resolveVariables(content: string): {
  html: string;
  resolvedCount: number;
  unknownCount: number;
  unknownVars: string[];
} {
  let resolvedCount = 0;
  let unknownCount = 0;
  const unknownVars: string[] = [];

  const html = content.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
    const trimmedVar = variable.trim();
    const value = SAMPLE_DATA[trimmedVar];

    if (value) {
      resolvedCount++;
      // Escape HTML entities in the value
      const escapedValue = value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
      return `<span class="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 px-1 rounded font-medium">${escapedValue}</span>`;
    } else {
      unknownCount++;
      unknownVars.push(trimmedVar);
      // Escape the original match for safety
      const escapedMatch = match
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<span class="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 px-1 rounded font-medium">${escapedMatch}</span>`;
    }
  });

  return { html, resolvedCount, unknownCount, unknownVars };
}

/**
 * Convert plain text to paragraph HTML.
 * Preserves line breaks as <br> tags.
 */
function textToHtml(text: string): string {
  return text
    .split("\n\n")
    .map((para) => `<p>${para.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function PreviewPane({ clauses, order }: PreviewPaneProps) {
  /**
   * Order and resolve clauses.
   */
  const resolvedClauses = useMemo(() => {
    return order
      .map((id) => clauses.find((c) => c.id === id))
      .filter((c): c is TemplateClause => c !== undefined)
      .map((clause) => {
        const contentHtml = textToHtml(clause.content);
        const resolved = resolveVariables(contentHtml);
        return {
          ...clause,
          resolvedHtml: sanitizeHtml(resolved.html),
          resolvedCount: resolved.resolvedCount,
          unknownCount: resolved.unknownCount,
          unknownVars: resolved.unknownVars,
        };
      });
  }, [clauses, order]);

  /**
   * Calculate totals.
   */
  const totals = useMemo(() => {
    return resolvedClauses.reduce(
      (acc, clause) => ({
        resolved: acc.resolved + clause.resolvedCount,
        unknown: acc.unknown + clause.unknownCount,
      }),
      { resolved: 0, unknown: 0 }
    );
  }, [resolvedClauses]);

  if (resolvedClauses.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No clauses to preview.</p>
        <p className="text-sm mt-2">Add clauses in the Edit tab first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Preview info banner */}
      <div className="flex flex-wrap items-center gap-4 p-3 bg-muted/50 rounded-lg text-sm">
        <span className="font-medium">Preview with sample data</span>
        <div className="flex items-center gap-4 ml-auto">
          <span className="flex items-center gap-1 text-green-700 dark:text-green-400">
            <CheckCircle className="w-4 h-4" />
            {totals.resolved} resolved
          </span>
          {totals.unknown > 0 && (
            <span className="flex items-center gap-1 text-red-700 dark:text-red-400">
              <AlertCircle className="w-4 h-4" />
              {totals.unknown} unknown
            </span>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-2">
          <span className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 px-2 py-0.5 rounded">
            Sample Value
          </span>
          <span className="text-muted-foreground">= Resolved variable</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 px-2 py-0.5 rounded">
            {"{{unknown}}"}
          </span>
          <span className="text-muted-foreground">= Unknown variable</span>
        </div>
      </div>

      {/* Clauses preview */}
      <div className="space-y-4">
        {resolvedClauses.map((clause, index) => (
          <Card key={clause.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                    {index + 1}
                  </span>
                  <h3 className="font-medium">{clause.title}</h3>
                </div>
                {clause.isLegal && (
                  <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                    Legal
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/*
                SECURITY: Content is sanitized via DOMPurify with restricted ALLOWED_TAGS
                Source: admin-created template content + hardcoded sample data
                The sanitizeHtml() function above uses DOMPurify.sanitize() with only safe tags
              */}
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: clause.resolvedHtml }}
              />
              {clause.unknownCount > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-red-600 dark:text-red-400">
                    <strong>Unknown variables:</strong>{" "}
                    {clause.unknownVars.join(", ")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default PreviewPane;
