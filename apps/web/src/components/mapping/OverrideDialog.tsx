"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@tevero/ui";
import { Loader2 } from "lucide-react";
import { overrideMapping } from "@/actions/seo/mapping";

interface OverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyword: string;
  pages: Array<{ url: string; title: string | null }>;
  projectId: string;
  clientId: string;
  onComplete: () => void;
}

export function OverrideDialog({
  open,
  onOpenChange,
  keyword,
  pages,
  projectId,
  clientId,
  onComplete,
}: OverrideDialogProps) {
  const [selectedUrl, setSelectedUrl] = useState<string>("__create__");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const newTargetUrl = selectedUrl === "__create__" ? null : selectedUrl;
      await overrideMapping({
        projectId,
        clientId,
        keyword,
        newTargetUrl,
      });

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update mapping");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Override Mapping</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Keyword</Label>
            <p className="text-sm font-medium mt-1">{keyword}</p>
          </div>

          <div>
            <Label htmlFor="targetUrl">Target Page</Label>
            <Select value={selectedUrl} onValueChange={setSelectedUrl}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select target page" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__create__">
                  Create new page (no existing match)
                </SelectItem>
                {pages.map((page) => (
                  <SelectItem key={page.url} value={page.url}>
                    {page.title ?? page.url}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Override"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
