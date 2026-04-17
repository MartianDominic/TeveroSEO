"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, Loader2, FileText } from "lucide-react";
import dynamic from "next/dynamic";

// shadcn UI primitives
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

// Shared design-system components
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";

// Stores
import { useClientStore, useArticleEditorStore, DEFAULT_ARTICLE } from "@/stores";
import type { ArticleStatus } from "@/stores";

// API
import { apiGet, apiPost, apiPatch } from "@/lib/api-client";

// Editor components — dynamic import to avoid SSR issues with browser-only APIs
const ImageGenerationPanel = dynamic(
  () => import("@/components/editor/ImageGenerationPanel").then((m) => m.ImageGenerationPanel),
  { ssr: false }
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VoiceTemplate {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

interface GenerateResponse {
  article_id: string;
  html_content: string;
  status: ArticleStatus;
}

interface ArticleResponse {
  id: string;
  client_id: string;
  title: string;
  keyword: string | null;
  word_count: number | null;
  voice_template_id: string | null;
  blend_weight: number | null;
  custom_instructions: string | null;
  html_content: string | null;
  status: ArticleStatus;
  created_at: string | null;
  updated_at: string | null;
}

// ---------------------------------------------------------------------------
// Word count options
// ---------------------------------------------------------------------------

const WORD_COUNT_OPTIONS = [
  { value: "500", label: "500 words" },
  { value: "800", label: "800 words" },
  { value: "1200", label: "1,200 words" },
  { value: "2000", label: "2,000 words" },
  { value: "2500", label: "2,500 words" },
];

// ---------------------------------------------------------------------------
// BlendWeightLabel helper
// ---------------------------------------------------------------------------

function blendLabel(weight: number): string {
  if (weight <= 0) return "Brand (100%)";
  if (weight >= 1) return "Template (100%)";
  const brandPct = Math.round((1 - weight) * 100);
  const tmplPct = Math.round(weight * 100);
  return `Brand ${brandPct}% / Template ${tmplPct}%`;
}

// ---------------------------------------------------------------------------
// sanitizeHtml — strips <script> and <iframe> from AI-generated HTML
// This content comes exclusively from our own AI pipeline (/api/articles/generate)
// and is never user-supplied. The backend already strips these tags; this is
// a client-side defence-in-depth layer only.
// ---------------------------------------------------------------------------

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/\son\w+\s*=/gi, " data-removed=");
}

// ---------------------------------------------------------------------------
// ArticleHtmlPreview — renders AI-generated article HTML safely
// ---------------------------------------------------------------------------

