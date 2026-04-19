"use client";

import { useCallback, useState, useRef } from "react";
import { Upload, X, Loader2, ImageIcon } from "lucide-react";
import { Button } from "@tevero/ui";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/svg+xml"];
const ALLOWED_EXTENSIONS = ".png, .jpg, .jpeg, .svg";

interface LogoUploadProps {
  /** Current logo URL (null if no logo) */
  currentLogoUrl: string | null;
  /** Called when logo is selected for upload */
  onUpload: (file: File) => Promise<void>;
  /** Called when logo should be deleted */
  onDelete: () => Promise<void>;
  /** Whether upload/delete is in progress */
  isLoading?: boolean;
  /** Whether the control is disabled */
  disabled?: boolean;
}

/**
 * Logo upload component with drag-and-drop support.
 *
 * - Accepts PNG, JPG, SVG under 2MB
 * - Shows preview of current logo
 * - Drag-drop or click to select
 */
export function LogoUpload({
  currentLogoUrl,
  onUpload,
  onDelete,
  isLoading = false,
  disabled = false,
}: LogoUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS}`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return "File too large. Maximum size is 2MB.";
    }
    return null;
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }
      try {
        await onUpload(file);
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [onUpload, validateFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (disabled || isLoading) return;

      const file = e.dataTransfer.files[0];
      if (file) {
        await handleFile(file);
      }
    },
    [disabled, isLoading, handleFile],
  );

  const handleInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        await handleFile(file);
      }
      // Reset input so the same file can be selected again
      e.target.value = "";
    },
    [handleFile],
  );

  const handleDelete = useCallback(async () => {
    setError(null);
    try {
      await onDelete();
    } catch (err) {
      setError((err as Error).message);
    }
  }, [onDelete]);

  const handleClick = useCallback(() => {
    if (!disabled && !isLoading) {
      fileInputRef.current?.click();
    }
  }, [disabled, isLoading]);

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          relative flex flex-col items-center justify-center
          border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer
          ${isDragOver ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50"}
          ${disabled || isLoading ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        {isLoading ? (
          <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
        ) : currentLogoUrl ? (
          <div className="flex flex-col items-center gap-3">
            <img
              src={currentLogoUrl}
              alt="Current logo"
              className="max-h-16 max-w-[200px] object-contain"
            />
            <p className="text-sm text-muted-foreground">
              Drop new logo or click to replace
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <div className="rounded-full bg-muted p-3">
              {isDragOver ? (
                <Upload className="h-6 w-6" />
              ) : (
                <ImageIcon className="h-6 w-6" />
              )}
            </div>
            <p className="text-sm font-medium">
              {isDragOver ? "Drop logo here" : "Upload logo"}
            </p>
            <p className="text-xs">
              PNG, JPG, or SVG (max 2MB, 200x60px recommended)
            </p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS}
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled || isLoading}
        />
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Delete button (shown when logo exists) */}
      {currentLogoUrl && !isLoading && (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleDelete();
          }}
          disabled={disabled}
          className="text-destructive hover:text-destructive"
        >
          <X className="h-4 w-4 mr-1.5" />
          Remove logo
        </Button>
      )}
    </div>
  );
}
