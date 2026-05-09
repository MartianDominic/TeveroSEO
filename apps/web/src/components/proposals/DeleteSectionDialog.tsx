"use client";

/**
 * DeleteSectionDialog - Confirmation dialog for section deletion.
 * Phase 57-05: Custom Sections
 *
 * Features:
 * - "Are you sure?" message (localized)
 * - Cancel / Delete buttons
 * - Controlled open state
 */

import { type FC } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@tevero/ui";

export interface DeleteSectionDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Section title for display */
  sectionTitle?: string;
  /** Callback when delete is confirmed */
  onConfirm: () => void;
  /** Current locale */
  locale?: "en" | "lt";
  /** Whether delete is in progress */
  loading?: boolean;
}

const labels = {
  en: {
    title: "Delete Section",
    description: "Are you sure you want to delete this section?",
    descriptionWithTitle: "Are you sure you want to delete",
    warning: "This action cannot be undone.",
    cancel: "Cancel",
    delete: "Delete",
    deleting: "Deleting...",
  },
  lt: {
    title: "Istrinti sekcija",
    description: "Ar tikrai norite istrinti sia sekcija?",
    descriptionWithTitle: "Ar tikrai norite istrinti",
    warning: "Sio veiksmo negalima atstatyti.",
    cancel: "Atsaukti",
    delete: "Istrinti",
    deleting: "Istrinama...",
  },
};

/**
 * DeleteSectionDialog component.
 *
 * Renders a confirmation dialog for deleting a proposal section.
 */
export const DeleteSectionDialog: FC<DeleteSectionDialogProps> = ({
  open,
  onOpenChange,
  sectionTitle,
  onConfirm,
  locale = "en",
  loading = false,
}) => {
  const t = labels[locale];

  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {sectionTitle ? (
              <>
                {t.descriptionWithTitle} <strong>&ldquo;{sectionTitle}&rdquo;</strong>?
              </>
            ) : (
              t.description
            )}
            <br />
            <span className="text-destructive">{t.warning}</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{t.cancel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? t.deleting : t.delete}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteSectionDialog;
