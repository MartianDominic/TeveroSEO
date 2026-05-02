"use client";

/**
 * Contract content viewer with sanitized HTML.
 * Phase 59: Agreement & Signing Excellence
 *
 * Displays contract sections with DOMPurify sanitization
 * to prevent XSS attacks per T-59-04-04.
 *
 * SECURITY: All HTML content is sanitized via DOMPurify.sanitize()
 * with restricted ALLOWED_TAGS before rendering.
 */
import DOMPurify from "dompurify";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Section {
  title: string;
  content: string;
}

interface ContractViewerProps {
  title: string;
  sections: Section[];
}

/**
 * Allowed HTML tags for contract content.
 * Restricted set per T-59-04-04 to prevent XSS.
 */
const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "ul",
  "ol",
  "li",
  "h4",
  "h5",
  "span",
  "div",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
];

const ALLOWED_ATTR = ["class", "style"];

export function ContractViewer({ title, sections }: ContractViewerProps) {
  return (
    <Card className="mb-8">
      <CardHeader className="border-b">
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="prose prose-sm max-w-none py-6">
        {sections.map((section, index) => (
          <div key={index} className="mb-6 last:mb-0">
            {section.title && (
              <h3 className="text-lg font-semibold mb-3 text-gray-900">
                {section.title}
              </h3>
            )}
            <div
              className="text-gray-700 leading-relaxed"
              // SECURITY: Content sanitized via DOMPurify with restricted tags
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(section.content, {
                  ALLOWED_TAGS,
                  ALLOWED_ATTR,
                }),
              }}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