function ArticleHtmlPreview({ html }: { html: string }) {
  const sanitized = sanitizeHtml(html);
  return (
    <div
      className="prose prose-sm max-w-none p-6 text-foreground"
      // Safe: AI-generated content from our own pipeline, sanitized above
      // nosec - intentional dangerouslySetInnerHTML with sanitized content
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}

// ---------------------------------------------------------------------------
// ArticleEditorPage
// ---------------------------------------------------------------------------

export default function ArticleEditorPage() {
  const params = useParams<{ clientId: string; articleId: string }>();
  const clientId = params.clientId;
  const articleId = params.articleId;
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNew = articleId === "new";

  const { activeClient, setActiveClient, clients } = useClientStore();
  const {
    article,
    isGenerating,
    generationStatus,
    setArticle,
    setGenerating,
    setGenerationStatus,
    patchArticle,
  } = useArticleEditorStore();

  // Voice templates
  const [voiceTemplates, setVoiceTemplates] = useState<VoiceTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Loading existing article
  const [loadingArticle, setLoadingArticle] = useState(false);
  const [loadArticleError, setLoadArticleError] = useState(false);

  // Advanced section collapsed state
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Sidebar action state
  const [approving, setApproving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [sidebarError, setSidebarError] = useState<string | null>(null);

  // Local toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Organic keyword suggestions for datalist
  const [organicKeywords, setOrganicKeywords] = useState<string[]>([]);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const currentArticle = article ?? { ...DEFAULT_ARTICLE, clientId: clientId ?? null };

  // Sync client store from URL param
  useEffect(() => {
    if (clientId && activeClient?.id !== clientId) {
      setActiveClient(clientId);
    }
  }, [clientId, activeClient?.id, setActiveClient]);

  // Initialize store for new article
  useEffect(() => {
    if (isNew) {
      const kwFromUrl = searchParams.get("keyword") ?? "";
      setArticle({ ...DEFAULT_ARTICLE, clientId: clientId ?? null, keyword: kwFromUrl });
      setGenerationStatus("idle");
    }
  }, [isNew, clientId, searchParams, setArticle, setGenerationStatus]);

  // Load organic keyword suggestions
  useEffect(() => {
    if (!clientId) return;
    apiGet<{ organic_keywords?: Array<{ keyword: string; search_volume: number }> }>(
      `/api/clients/${clientId}/intelligence`
    )
      .then((data) => {
        const kws = data?.organic_keywords;
        if (Array.isArray(kws)) {
          const sorted = [...kws].sort((a, b) => b.search_volume - a.search_volume).slice(0, 20);
          setOrganicKeywords(sorted.map((k) => k.keyword));
        }
      })
      .catch(() => {
        // Keyword suggestions are best-effort
      });
  }, [clientId]);

  // Load voice templates
  useEffect(() => {
    setLoadingTemplates(true);
    apiGet<VoiceTemplate[]>("/api/voice-templates")
      .then((data) => setVoiceTemplates(data))
      .catch(() => setVoiceTemplates([]))
      .finally(() => setLoadingTemplates(false));
  }, []);

  // Load existing article
  useEffect(() => {
    if (isNew || !articleId) return;
    setLoadingArticle(true);
    setLoadArticleError(false);
    apiGet<ArticleResponse>(`/api/articles/${articleId}`)
      .then((data) => {
        setArticle({
          articleId: data.id,
          clientId: data.client_id,
          title: data.title,
          keyword: data.keyword ?? "",
          wordCount: data.word_count ?? 1200,
          voiceTemplateId: data.voice_template_id,
          blendWeight: data.blend_weight ?? 0.5,
          customInstructions: data.custom_instructions ?? "",
          htmlContent: data.html_content,
          articleStatus: data.status,
          quickNotes: "",
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        });
        if (data.html_content) {
          setGenerationStatus("generated");
        }
      })
      .catch(() => setLoadArticleError(true))
      .finally(() => setLoadingArticle(false));
  }, [articleId, isNew, setArticle, setGenerationStatus]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // ---------------------------------------------------------------------------
  // Field change handlers (immutable patches)
  // ---------------------------------------------------------------------------

  const handleTitle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => patchArticle({ title: e.target.value }),
    [patchArticle]
  );

  const handleKeyword = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => patchArticle({ keyword: e.target.value }),
    [patchArticle]
  );

  const handleWordCount = useCallback(
    (value: string) => patchArticle({ wordCount: parseInt(value, 10) }),
    [patchArticle]
  );

  const handleVoiceTemplate = useCallback(
    (value: string) => patchArticle({ voiceTemplateId: value === "__none__" ? null : value }),
    [patchArticle]
  );

  const handleBlendWeight = useCallback(
    (values: number[]) => patchArticle({ blendWeight: values[0] ?? 0.5 }),
    [patchArticle]
  );

  const handleCustomInstructions = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) =>
      patchArticle({ customInstructions: e.target.value }),
    [patchArticle]
  );

  const handleQuickNotes = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => patchArticle({ quickNotes: e.target.value }),
    [patchArticle]
  );

  // ---------------------------------------------------------------------------
  // Generate article
  // ---------------------------------------------------------------------------

  const handleGenerate = useCallback(async () => {
    if (!clientId) return;
    setError(null);
    setGenerating(true);
    setGenerationStatus("generating");
    patchArticle({ articleStatus: "generating" });

    try {
      const body: Record<string, unknown> = {
        client_id: clientId,
        title: currentArticle.title,
        keyword: currentArticle.keyword,
        word_count: currentArticle.wordCount,
      };
      if (currentArticle.voiceTemplateId) {
        body.voice_template_id = currentArticle.voiceTemplateId;
        body.blend_weight = currentArticle.blendWeight;
      }
      if (currentArticle.customInstructions.trim()) {
        body.custom_instructions = currentArticle.customInstructions;
      }

      const data = await apiPost<GenerateResponse>("/api/articles/generate", body);

      patchArticle({
        articleId: data.article_id,
        htmlContent: data.html_content,
        articleStatus: data.status,
        updatedAt: new Date().toISOString(),
      });
      setGenerationStatus("generated");
      setToast({ message: "Article generated successfully.", type: "success" });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to generate article.";
      setError(message);
      setGenerationStatus("error");
      patchArticle({ articleStatus: "failed" });
    } finally {
      setGenerating(false);
    }
  }, [clientId, currentArticle, patchArticle, setGenerating, setGenerationStatus]);

  // ---------------------------------------------------------------------------
  // Approve article
  // ---------------------------------------------------------------------------

  const handleApprove = useCallback(async () => {
    const aid = currentArticle.articleId;
    if (!aid) return;
    setSidebarError(null);
    setApproving(true);
    try {
      await apiPatch(`/api/articles/${aid}/status`, { status: "approved" });
      patchArticle({ articleStatus: "approved" });
      setToast({ message: "Article approved.", type: "success" });
    } catch {
      setSidebarError("Failed to approve article.");
    } finally {
      setApproving(false);
    }
  }, [currentArticle.articleId, patchArticle]);

  // ---------------------------------------------------------------------------
  // Publish article
  // ---------------------------------------------------------------------------

  const handlePublish = useCallback(async () => {
    const aid = currentArticle.articleId;
    if (!aid) return;
    setSidebarError(null);
    setPublishing(true);
    patchArticle({ articleStatus: "publishing" });
    try {
      await apiPost(`/api/articles/${aid}/publish`, {});
      patchArticle({ articleStatus: "published" });
      setToast({ message: "Article published.", type: "success" });
    } catch {
      setSidebarError("Failed to publish article.");
      patchArticle({ articleStatus: "failed" });
    } finally {
      setPublishing(false);
    }
  }, [currentArticle.articleId, patchArticle]);

  // ---------------------------------------------------------------------------
  // Display client name
  // ---------------------------------------------------------------------------

  const displayClient =
    activeClient ?? clients.find((c) => c.id === clientId) ?? null;

  // ---------------------------------------------------------------------------
  // Loading skeleton
  // ---------------------------------------------------------------------------

  if (loadingArticle) {
    return (
      <div className="p-8 md:p-10 space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-1/3" />
      </div>
    );
  }

  if (loadArticleError) {
    return (
      <div className="p-8 md:p-10 space-y-6">
        <PageHeader
          title="Article"
          backHref={`/clients/${clientId}` as Parameters<typeof PageHeader>[0]["backHref"]}
        />
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <FileText className="h-10 w-10 text-destructive" />
          <div>
            <p className="text-base font-semibold text-foreground">Failed to load article</p>
            <p className="text-sm text-muted-foreground mt-1">
              The article could not be retrieved. It may have been deleted.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push(`/clients/${clientId}` as Parameters<typeof router.push>[0])}
          >
            Back to dashboard
          </Button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen p-8 md:p-10">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg px-4 py-3 text-sm shadow-lg bg-card border border-border">
          <div className="flex items-center gap-2">
            <StatusChip status={toast.type === "success" ? "published" : "failed"} />
            <span className="text-foreground font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="mb-6">
        <PageHeader
          title={isNew ? "New Article" : (currentArticle.title || "Edit Article")}
          subtitle={displayClient?.name ?? undefined}
          backHref={`/clients/${clientId}` as Parameters<typeof PageHeader>[0]["backHref"]}
          actions={
            <StatusChip
              status={isGenerating ? "generating" : currentArticle.articleStatus}
            />
          }
        />
      </div>

      {/* Two-column layout: editor left, sidebar right */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">

        {/* Main editor panel */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* Error banner */}
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {generationStatus === "error" && !error && (
            <span className="text-xs text-destructive">Generation failed. Try again.</span>
          )}

          {/* Title */}
          <div className="space-y-1">
            <Label htmlFor="title" className="text-sm font-medium">
              Article Title
            </Label>
            <Input
              id="title"
              placeholder="Enter article title..."
              value={currentArticle.title}
              onChange={handleTitle}
              className="text-lg font-semibold border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
            />
          </div>

          {/* Keyword target */}
          <div className="space-y-1">
            <Label htmlFor="keyword" className="text-sm font-medium">
              Keyword Target
            </Label>
            <Input
              id="keyword"
              list="keyword-suggestions"
              placeholder="e.g. best coffee machines 2025"
              value={currentArticle.keyword}
              onChange={handleKeyword}
            />
            {organicKeywords.length > 0 && (
              <datalist id="keyword-suggestions">
                {organicKeywords.map((kw) => (
                  <option key={kw} value={kw} />
                ))}
              </datalist>
            )}
          </div>

          {/* Word count */}
          <div className="space-y-1">
            <Label className="text-sm font-medium">Word Count Target</Label>
            <Select
              value={String(currentArticle.wordCount)}
              onValueChange={handleWordCount}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select word count" />
              </SelectTrigger>
              <SelectContent>
                {WORD_COUNT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Voice template */}
          <div className="space-y-1">
            <Label className="text-sm font-medium">Voice Template</Label>
            {loadingTemplates ? (
              <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
            ) : (
              <Select
                value={currentArticle.voiceTemplateId ?? "__none__"}
                onValueChange={handleVoiceTemplate}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No template (use brand voice only)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No template (brand voice only)</SelectItem>
                  {voiceTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Blend weight */}
          {currentArticle.voiceTemplateId && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Voice Blend</Label>
                <span className="text-xs text-muted-foreground">
                  {blendLabel(currentArticle.blendWeight)}
                </span>
              </div>
              <Slider
                min={0}
                max={1}
                step={0.05}
                value={[currentArticle.blendWeight]}
                onValueChange={handleBlendWeight}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Brand (100%)</span>
                <span>Template (100%)</span>
              </div>
            </div>
          )}

          {/* Advanced section */}
          <div className="rounded-lg border border-border">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/40 transition-colors rounded-lg"
              onClick={() => setAdvancedOpen((prev) => !prev)}
            >
              <span>Advanced</span>
              {advancedOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {advancedOpen && (
              <div className="border-t border-border px-4 pb-4 pt-3 space-y-2">
                <Label htmlFor="custom-instructions" className="text-sm font-medium">
                  Custom Instructions
                </Label>
                <Textarea
                  id="custom-instructions"
                  placeholder="Additional per-article instructions — overrides template defaults..."
                  rows={4}
                  value={currentArticle.customInstructions}
                  onChange={handleCustomInstructions}
                  className="resize-y"
                />
                <p className="text-xs text-muted-foreground">
                  These instructions are injected at the highest priority and override any template defaults.
                </p>
              </div>
            )}
          </div>

          {/* Generate button */}
          <Button
            className="w-full"
            size="lg"
            disabled={isGenerating || !currentArticle.title.trim()}
            onClick={handleGenerate}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                Generate Article
              </>
            )}
          </Button>

          {/* HTML Preview pane */}
          {currentArticle.htmlContent && (
            <div className="rounded-lg border border-border bg-card shadow-sm">
              <div className="border-b border-border px-4 py-3 flex items-center justify-between">
                <p className="text-sm font-semibold">Preview</p>
                <StatusChip
                  status={isGenerating ? "generating" : currentArticle.articleStatus}
                />
              </div>
              <ArticleHtmlPreview html={currentArticle.htmlContent} />
            </div>
          )}
        </div>

        {/* Sidebar panel */}
        <div className="w-full lg:w-72 shrink-0 space-y-4">

          {/* Metadata card */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-sm">
            <p className="text-sm font-semibold text-foreground">Article Details</p>
            <Separator />
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Status</span>
                <StatusChip
                  status={isGenerating ? "generating" : currentArticle.articleStatus}
                />
              </div>
              {currentArticle.createdAt && (
                <div className="flex justify-between">
                  <span>Created</span>
                  <span>{new Date(currentArticle.createdAt).toLocaleDateString()}</span>
                </div>
              )}
              {currentArticle.updatedAt && (
                <div className="flex justify-between">
                  <span>Updated</span>
                  <span>{new Date(currentArticle.updatedAt).toLocaleDateString()}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Word target</span>
                <span>{currentArticle.wordCount.toLocaleString()}</span>
              </div>
              {currentArticle.keyword && (
                <div className="flex justify-between gap-2">
                  <span className="shrink-0">Keyword</span>
                  <span className="text-right truncate">{currentArticle.keyword}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions card */}
          {currentArticle.articleId && (
            <div className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-sm">
              <p className="text-sm font-semibold text-foreground">Actions</p>
              <Separator />

              {sidebarError && (
                <p className="text-xs text-destructive">{sidebarError}</p>
              )}

              {(currentArticle.articleStatus === "generated" ||
                currentArticle.articleStatus === "pending_review") && (
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={approving}
                  onClick={handleApprove}
                >
                  {approving ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Approving...</>
                  ) : (
                    "Approve"
                  )}
                </Button>
              )}

              {currentArticle.articleStatus === "approved" && (
                <Button
                  className="w-full"
                  disabled={publishing}
                  onClick={handlePublish}
                >
                  {publishing ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Publishing...</>
                  ) : (
                    "Publish Now"
                  )}
                </Button>
              )}

              {currentArticle.articleStatus === "published" && (
                <div className="flex justify-center py-1">
                  <StatusChip status="published" />
                </div>
              )}
            </div>
          )}

          {/* Image generation panel */}
          <ImageGenerationPanel
            articleId={currentArticle.articleId}
            title={currentArticle.title}
            keyword={currentArticle.keyword}
            clientId={clientId ?? null}
            onToast={(message, type) => setToast({ message, type })}
          />

          {/* Quick notes card */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-sm">
            <p className="text-sm font-semibold text-foreground">Quick Notes</p>
            <Textarea
              placeholder="Add notes about this article..."
              rows={4}
              value={currentArticle.quickNotes}
              onChange={handleQuickNotes}
              className="resize-none text-sm"
            />
          </div>

        </div>
      </div>
    </div>
  );
}
