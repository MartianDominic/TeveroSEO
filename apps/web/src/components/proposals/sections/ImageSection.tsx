"use client";

/**
 * ImageSection - Image with caption section editor.
 * Phase 57-05: Custom Sections
 *
 * Features:
 * - URL input or upload
 * - Caption field
 * - Alt text for accessibility
 */

import { type FC } from "react";
import { Image as ImageIcon, Link, Type, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface ImageSectionData {
  url: string;
  caption: string;
  alt: string;
}

export interface ImageSectionProps {
  /** Section data */
  data: ImageSectionData;
  /** Callback when data changes */
  onChange: (data: ImageSectionData) => void;
  /** Current locale */
  locale?: "en" | "lt";
  /** Whether content is editable */
  editable?: boolean;
}

const labels = {
  en: {
    imageUrl: "Image URL",
    urlPlaceholder: "https://example.com/image.jpg",
    caption: "Caption",
    captionPlaceholder: "Add a caption for this image...",
    altText: "Alt Text",
    altPlaceholder: "Describe the image for accessibility...",
    preview: "Preview",
    noImage: "Enter an image URL to see preview",
  },
  lt: {
    imageUrl: "Nuotraukos URL",
    urlPlaceholder: "https://example.com/image.jpg",
    caption: "Aprasymas",
    captionPlaceholder: "Pridekite aprasyma...",
    altText: "Alt tekstas",
    altPlaceholder: "Aprasykite nuotrauka prieinamumui...",
    preview: "Perziura",
    noImage: "Iveskite URL kad matytumete perziura",
  },
};

/**
 * ImageSection component.
 *
 * Renders an image editor with URL, caption, and alt text fields.
 */
export const ImageSection: FC<ImageSectionProps> = ({
  data,
  onChange,
  locale = "en",
  editable = true,
}) => {
  const t = labels[locale];

  const handleChange = (field: keyof ImageSectionData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-4">
      {/* Image URL input */}
      <div className="space-y-2">
        <Label htmlFor="image-url" className="flex items-center gap-2 text-sm">
          <Link className="h-4 w-4" />
          {t.imageUrl}
        </Label>
        <Input
          id="image-url"
          type="url"
          value={data.url}
          onChange={(e) => handleChange("url", e.target.value)}
          placeholder={t.urlPlaceholder}
          disabled={!editable}
        />
      </div>

      {/* Image preview */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm">
          <Eye className="h-4 w-4" />
          {t.preview}
        </Label>
        <div
          className={cn(
            "flex items-center justify-center rounded-lg border border-dashed border-border",
            "bg-muted/30 min-h-[200px] overflow-hidden"
          )}
        >
          {data.url ? (
            <img
              src={data.url}
              alt={data.alt || "Preview"}
              className="max-h-[300px] max-w-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <ImageIcon className="h-8 w-8" />
              <span className="text-sm">{t.noImage}</span>
            </div>
          )}
        </div>
      </div>

      {/* Caption */}
      <div className="space-y-2">
        <Label htmlFor="image-caption" className="flex items-center gap-2 text-sm">
          <Type className="h-4 w-4" />
          {t.caption}
        </Label>
        <Textarea
          id="image-caption"
          value={data.caption}
          onChange={(e) => handleChange("caption", e.target.value)}
          placeholder={t.captionPlaceholder}
          disabled={!editable}
          rows={2}
        />
      </div>

      {/* Alt text */}
      <div className="space-y-2">
        <Label htmlFor="image-alt" className="flex items-center gap-2 text-sm">
          {t.altText}
        </Label>
        <Input
          id="image-alt"
          type="text"
          value={data.alt}
          onChange={(e) => handleChange("alt", e.target.value)}
          placeholder={t.altPlaceholder}
          disabled={!editable}
        />
      </div>
    </div>
  );
};

export default ImageSection;
