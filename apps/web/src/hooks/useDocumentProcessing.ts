/**
 * useDocumentProcessing Hook
 * Phase 102-07: Task 5 - Document upload and processing state management
 *
 * Manages the full document upload lifecycle:
 * 1. Upload file to API
 * 2. Poll for processing progress
 * 3. Return final status
 */

import { useState, useCallback, useEffect, useRef } from "react";

// =============================================================================
// Types
// =============================================================================

type ProcessingStatus = "idle" | "uploading" | "processing" | "completed" | "error";

interface UploadResult {
  documentId: string;
  status: string;
}

interface DocumentStatus {
  id: string;
  fileName: string;
  status: string;
  progress: number;
  error: string | null;
  ocrTier: string | null;
  confidence: number | null;
}

interface UseDocumentProcessingReturn {
  /** Upload a file and start processing */
  upload: (file: File, workspaceId: string) => Promise<UploadResult | null>;
  /** Current processing status */
  status: ProcessingStatus;
  /** Processing progress (0-100) */
  progress: number;
  /** Error message if status is 'error' */
  error: string | null;
  /** Document ID after upload */
  documentId: string | null;
  /** Reset state to idle */
  reset: () => void;
}

// =============================================================================
// Hook
// =============================================================================

export function useDocumentProcessing(): UseDocumentProcessingReturn {
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);

  // Use ref to track polling interval for cleanup
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Upload a document to the API.
   */
  const upload = useCallback(
    async (file: File, workspaceId: string): Promise<UploadResult | null> => {
      // Reset state
      setStatus("uploading");
      setError(null);
      setProgress(0);
      setDocumentId(null);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("workspaceId", workspaceId);

        const response = await fetch("/api/documents/upload", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Upload failed");
        }

        setDocumentId(data.documentId);
        setStatus("processing");

        return data as UploadResult;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
        setStatus("error");
        return null;
      }
    },
    []
  );

  /**
   * Poll for processing progress.
   */
  useEffect(() => {
    if (status !== "processing" || !documentId) {
      return;
    }

    // Clear any existing interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/documents/upload?documentId=${documentId}`
        );

        if (!response.ok) {
          throw new Error("Failed to get status");
        }

        const data: DocumentStatus = await response.json();

        setProgress(data.progress || 0);

        if (data.status === "completed") {
          setStatus("completed");
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        } else if (data.status === "failed") {
          setError(data.error || "Processing failed");
          setStatus("error");
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      } catch {
        // Ignore polling errors - will retry on next interval
      }
    }, 1000);

    // Cleanup on unmount or status change
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [status, documentId]);

  /**
   * Reset state to idle.
   */
  const reset = useCallback(() => {
    setStatus("idle");
    setProgress(0);
    setError(null);
    setDocumentId(null);

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  return { upload, status, progress, error, documentId, reset };
}
