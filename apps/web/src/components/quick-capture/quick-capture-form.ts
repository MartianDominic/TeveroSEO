/**
 * Quick capture form schema - Phase 101-03
 *
 * Zod validation for the quick capture form fields.
 * Supports domain, contact (email or phone), and stage selection.
 */
import { z } from "zod";

/**
 * Pipeline stages available for quick capture.
 * Subset of full pipeline stages - only stages where manual entry makes sense.
 */
export const PIPELINE_STAGES = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "negotiating", label: "Negotiating" },
  { value: "converted", label: "Already Converted" },
] as const;

export type QuickCaptureStage = (typeof PIPELINE_STAGES)[number]["value"];

/**
 * Domain validation regex.
 * Allows:
 * - example.com
 * - sub.example.com
 * - example.co.uk
 * Does NOT require protocol (user can paste full URL, we strip it).
 */
const DOMAIN_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-_.]*\.[a-zA-Z]{2,}$/;

/**
 * Email validation regex.
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Phone validation regex.
 * Allows international formats with optional + prefix.
 */
const PHONE_REGEX = /^[+]?[\d\s\-()]{7,}$/;

/**
 * Quick capture form schema.
 */
export const quickCaptureSchema = z.object({
  domain: z
    .string()
    .min(1, "Domain is required")
    .transform((val) => {
      // Strip protocol and www for validation
      let normalized = val.toLowerCase().trim();
      normalized = normalized.replace(/^https?:\/\//, "");
      normalized = normalized.replace(/^www\./, "");
      normalized = normalized.split("/")[0];
      normalized = normalized.split(":")[0];
      return normalized;
    })
    .refine((val) => DOMAIN_REGEX.test(val), {
      message: "Enter a valid domain (e.g., example.com)",
    }),
  contact: z
    .string()
    .min(1, "Contact is required")
    .refine(
      (val) => {
        // Accept email or phone
        return EMAIL_REGEX.test(val) || PHONE_REGEX.test(val);
      },
      { message: "Enter a valid email or phone number" }
    ),
  stage: z.enum(["new", "contacted", "negotiating", "converted"]).default("new"),
});

export type QuickCaptureFormData = z.infer<typeof quickCaptureSchema>;

/**
 * Parse contact field to determine if email or phone.
 */
export function parseContact(contact: string): {
  email?: string;
  phone?: string;
} {
  if (EMAIL_REGEX.test(contact)) {
    return { email: contact };
  }
  return { phone: contact };
}

/**
 * Validate domain field for @tanstack/react-form.
 */
export function validateDomain(value: string): string | undefined {
  if (!value || value.trim() === "") {
    return "Domain is required";
  }
  // Normalize domain
  let normalized = value.toLowerCase().trim();
  normalized = normalized.replace(/^https?:\/\//, "");
  normalized = normalized.replace(/^www\./, "");
  normalized = normalized.split("/")[0];
  normalized = normalized.split(":")[0];

  if (!DOMAIN_REGEX.test(normalized)) {
    return "Enter a valid domain (e.g., example.com)";
  }
  return undefined;
}

/**
 * Validate contact field for @tanstack/react-form.
 */
export function validateContact(value: string): string | undefined {
  if (!value || value.trim() === "") {
    return "Contact is required";
  }
  if (!EMAIL_REGEX.test(value) && !PHONE_REGEX.test(value)) {
    return "Enter a valid email or phone number";
  }
  return undefined;
}
