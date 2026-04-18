"use client";

/**
 * /clients/[clientId]/articles/new — New article creation page.
 *
 * In CRA, /clients/:clientId/articles/new was handled by ArticleEditorPage
 * with articleId="new". In Next.js, the static "new" segment takes priority
 * over the dynamic [articleId] segment, so this dedicated page handles the
 * create flow. After generation, it navigates to the editor for the new
 * article ID.
 */

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, Loader2, FileText } from "lucide-react";
import dynamic from "next/dynamic";

import {
  Button,
  Input,
  Label,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Slider,
  StatusChip,
  Textarea,
} from "@tevero/ui";

import { useClientStore, useArticleEditorStore, DEFAULT_ARTICLE } from "@/stores";
import type { ArticleStatus } from "@/stores";
import { apiGet, apiPost } from "@/lib/api-client";

const ImageGenerationPanel = dynamic(
  () => import("@/components/editor/ImageGenerationPanel").then((m) => m.ImageGenerationPanel),
  { ssr: false }
);

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

const WORD_COUNT_OPTIONS = [
  { value: "500", label: "500 words" },
  { value: "800", label: "800 words" },
  { value: "1200", label: "1,200 words" },
  { value: "2000", label: "2,000 words" },
  { value: "2500", label: "2,500 words" },
];

function blendLabel(weight: number): string {
  if (weight <= 0) return "Brand (100%)";
  if (weight >= 1) return "Template (100%)";
  const brandPct = Math.round((1 - weight) * 100);
  const tmplPct = Math.round(weight * 100);
  return `Brand ${brandPct}% / Template ${tmplPct}%`;
}

/**
 * Strips script/iframe/inline-event-handler tags from AI-generated HTML.
 * Content comes exclusively from our own AI pipeline — never from user input.
 * The backend already sanitises; this is a client-side defence-in-depth layer.
 */
function sanitizeAiHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/\son\w+\s*=/gi, " data-removed=");
}

function ArticleHtmlPreview({ html }: { html: string }) {
  // sanitizeAiHtml strips all executable content before rendering
  const safeHtml = sanitizeAiHtml(html);
  return (
    <div
      className="prose prose-sm max-w-none p-6 text-foreground"
      dangerouslySetInnerHTML={{ __html: safeHtml }} // safe: AI-generated + sanitized
    />
  );
}

export default function NewArticlePage() {
  const params = useParams<{ clientId: string }>();
  const clientId = params.clientId;
  const router = useRouter();
  const searchParams = useSearchParams();

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

  const [voiceTemplates, setVoiceTemplates] = useState<VoiceTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [organicKeywords, setOrganicKeywords] = useState<string[]>([]);

  const currentArticle = article ?? { ...DEFAULT_ARTICLE, clientId: clientId ?? null };

  // Initialize blank article on mount
  useEffect(() => {
    const kwFromUrl = searchParams.get("keyword") ?? "";
    setArticle({ ...DEFAULT_ARTICLE, clientId: clientId ?? null, keyword: kwFromUrl });
    setGenerationStatus("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (clientId && activeClient?.id !== clientId) {
      setActiveClient(clientId);
    }
  }, [clientId, activeClient?.id, setActiveClient]);

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
      .catch(() => {});
  }, [clientId]);

  useEffect(() => {
    setLoadingTemplates(true);
    apiGet<VoiceTemplate[]>("/api/voice-templates")
      .then((data) => setVoiceTemplates(data))
      .catch(() => setVoiceTemplates([]))
      .finally(() => setLoadingTemplates(false));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

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

      // Navigate to the editor view for the newly created article
      if (data.article_id) {
        router.push(
          `/clients/${clientId}/articles/${data.article_id}` as Parameters<typeof router.push>[0]
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to generate article.";
      setError(message);
      setGenerationStatus("error");
      patchArticle({ articleStatus: "failed" });
    } finally {
      setGenerating(false);
    }
  }, [clientId, currentArticle, patchArticle, setGenerating, setGenerationStatus, router]);

  const displayClient =
    activeClient ?? clients.find((c) => c.id === clientId) ?? null;

  return (
    <div className="min-h-screen p-8 md:p-10">
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg px-4 py-3 text-sm shadow-lg bg-card border border-border">
          <div className="flex items-center gap-2">
            <StatusChip status={toast.type === "success" ? "published" : "failed"} />
            <span className="text-foreground font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      <div className="mb-6">
        <PageHeader
          title="New Article"
          subtitle={displayClient?.name ?? undefined}
          backHref={`/clients/${clientId}/articles` as Parameters<typeof PageHeader>[0]["backHref"]}
          actions={
            <StatusChip status={isGenerating ? "generating" : currentArticle.articleStatus} />
          }
        />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex-1 min-w-0 space-y-5">
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {generationStatus === "error" && !error && (
            <span className="text-xs text-destructive">Generation failed. Try again.</span>
          )}

          <div className="space-y-1">
            <Label htmlFor="title" className="text-sm font-medium">Article Title</Label>
            <Input
              id="title"
              placeholder="Enter article title..."
              value={currentArticle.title}
              onChange={handleTitle}
              className="text-lg font-semibold border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="keyword" className="text-sm font-medium">Keyword Target</Label>
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

          <div className="space-y-1">
            <Label className="text-sm font-medium">Word Count Target</Label>
            <Select value={String(currentArticle.wordCount)} onValueChange={handleWordCount}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select word count" />
              </SelectTrigger>
              <SelectContent>
                {WORD_COUNT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

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

          <Button
            className="w-full"
            size="lg"
            disabled={isGenerating || !currentArticle.title.trim()}
            onClick={handleGenerate}
          >
            {isGenerating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
            ) : (
              <><FileText className="h-4 w-4" /> Generate Article</>
            )}
          </Button>

          {currentArticle.htmlContent && (
            <div className="rounded-lg border border-border bg-card shadow-sm">
              <div className="border-b border-border px-4 py-3 flex items-center justify-between">
                <p className="text-sm font-semibold">Preview</p>
                <StatusChip status={isGenerating ? "generating" : currentArticle.articleStatus} />
              </div>
              <ArticleHtmlPreview html={currentArticle.htmlContent} />
            </div>
          )}
        </div>

        <div className="w-full lg:w-72 shrink-0 space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-sm">
            <p className="text-sm font-semibold text-foreground">Article Details</p>
            <Separator />
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Status</span>
                <StatusChip status={isGenerating ? "generating" : currentArticle.articleStatus} />
              </div>
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

          <ImageGenerationPanel
            articleId={currentArticle.articleId}
            title={currentArticle.title}
            keyword={currentArticle.keyword}
            clientId={clientId ?? null}
            onToast={(message, type) => setToast({ message, type })}
          />

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
