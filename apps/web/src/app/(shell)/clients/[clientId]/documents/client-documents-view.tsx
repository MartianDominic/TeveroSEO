/**
 * ClientDocumentsView - Client Component
 * Phase 101: Document Management (D-04)
 *
 * Handles client-side state for document interactions.
 */
"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import type { Client } from "@tevero/types";
import {
  DocumentHub,
  type DocumentData,
  type HeatmapSection,
} from "@/components/documents";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@tevero/ui";
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

// ============================================================================
// Types
// ============================================================================

interface ClientDocumentsViewProps {
  client: Client;
  clientId: string;
  initialDocuments: DocumentData[];
  initialHeatmapData?: HeatmapSection[];
}

// ============================================================================
// Component
// ============================================================================

export function ClientDocumentsView({
  client,
  clientId,
  initialDocuments,
  initialHeatmapData = [],
}: ClientDocumentsViewProps) {
  const router = useRouter();
  const [documents, setDocuments] = useState(initialDocuments);
  const [heatmapData] = useState(initialHeatmapData);
  const [isLoading, setIsLoading] = useState(false);
  const [deleteDocument, setDeleteDocument] = useState<DocumentData | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refresh documents from server
  const refreshDocuments = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/proxy/open-seo/documents?clientId=${clientId}`);
      const data = await response.json();
      if (data.success && data.data) {
        setDocuments(data.data);
      }
    } catch (err) {
      setError("Failed to refresh documents");
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  // Handle document view
  const handleViewDocument = useCallback((doc: DocumentData) => {
    if (doc.externalUrl) {
      window.open(doc.externalUrl, "_blank", "noopener,noreferrer");
    }
    // If no external URL, could show a preview modal in the future
  }, []);

  // Handle document edit (placeholder - will be implemented with modal)
  const handleEditDocument = useCallback((_doc: DocumentData) => {
    // Edit document settings - future implementation
  }, []);

  // Handle document delete
  const handleDeleteDocument = useCallback(async () => {
    if (!deleteDocument) return;

    try {
      setError(null);
      const response = await fetch(
        `/api/proxy/open-seo/documents/${deleteDocument.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Failed to delete document");
      }

      setDocuments((prev) => prev.filter((d) => d.id !== deleteDocument.id));
    } catch (err) {
      setError("Failed to delete document");
    } finally {
      setDeleteDocument(null);
    }
  }, [deleteDocument]);

  // Handle document sync
  const handleSyncDocument = useCallback(async (doc: DocumentData) => {
    try {
      setError(null);
      const response = await fetch(
        `/api/proxy/open-seo/documents/${doc.id}/sync`,
        { method: "POST" }
      );

      if (!response.ok) {
        throw new Error("Failed to sync document");
      }

      await refreshDocuments();
    } catch (err) {
      setError("Failed to sync document");
    }
  }, [refreshDocuments]);

  // Handle link from Drive
  const handleLinkDocument = useCallback(() => {
    setLinkDialogOpen(true);
  }, []);

  // Handle upload (placeholder)
  const handleUploadDocument = useCallback(() => {
    // Future implementation
  }, []);

  // Navigate to client page
  const handleNavigateToClient = useCallback(() => {
    router.push(`/clients/${clientId}` as Parameters<typeof router.push>[0]);
  }, [router, clientId]);

  return (
    <div className="space-y-6 p-6">
      {/* Error Banner */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-[14px] text-red-700">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-4 text-red-500 hover:text-red-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Breadcrumb */}
      <nav className="text-[13px] text-text-3">
        <span
          className="cursor-pointer hover:text-text-2 transition-colors"
          onClick={handleNavigateToClient}
        >
          {client.name}
        </span>
        <span className="mx-2">/</span>
        <span className="text-text-1">Documents</span>
      </nav>

      {/* Document Hub */}
      <DocumentHub
        documents={documents}
        heatmapData={heatmapData}
        clientName={client.name}
        onLinkDocument={handleLinkDocument}
        onUploadDocument={handleUploadDocument}
        onViewDocument={handleViewDocument}
        onEditDocument={handleEditDocument}
        onDeleteDocument={(doc) => setDeleteDocument(doc)}
        onSyncDocument={handleSyncDocument}
        isLoading={isLoading}
      />

      {/* Link from Drive Dialog (placeholder) */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link from Google Drive</DialogTitle>
            <DialogDescription>
              Connect your Google Drive to link files to this client.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 text-center">
            <p className="text-[14px] text-text-2">
              Google Drive integration coming soon
            </p>
            <p className="mt-2 text-[13px] text-text-3">
              Connect your workspace to Google Drive in Settings to enable file linking.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteDocument}
        onOpenChange={(open) => !open && setDeleteDocument(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove &quot;{deleteDocument?.name}&quot; from your workspace.
              {deleteDocument?.syncMode !== "link_only" &&
                " The file will remain in Google Drive."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDocument}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
