"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Image as ImageIcon, Loader2, Paperclip } from "lucide-react";

import {
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Textarea,
} from "@tevero/ui";

// Stores and API
import { useArticleEditorStore } from "@/stores";
import { apiPost, apiPatch } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Model constants — display names mapped to model IDs
// ---------------------------------------------------------------------------

interface ImageModel {
  id: string;
  label: string;
}

const IMAGE_MODELS: ImageModel[] = [
  { id: "imagen-4.0-fast-generate-001", label: "Imagen 4 Fast" },
  { id: "imagen-4.0-generate-001", label: "Imagen 4 Standard" },
  { id: "imagen-4.0-ultra-generate-001", label: "Imagen 4 Ultra" },
  { id: "gemini-2.5-flash-image", label: "Nano Banana" },
  { id: "gemini-3.1-flash-image-preview", label: "Nano Banana 2" },
  { id: "gemini-3-pro-image-preview", label: "Nano Banana Pro" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildDefaultPrompt(title: string, keyword: string): string {
  const parts: string[] = ["Professional illustration for article"];
  if (title.trim()) {
    parts.push(`"${title.trim()}"`);
  }
  if (keyword.trim()) {
    parts.push(`Topic: ${keyword.trim()}`);
  }
  parts.push("High quality, editorial style.");
  return parts.join(". ");
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ImageGenerationPanelProps {
  articleId: string | null;
  title: string;
  keyword: string;
  clientId: string | null;
  onToast: (message: string, type: "success" | "error") => void;
}

// ---------------------------------------------------------------------------
// ImageGenerationPanel
// ---------------------------------------------------------------------------

export function ImageGenerationPanel({
  articleId,
  title,
  keyword,
  clientId,
  onToast,
}: ImageGenerationPanelProps) {
  const {
    generatedImageUrl,
    imageGenerating,
    setGeneratedImageUrl,
    setImageGenerating,
  } = useArticleEditorStore();

  // Local state
  const [selectedModel, setSelectedModel] = useState<string>(IMAGE_MODELS[0].id);
  const [prompt, setPrompt] = useState<string>("");
  const [attaching, setAttaching] = useState(false);

  // Sync prompt whenever title/keyword change (only if user hasn't customized it)
  const [promptCustomized, setPromptCustomized] = useState(false);

  useEffect(() => {
    if (!promptCustomized) {
      setPrompt(buildDefaultPrompt(title, keyword));
    }
  }, [title, keyword, promptCustomized]);

  // Reset customization flag when a new article loads (articleId changes)
  useEffect(() => {
    setPromptCustomized(false);
    setPrompt(buildDefaultPrompt(title, keyword));
    // We intentionally exclude title/keyword from deps here — this only fires
    // on article identity change, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId]);

  // ---------------------------------------------------------------------------
  // Generate image
  // ---------------------------------------------------------------------------

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;

    setImageGenerating(true);
    setGeneratedImageUrl(null);

    try {
      const body: Record<string, unknown> = {
        model_id: selectedModel,
        prompt: prompt.trim(),
      };
      if (articleId) {
        body.article_id = articleId;
      }

      const data = await apiPost<{ image_url: string }>(
        "/api/article-images/generate",
        body
      );
      setGeneratedImageUrl(data.image_url);
      onToast("Image generated.", "success");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Image generation failed.";
      onToast(message, "error");
    } finally {
      setImageGenerating(false);
    }
  }, [prompt, selectedModel, articleId, setImageGenerating, setGeneratedImageUrl, onToast]);

  // ---------------------------------------------------------------------------
  // Attach image to article
  // ---------------------------------------------------------------------------

  const handleAttach = useCallback(async () => {
    if (!articleId || !generatedImageUrl || !clientId) return;

    setAttaching(true);
    try {
      await apiPatch(
        `/api/articles/${articleId}?client_id=${clientId}`,
        { featured_image_url: generatedImageUrl }
      );
      onToast("Image attached to article.", "success");
    } catch {
      onToast("Failed to attach image.", "error");
    } finally {
      setAttaching(false);
    }
  }, [articleId, generatedImageUrl, clientId, onToast]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-sm">
      <p className="text-sm font-semibold text-foreground">Image Generation</p>
      <Separator />

      {/* Model selector */}
      <div className="space-y-1">
        <Label className="text-xs font-medium text-muted-foreground">Model</Label>
        <Select value={selectedModel} onValueChange={setSelectedModel}>
          <SelectTrigger className="w-full h-8 text-sm">
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent>
            {IMAGE_MODELS.map((m) => (
              <SelectItem key={m.id} value={m.id} className="text-sm">
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Prompt textarea */}
      <div className="space-y-1">
        <Label className="text-xs font-medium text-muted-foreground">Prompt</Label>
        <Textarea
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            setPromptCustomized(true);
          }}
          rows={3}
          placeholder="Describe the image..."
          className="resize-none text-sm"
        />
      </div>

      {/* Generate button */}
      <Button
        className="w-full"
        size="sm"
        disabled={imageGenerating || !prompt.trim()}
        onClick={handleGenerate}
      >
        {imageGenerating ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <ImageIcon className="h-3.5 w-3.5" />
            Generate Image
          </>
        )}
      </Button>

      {/* Image preview */}
      {generatedImageUrl && (
        <div className="space-y-2">
          <div className="rounded-md overflow-hidden border border-border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={generatedImageUrl}
              alt="Generated article image"
              className="w-full object-cover"
              style={{ maxHeight: "200px" }}
            />
          </div>

          {/* Attach to Article button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={attaching || !articleId || !clientId}
            onClick={handleAttach}
            title={!articleId ? "Generate the article first to attach an image" : undefined}
          >
            {attaching ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Attaching...
              </>
            ) : (
              <>
                <Paperclip className="h-3.5 w-3.5" />
                Attach to Article
              </>
            )}
          </Button>
        </div>
      )}

      {/* Placeholder when no image yet */}
      {!generatedImageUrl && !imageGenerating && (
        <div className="rounded-md border border-dashed border-border bg-muted/30 flex items-center justify-center py-8">
          <div className="text-center text-xs text-muted-foreground space-y-1">
            <ImageIcon className="h-8 w-8 mx-auto opacity-30" />
            <p>1024 x 1024</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default ImageGenerationPanel;
