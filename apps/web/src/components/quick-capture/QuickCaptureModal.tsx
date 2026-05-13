"use client";

/**
 * QuickCaptureModal - Phase 101-03
 *
 * Modal for quick deal creation in < 5 seconds.
 * Per D-01: Minimal fields (domain, contact, stage), auto-focus, keyboard nav.
 */
import * as React from "react";
import { useForm } from "@tanstack/react-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@tevero/ui";
import { Loader2 } from "lucide-react";
import {
  type QuickCaptureFormData,
  PIPELINE_STAGES,
  parseContact,
  validateDomain,
  validateContact,
} from "./quick-capture-form";

interface QuickCaptureResult {
  prospectId: string;
  proposalId?: string;
  contractId?: string;
  chainCreated: string[];
}

interface QuickCaptureModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback to change open state */
  onOpenChange: (open: boolean) => void;
  /** Callback on successful creation */
  onSuccess?: (result: QuickCaptureResult) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

/**
 * Quick capture modal for < 5 second deal creation.
 *
 * Features:
 * - 3 fields: domain (auto-focus), contact, stage
 * - Tab cycles through fields naturally
 * - Escape closes modal
 * - Enter submits form
 */
export function QuickCaptureModal({
  open,
  onOpenChange,
  onSuccess,
  onError,
}: QuickCaptureModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const domainInputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm({
    defaultValues: {
      domain: "",
      contact: "",
      stage: "new" as QuickCaptureFormData["stage"],
    },
    onSubmit: async ({ value }) => {
      setIsSubmitting(true);
      try {
        const { email, phone } = parseContact(value.contact);

        const response = await fetch("/api/deals/quick-capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            domain: value.domain,
            contactEmail: email,
            contactPhone: phone,
            stage: value.stage,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `Failed to create deal (${response.status})`);
        }

        const result = await response.json();
        form.reset();
        onOpenChange(false);
        onSuccess?.(result.data);
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Unknown error");
        onError?.(err);
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  // Auto-focus domain field when modal opens
  React.useEffect(() => {
    if (open) {
      // Small delay to ensure dialog is rendered
      const timer = setTimeout(() => {
        domainInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Reset form when modal closes
  React.useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] top-[20%] translate-y-0">
        <DialogHeader>
          <DialogTitle>Quick Capture</DialogTitle>
          <DialogDescription>
            Add a new deal in seconds. You can add more details later.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-4 mt-4"
        >
          {/* Domain field - auto-focus */}
          <form.Field
            name="domain"
            validators={{
              onBlur: ({ value }) => validateDomain(value),
              onSubmit: ({ value }) => validateDomain(value),
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="qc-domain">Domain</Label>
                <Input
                  id="qc-domain"
                  placeholder="example.com"
                  ref={domainInputRef}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  className={field.state.meta.errors.length > 0 ? "border-destructive" : ""}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-sm text-destructive" role="alert">
                    {field.state.meta.errors[0]}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          {/* Contact field (email or phone) */}
          <form.Field
            name="contact"
            validators={{
              onBlur: ({ value }) => validateContact(value),
              onSubmit: ({ value }) => validateContact(value),
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="qc-contact">Contact (email or phone)</Label>
                <Input
                  id="qc-contact"
                  placeholder="john@example.com or +370..."
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  className={field.state.meta.errors.length > 0 ? "border-destructive" : ""}
                  autoComplete="off"
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-sm text-destructive" role="alert">
                    {field.state.meta.errors[0]}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          {/* Stage dropdown */}
          <form.Field name="stage">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="qc-stage">Stage</Label>
                <Select
                  value={field.state.value}
                  onValueChange={(value) => field.handleChange(value as QuickCaptureFormData["stage"])}
                >
                  <SelectTrigger id="qc-stage">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {PIPELINE_STAGES.map((stage) => (
                      <SelectItem key={stage.value} value={stage.value}>
                        {stage.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {field.state.value === "converted" && "Will create prospect, proposal, and contract records."}
                  {field.state.value === "negotiating" && "Will create prospect and proposal records."}
                </p>
              </div>
            )}
          </form.Field>

          {/* Submit button */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create deal"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
