"use client";

/**
 * TestimonialSection - Quote with attribution section editor.
 * Phase 57-05: Custom Sections
 *
 * Features:
 * - Quote textarea
 * - Author name
 * - Company name
 * - Optional author image
 */

import { type FC } from "react";
import { Quote, User, Building2, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface TestimonialSectionData {
  quote: string;
  author: string;
  company: string;
  image?: string;
}

export interface TestimonialSectionProps {
  /** Section data */
  data: TestimonialSectionData;
  /** Callback when data changes */
  onChange: (data: TestimonialSectionData) => void;
  /** Current locale */
  locale?: "en" | "lt";
  /** Whether content is editable */
  editable?: boolean;
}

const labels = {
  en: {
    quote: "Quote",
    quotePlaceholder: "Enter the testimonial quote...",
    author: "Author Name",
    authorPlaceholder: "John Smith",
    company: "Company",
    companyPlaceholder: "Acme Corp",
    image: "Author Image URL (optional)",
    imagePlaceholder: "https://example.com/avatar.jpg",
  },
  lt: {
    quote: "Citata",
    quotePlaceholder: "Iveskite atsiliepimo citata...",
    author: "Autoriaus vardas",
    authorPlaceholder: "Jonas Jonaitis",
    company: "Imone",
    companyPlaceholder: "UAB Imone",
    image: "Autoriaus nuotraukos URL (neprivaloma)",
    imagePlaceholder: "https://example.com/avatar.jpg",
  },
};

/**
 * TestimonialSection component.
 *
 * Renders a testimonial editor with quote, author, company, and optional image.
 */
export const TestimonialSection: FC<TestimonialSectionProps> = ({
  data,
  onChange,
  locale = "en",
  editable = true,
}) => {
  const t = labels[locale];

  const handleChange = (field: keyof TestimonialSectionData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-4">
      {/* Preview card */}
      <div
        className={cn(
          "rounded-lg border border-border bg-muted/20 p-4",
          "relative"
        )}
      >
        <Quote className="absolute left-3 top-3 h-6 w-6 text-muted-foreground/30" />
        <blockquote className="pl-8 italic text-foreground/80">
          {data.quote || (
            <span className="text-muted-foreground">
              {t.quotePlaceholder}
            </span>
          )}
        </blockquote>
        <div className="mt-4 flex items-center gap-3 pl-8">
          {data.image ? (
            <img
              src={data.image}
              alt={data.author}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <User className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div>
            <div className="font-medium text-sm">
              {data.author || (
                <span className="text-muted-foreground">{t.authorPlaceholder}</span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {data.company || t.companyPlaceholder}
            </div>
          </div>
        </div>
      </div>

      {/* Quote input */}
      <div className="space-y-2">
        <Label htmlFor="quote" className="flex items-center gap-2 text-sm">
          <Quote className="h-4 w-4" />
          {t.quote}
        </Label>
        <Textarea
          id="quote"
          value={data.quote}
          onChange={(e) => handleChange("quote", e.target.value)}
          placeholder={t.quotePlaceholder}
          disabled={!editable}
          rows={3}
        />
      </div>

      {/* Author and company row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="author" className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4" />
            {t.author}
          </Label>
          <Input
            id="author"
            type="text"
            value={data.author}
            onChange={(e) => handleChange("author", e.target.value)}
            placeholder={t.authorPlaceholder}
            disabled={!editable}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="company" className="flex items-center gap-2 text-sm">
            <Building2 className="h-4 w-4" />
            {t.company}
          </Label>
          <Input
            id="company"
            type="text"
            value={data.company}
            onChange={(e) => handleChange("company", e.target.value)}
            placeholder={t.companyPlaceholder}
            disabled={!editable}
          />
        </div>
      </div>

      {/* Author image */}
      <div className="space-y-2">
        <Label htmlFor="author-image" className="flex items-center gap-2 text-sm">
          <ImageIcon className="h-4 w-4" />
          {t.image}
        </Label>
        <Input
          id="author-image"
          type="url"
          value={data.image || ""}
          onChange={(e) => handleChange("image", e.target.value)}
          placeholder={t.imagePlaceholder}
          disabled={!editable}
        />
      </div>
    </div>
  );
};

export default TestimonialSection;
