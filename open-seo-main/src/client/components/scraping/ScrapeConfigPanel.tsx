/**
 * ScrapeConfigPanel - Main UI for scrape configuration
 * Phase 43: Prospect Keyword Pipeline - Scrape Configuration
 *
 * Features:
 * - Platform detection display
 * - AI selector discovery button
 * - Rule editor with field configuration
 * - Test extraction button
 * - Include/exclude pattern editors
 */
import { useState, useCallback } from "react";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Badge } from "@/client/components/ui/badge";
import { Textarea } from "@/client/components/ui/textarea";
import {
  Loader2,
  Sparkles,
  Save,
  Plus,
  Check,
  AlertCircle,
  Settings2,
  ChevronDown,
} from "lucide-react";
import { RuleEditor } from "./RuleEditor";
import type {
  ExtractionRule,
  AiSelector,
  DetectedPlatform,
} from "@/db/prospect-scrape-config-schema";
import { nanoid } from "nanoid";

interface ScrapeConfig {
  id: string;
  prospectId: string;
  detectedPlatform: DetectedPlatform | null;
  detectedSiteType: string | null;
  platformVersion: string | null;
  extractionRules: ExtractionRule[] | null;
  aiSelectors: AiSelector[] | null;
  maxPages: number;
  maxDepth: number;
  rateLimit: number;
  includePatterns: string[] | null;
  excludePatterns: string[] | null;
}

interface ScrapeConfigPanelProps {
  prospectId: string;
  domain: string;
  config: ScrapeConfig | null;
  onSave: (config: Partial<ScrapeConfig>) => Promise<void>;
  onDiscoverSelectors: (html: string, url: string) => Promise<{
    platform: DetectedPlatform;
    platformConfidence: number;
    selectors: AiSelector[];
  }>;
  onTestRule: (
    rule: ExtractionRule,
    html: string,
    url: string,
  ) => Promise<{ matched: boolean; data: Record<string, string | null> | null }>;
}

const PLATFORM_LABELS: Record<DetectedPlatform, string> = {
  shopify: "Shopify",
  woocommerce: "WooCommerce",
  magento: "Magento",
  prestashop: "PrestaShop",
  opencart: "OpenCart",
  custom: "Custom / Unknown",
};

