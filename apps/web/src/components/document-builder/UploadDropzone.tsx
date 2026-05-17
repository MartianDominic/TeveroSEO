/**
 * Upload Dropzone Component
 * Phase 102-07: Task 5 - Drag and drop file upload
 *
 * Provides visual feedback for file upload states:
 * - idle: Ready for file drop
 * - uploading: File being sent to server
 * - processing: Document being processed
 * - completed: Processing finished
 * - error: Upload or processing failed
 */

"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useDocumentProcessing } from "@/hooks/useDocumentProcessing";

// =============================================================================
// Types
// =============================================================================

interface UploadDropzoneProps {
  workspaceId: string;
  onUploadComplete?: (documentId: string) => void;
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

export function UploadDropzone({
  workspaceId,
  onUploadComplete,
  className,
}: UploadDropzoneProps) {
  const { upload, status, progress, error, reset } = useDocumentProcessing();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      const result = await upload(file, workspaceId);

      if (result?.documentId) {
        onUploadComplete?.(result.documentId);
      }
    },
    [upload, workspaceId, onUploadComplete]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/webp": [".webp"],
    },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024, // 20MB
    disabled: status === "uploading" || status === "processing",
  });

  // Reset state when clicking after completion or error
  const handleClick = () => {
    if (status === "completed" || status === "error") {
      reset();
    }
  };

  return (
    <div
      {...getRootProps()}
      onClick={(e) => {
        handleClick();
        getRootProps().onClick?.(e);
      }}
      className={cn(
        "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
        isDragActive
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/50",
        (status === "uploading" || status === "processing") &&
          "pointer-events-none opacity-75",
        className
      )}
    >
      <input {...getInputProps()} aria-label="Upload document file" />

      {/* Status indicator with live region for screen readers */}
      <div
        role="status"
        aria-live="polite"
        aria-label={
          status === "idle"
            ? "Ready to upload"
            : status === "uploading"
              ? "Uploading file"
              : status === "processing"
                ? `Processing document, ${progress}% complete`
                : status === "completed"
                  ? "Upload completed successfully"
                  : status === "error"
                    ? `Upload failed: ${error || "Unknown error"}`
                    : "Ready to upload"
        }
      >
        {/* Idle State */}
        {status === "idle" && (
          <>
            <Upload className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
            <p className="mt-2 text-sm text-muted-foreground">
              {isDragActive
                ? "Drop your file here"
                : "Drag & drop a PDF or DOCX, or click to select"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground/75">
              Supported: PDF, DOCX, PNG, JPG, WEBP (Max 20MB)
            </p>
          </>
        )}

        {/* Uploading State */}
        {status === "uploading" && (
          <>
            <Loader2 className="mx-auto h-12 w-12 text-primary animate-spin" aria-hidden="true" />
            <p className="mt-2 text-sm">Uploading...</p>
          </>
        )}

        {/* Processing State */}
        {status === "processing" && (
          <>
            <FileText className="mx-auto h-12 w-12 text-primary" aria-hidden="true" />
            <p className="mt-2 text-sm">Processing document...</p>
            <div
              className="mt-2 w-full max-w-xs mx-auto bg-muted rounded-full h-2"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Document processing progress"
            >
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{progress}%</p>
          </>
        )}

        {/* Completed State */}
        {status === "completed" && (
          <>
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" aria-hidden="true" />
            <p className="mt-2 text-sm text-green-600">
              Document processed successfully!
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Click to upload another file
            </p>
          </>
        )}

        {/* Error State */}
        {status === "error" && (
          <>
            <AlertCircle className="mx-auto h-12 w-12 text-destructive" aria-hidden="true" />
            <p className="mt-2 text-sm text-destructive">
              {error || "Upload failed"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Click to try again
            </p>
          </>
        )}
      </div>
    </div>
  );
}
