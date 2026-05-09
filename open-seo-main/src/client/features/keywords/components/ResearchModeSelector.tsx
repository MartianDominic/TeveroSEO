/**
 * Research Mode Selector Component
 * Phase 93: Keyword Coverage Intelligence
 *
 * Allows user to select research mode before submitting keywords.
 * Shows expected behavior for each mode per 93-CONTEXT.md.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/client/components/ui/radio-group";
import { Label } from "@/client/components/ui/label";
import { Button } from "@/client/components/ui/button";
import { Textarea } from "@/client/components/ui/textarea";
import { Badge } from "@/client/components/ui/badge";

type ResearchMode = 'EXPAND' | 'DEEP_DIVE' | 'COMPETITOR';

interface ResearchModeSelectorProps {
  prospectId: string;
  onSubmit: (mode: ResearchMode, keywords: string[]) => Promise<void>;
  isSubmitting?: boolean;
}

const MODE_INFO: Record<ResearchMode, { label: string; description: string; placeholder: string }> = {
  EXPAND: {
    label: 'Expand (New Seeds)',
    description: 'Fetch new keywords for NEW seed terms. Deduplicates against existing corpus.',
    placeholder: 'Enter seed keywords (one per line):\n\nSEO tools\nkeyword research\nbacklink checker',
  },
  DEEP_DIVE: {
    label: 'Deep-Dive (Cluster)',
    description: 'Explore long-tail variants of a specific topic. Best for expanding weak areas.',
    placeholder: 'Enter topic to deep-dive (one per line):\n\ntechnical SEO audit\nsite speed optimization',
  },
  COMPETITOR: {
    label: 'Competitor Gap',
    description: 'Research competitor ranking keywords. Find opportunities they rank for that you do not.',
    placeholder: 'Enter competitor domains (one per line):\n\nahrefs.com\nsemrush.com',
  },
};

export function ResearchModeSelector({ prospectId, onSubmit, isSubmitting }: ResearchModeSelectorProps) {
  const [mode, setMode] = useState<ResearchMode>('EXPAND');
  const [keywords, setKeywords] = useState('');
  const [result, setResult] = useState<{
    newCount: number;
    duplicateCount: number;
    costSavedUsd: number;
    message?: string;
  } | null>(null);

  const handleSubmit = async () => {
    const keywordList = keywords
      .split('\n')
      .map(k => k.trim())
      .filter(k => k.length > 0);

    if (keywordList.length === 0) {
      return;
    }

    try {
      const response = await fetch('/api/keywords/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospectId,
          mode,
          keywords: keywordList,
        }),
      });

      const data = await response.json() as {
        success: boolean;
        data?: { newCount: number; duplicateCount: number; costSavedUsd: number; message?: string };
        error?: string
      };

      if (data.success && data.data) {
        setResult(data.data);
        if (data.data.newCount > 0) {
          setKeywords('');  // Clear on success
        }
      }

      await onSubmit(mode, keywordList);
    } catch (error) {
      console.error('Research failed:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Research New Keywords</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Mode Selection */}
        <div>
          <Label className="text-sm font-medium mb-3 block">Research Mode</Label>
          <RadioGroup
            value={mode}
            onValueChange={(v) => setMode(v as ResearchMode)}
            className="space-y-3"
          >
            {(Object.entries(MODE_INFO) as [ResearchMode, typeof MODE_INFO[ResearchMode]][]).map(
              ([modeKey, info]) => (
                <div
                  key={modeKey}
                  className="flex items-start space-x-3 p-3 bg-surface-2 rounded-lg cursor-pointer hover:bg-surface-3"
                  onClick={() => setMode(modeKey)}
                >
                  <RadioGroupItem value={modeKey} id={modeKey} className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor={modeKey} className="font-medium cursor-pointer">
                      {info.label}
                    </Label>
                    <p className="text-sm text-text-3 mt-1">{info.description}</p>
                  </div>
                </div>
              )
            )}
          </RadioGroup>
        </div>

        {/* Keyword Input */}
        <div>
          <Label className="text-sm font-medium mb-2 block">
            {mode === 'COMPETITOR' ? 'Competitor Domains' : 'Seed Keywords'}
          </Label>
          <Textarea
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder={MODE_INFO[mode].placeholder}
            rows={6}
            className="font-mono text-sm"
          />
          <p className="text-xs-safe text-text-3 mt-1">
            {keywords.split('\n').filter(k => k.trim()).length} items entered
          </p>
        </div>

        {/* Result Display */}
        {result && (
          <div className={`p-4 rounded-lg ${result.newCount === 0 ? 'bg-warning/10 border border-warning' : 'bg-success/10 border border-success'}`}>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={result.newCount === 0 ? 'outline' : 'default'}>
                {result.newCount === 0 ? 'No New Keywords' : `${result.newCount} New Keywords`}
              </Badge>
              {result.duplicateCount > 0 && (
                <Badge variant="outline">
                  {result.duplicateCount} Duplicates Skipped
                </Badge>
              )}
            </div>
            {result.costSavedUsd > 0 && (
              <p className="text-sm text-success">
                Cost saved: ${result.costSavedUsd.toFixed(2)} (duplicates not sent to API)
              </p>
            )}
            {result.message && (
              <p className="text-sm text-text-2 mt-1">{result.message}</p>
            )}
          </div>
        )}

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !keywords.trim()}
          className="w-full"
        >
          {isSubmitting ? 'Researching...' : 'Start Research'}
        </Button>
      </CardContent>
    </Card>
  );
}
