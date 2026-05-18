"use client";

/**
 * TextSection - Rich text section editor.
 * Phase 57-05: Custom Sections
 *
 * Simple wrapper around ProposalInlineEditor for text blocks.
 */

import { type FC } from "react";

import { LazyProposalInlineEditor } from "../LazyProposalInlineEditor";

export interface TextSectionData {
  content: string;
}

export interface TextSectionProps {
  /** Section data */
  data: TextSectionData;
  /** Callback when content changes */
  onChange: (data: TextSectionData) => void;
  /** Current locale */
  locale?: "en" | "lt";
  /** Whether content is editable */
  editable?: boolean;
}

/**
 * TextSection component.
 *
 * Renders a rich text editor for free-form content.
 */
export const TextSection: FC<TextSectionProps> = ({
  data,
  onChange,
  locale = "en",
  editable = true,
}) => {
  return (
    <LazyProposalInlineEditor
      content={data.content}
      onUpdate={(content) => onChange({ content })}
      locale={locale}
      editable={editable}
      placeholder={
        locale === "lt"
          ? "Iveskite teksta..."
          : "Enter your content..."
      }
      minHeight="100px"
    />
  );
};

export default TextSection;
