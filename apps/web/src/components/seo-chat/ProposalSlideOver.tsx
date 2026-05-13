'use client';

/**
 * ProposalSlideOver
 * Phase 98-07: Proposal preview slide-over panel
 *
 * Shows proposal draft with package details, domain health, keywords,
 * and actions (copy link, preview, send).
 *
 * Uses custom slide-over implementation since Sheet component not available.
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  Send,
  Copy,
  Check,
  Package,
  Target,
  TrendingUp,
  ExternalLink,
  X,
} from 'lucide-react';
import { useSeoChatDraftStore } from '@/stores/seoChatDraftStore';
import type { ProposalDraft } from '@/lib/seo-chat/types';

interface ProposalSlideOverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposalId?: string;
  magicLink?: string;
  onSend?: () => Promise<void>;
}

export function ProposalSlideOver({
  open,
  onOpenChange,
  proposalId,
  magicLink,
  onSend,
}: ProposalSlideOverProps) {
  const { draft } = useSeoChatDraftStore();
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);

  const handleCopy = async () => {
    if (magicLink) {
      await navigator.clipboard.writeText(magicLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSend = async () => {
    if (onSend) {
      setSending(true);
      try {
        await onSend();
      } finally {
        setSending(false);
      }
    }
  };

  const packageDetails = getPackageDetails(draft.package);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
        onClick={() => onOpenChange(false)}
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-lg bg-background border-l shadow-lg flex flex-col">
        {/* Header */}
        <div className="border-b p-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Proposal Preview
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Review the proposal before sending to {draft.domain || 'prospect'}
          </p>
        </div>

        <ScrollArea className="h-[calc(100vh-200px)] mt-4">
          <div className="space-y-4 pr-4">
            {/* Package Selection */}
            {draft.package && packageDetails && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Selected Package
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-lg">{packageDetails.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {packageDetails.description}
                      </p>
                    </div>
                    <Badge variant="default" className="text-lg px-3 py-1">
                      {packageDetails.price}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Domain Health Summary */}
            {draft.analysisResults.domainHealth && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Domain Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-medium">{draft.domain}</p>
                  <div className="flex gap-4 mt-2 text-sm">
                    <span>DA: <strong>{draft.analysisResults.domainHealth.da}</strong></span>
                    <span>DR: <strong>{draft.analysisResults.domainHealth.dr}</strong></span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {draft.analysisResults.domainHealth.summary}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Keywords List */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Target Keywords
                  </span>
                  <Badge variant="secondary">{draft.keywords.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {draft.keywords.map((kw) => (
                    <div
                      key={kw.id}
                      className="flex items-center justify-between py-1.5 px-2 bg-muted/30 rounded text-sm"
                    >
                      <span className="truncate flex-1">{kw.keyword}</span>
                      <div className="flex items-center gap-2 ml-2">
                        <span className="text-xs text-muted-foreground">
                          {kw.volume.toLocaleString()}
                        </span>
                        <Badge
                          variant="outline"
                          className={getFeasibilityColor(kw.feasibility)}
                        >
                          {kw.feasibility}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Feasibility Summary */}
            {draft.analysisResults.feasibilityResults.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Feasibility Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="p-2 bg-green-50 dark:bg-green-950/30 rounded">
                      <p className="text-green-600 font-medium">
                        {draft.analysisResults.feasibilityResults.filter(f => f.verdict === 'feasible').length}
                      </p>
                      <p className="text-xs text-muted-foreground">Feasible</p>
                    </div>
                    <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded">
                      <p className="text-amber-600 font-medium">
                        {draft.analysisResults.feasibilityResults.filter(f => f.verdict === 'challenging').length}
                      </p>
                      <p className="text-xs text-muted-foreground">Challenging</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t p-6 mt-auto">
          <Separator className="mb-4" />
          <div className="flex flex-col sm:flex-row gap-2">
            {magicLink && (
              <Button variant="outline" onClick={handleCopy} className="flex-1">
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Link
                  </>
                )}
              </Button>
            )}
            {magicLink && (
              <Button variant="outline" asChild className="flex-1">
                <a href={magicLink} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Preview
                </a>
              </Button>
            )}
            <Button onClick={handleSend} disabled={sending} className="flex-1">
              <Send className="h-4 w-4 mr-2" />
              {sending ? 'Sending...' : 'Send Proposal'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function getPackageDetails(pkg: ProposalDraft['package']) {
  const packages = {
    pamatas: { name: 'Pamatas', description: 'Essential SEO foundation', price: '€497/mo' },
    augimas: { name: 'Augimas', description: 'Growth-focused SEO', price: '€997/mo' },
    autoritetas: { name: 'Autoritetas', description: 'Authority building', price: '€1,997/mo' },
  };
  return pkg ? packages[pkg] : null;
}

function getFeasibilityColor(feasibility: string): string {
  switch (feasibility) {
    case 'feasible': return 'border-green-500 text-green-600';
    case 'challenging': return 'border-amber-500 text-amber-600';
    case 'difficult': return 'border-orange-500 text-orange-600';
    case 'unlikely': return 'border-red-500 text-red-600';
    default: return '';
  }
}