export function ScrapeConfigPanel({
  prospectId,
  domain,
  config,
  onSave,
  onDiscoverSelectors,
  onTestRule,
}: ScrapeConfigPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testUrl, setTestUrl] = useState(`https://${domain}/`);
  const [testHtml, setTestHtml] = useState("");
  const [testResults, setTestResults] = useState<Record<string, string | null> | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  // Local state for editing
  const [rules, setRules] = useState<ExtractionRule[]>(config?.extractionRules || []);
  const [maxPages, setMaxPages] = useState(config?.maxPages || 500);
  const [maxDepth, setMaxDepth] = useState(config?.maxDepth || 3);
  const [rateLimit, setRateLimit] = useState(config?.rateLimit || 2);
  const [includePatterns, setIncludePatterns] = useState<string[]>(
    config?.includePatterns || [],
  );
  const [excludePatterns, setExcludePatterns] = useState<string[]>(
    config?.excludePatterns || [],
  );
  const [aiSelectors, setAiSelectors] = useState<AiSelector[]>(
    config?.aiSelectors || [],
  );
  const [detectedPlatform, setDetectedPlatform] = useState<DetectedPlatform | null>(
    config?.detectedPlatform || null,
  );

  const handleDiscoverSelectors = useCallback(async () => {
    if (!testHtml || !testUrl) {
      setError("Please provide HTML content and URL for AI discovery");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await onDiscoverSelectors(testHtml, testUrl);
      setAiSelectors(result.selectors);
      setDetectedPlatform(result.platform);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [testHtml, testUrl, onDiscoverSelectors]);

  const handleTestRule = useCallback(
    async (rule: ExtractionRule) => {
      if (!testHtml || !testUrl) {
        setError("Please provide HTML content and URL for testing");
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const result = await onTestRule(rule, testHtml, testUrl);
        if (result.matched) {
          setTestResults(result.data);
        } else {
          setError(`Rule did not match URL pattern: ${rule.urlPattern}`);
          setTestResults(null);
        }
      } catch (err) {
        setError((err as Error).message);
        setTestResults(null);
      } finally {
        setIsLoading(false);
      }
    },
    [testHtml, testUrl, onTestRule],
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onSave({
        extractionRules: rules,
        maxPages,
        maxDepth,
        rateLimit,
        includePatterns: includePatterns.filter(Boolean),
        excludePatterns: excludePatterns.filter(Boolean),
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  }, [
    rules,
    maxPages,
    maxDepth,
    rateLimit,
    includePatterns,
    excludePatterns,
    onSave,
  ]);

  const addRule = useCallback(() => {
    const newRule: ExtractionRule = {
      id: `rule_${nanoid(8)}`,
      name: `Rule ${rules.length + 1}`,
      urlPattern: "/products/*",
      pageType: "product",
      enabled: true,
      fields: [
        {
          name: "title",
          selectors: ["h1"],
          type: "text",
          transform: "trim",
        },
      ],
    };
    setRules([...rules, newRule]);
  }, [rules]);

  const updateRule = useCallback(
    (index: number, rule: ExtractionRule) => {
      const newRules = [...rules];
      newRules[index] = rule;
      setRules(newRules);
    },
    [rules],
  );

  const deleteRule = useCallback(
    (index: number) => {
      setRules(rules.filter((_, i) => i !== index));
    },
    [rules],
  );

  const convertAiSelectorsToRule = useCallback(() => {
    if (aiSelectors.length === 0) return;

    const newRule: ExtractionRule = {
      id: `rule_${nanoid(8)}`,
      name: "AI-Generated Rule",
      urlPattern: "/products/*",
      pageType: "product",
      enabled: true,
      fields: aiSelectors.map((sel) => ({
        name: sel.field,
        selectors: sel.fallback ? [sel.selector, sel.fallback] : [sel.selector],
        type: "text" as const,
        transform: "trim" as const,
      })),
    };
    setRules([...rules, newRule]);
    setAiSelectors([]);
  }, [aiSelectors, rules]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Scrape Configuration</h2>
          <p className="text-sm text-muted-foreground">
            Configure how data is extracted from {domain}
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Configuration
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Platform Detection */}
      {detectedPlatform && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Detected Platform</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary" className="text-sm">
              {PLATFORM_LABELS[detectedPlatform]}
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* AI Selector Discovery */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            AI Selector Discovery
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Test URL</Label>
            <Input
              value={testUrl}
              onChange={(e) => setTestUrl(e.target.value)}
              placeholder={`https://${domain}/products/example`}
            />
          </div>
          <div className="space-y-2">
            <Label>HTML Content</Label>
            <Textarea
              value={testHtml}
              onChange={(e) => setTestHtml(e.target.value)}
              placeholder="Paste HTML content from the page..."
              rows={6}
              className="font-mono text-xs"
            />
          </div>
          <Button
            onClick={handleDiscoverSelectors}
            disabled={isLoading || !testHtml}
            variant="outline"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Discover Selectors with AI
          </Button>

          {/* AI-discovered selectors */}
          {aiSelectors.length > 0 && (
            <div className="space-y-2 pt-4 border-t">
              <div className="flex items-center justify-between">
                <Label>Discovered Selectors</Label>
                <Button size="sm" variant="outline" onClick={convertAiSelectorsToRule}>
                  <Plus className="h-4 w-4 mr-1" />
                  Convert to Rule
                </Button>
              </div>
              <div className="space-y-2">
                {aiSelectors.map((sel, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 bg-muted rounded text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{sel.field}</span>
                      <code className="text-xs bg-background px-1 rounded">
                        {sel.selector}
                      </code>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={sel.confidence >= 90 ? "default" : "secondary"}
                      >
                        {sel.confidence}%
                      </Badge>
                      <span className="text-xs text-muted-foreground truncate max-w-32">
                        {sel.sampleValue}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Test Results */}
          {testResults && (
            <div className="space-y-2 pt-4 border-t">
              <Label>Test Results</Label>
              <div className="space-y-1">
                {Object.entries(testResults).map(([field, value]) => (
                  <div
                    key={field}
                    className="flex items-center gap-2 p-2 bg-muted rounded text-sm"
                  >
                    <span className="font-medium w-24">{field}</span>
                    {value ? (
                      <>
                        <Check className="h-4 w-4 text-green-500" />
                        <span className="truncate">{value}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Not found</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Extraction Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Extraction Rules</span>
            <Button variant="outline" size="sm" onClick={addRule}>
              <Plus className="h-4 w-4 mr-1" />
              Add Rule
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No extraction rules configured. Add a rule or use AI discovery.
            </p>
          ) : (
            rules.map((rule, index) => (
              <RuleEditor
                key={rule.id}
                rule={rule}
                onChange={(updated) => updateRule(index, updated)}
                onDelete={() => deleteRule(index)}
                onTest={handleTestRule}
                isLoading={isLoading}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* Crawl Settings */}
      <CrawlSettingsSection
        maxPages={maxPages}
        maxDepth={maxDepth}
        rateLimit={rateLimit}
        includePatterns={includePatterns}
        excludePatterns={excludePatterns}
        onMaxPagesChange={setMaxPages}
        onMaxDepthChange={setMaxDepth}
        onRateLimitChange={setRateLimit}
        onIncludePatternsChange={setIncludePatterns}
        onExcludePatternsChange={setExcludePatterns}
      />
    </div>
  );
}

// Collapsible Crawl Settings Section
function CrawlSettingsSection({
  maxPages,
  maxDepth,
  rateLimit,
  includePatterns,
  excludePatterns,
  onMaxPagesChange,
  onMaxDepthChange,
  onRateLimitChange,
  onIncludePatternsChange,
  onExcludePatternsChange,
}: {
  maxPages: number;
  maxDepth: number;
  rateLimit: number;
  includePatterns: string[];
  excludePatterns: string[];
  onMaxPagesChange: (value: number) => void;
  onMaxDepthChange: (value: number) => void;
  onRateLimitChange: (value: number) => void;
  onIncludePatternsChange: (value: string[]) => void;
  onExcludePatternsChange: (value: string[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card>
      <CardHeader
        className="cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <CardTitle className="flex items-center justify-between text-sm font-medium">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Crawl Settings
          </div>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </CardTitle>
      </CardHeader>
      {isOpen && (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Max Pages</Label>
              <Input
                type="number"
                value={maxPages}
                onChange={(e) => onMaxPagesChange(Number(e.target.value))}
                min={1}
                max={5000}
              />
            </div>
            <div className="space-y-2">
              <Label>Max Depth</Label>
              <Input
                type="number"
                value={maxDepth}
                onChange={(e) => onMaxDepthChange(Number(e.target.value))}
                min={1}
                max={10}
              />
            </div>
            <div className="space-y-2">
              <Label>Rate Limit (req/s)</Label>
              <Input
                type="number"
                value={rateLimit}
                onChange={(e) => onRateLimitChange(Number(e.target.value))}
                min={1}
                max={10}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Include Patterns (one per line)</Label>
            <Textarea
              value={includePatterns.join("\n")}
              onChange={(e) =>
                onIncludePatternsChange(e.target.value.split("\n").filter(Boolean))
              }
              placeholder="/products/*&#10;/collections/*"
              rows={3}
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label>Exclude Patterns (one per line)</Label>
            <Textarea
              value={excludePatterns.join("\n")}
              onChange={(e) =>
                onExcludePatternsChange(e.target.value.split("\n").filter(Boolean))
              }
              placeholder="/cart&#10;/account/*&#10;/checkout"
              rows={3}
              className="font-mono text-sm"
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}
