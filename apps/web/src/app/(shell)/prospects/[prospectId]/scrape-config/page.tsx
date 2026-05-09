"use client";

/**
 * Scrape Configuration Page
 * Phase 43-05: AI Selector Discovery + Custom Extraction Rules
 *
 * Allows users to:
 * - Run AI selector discovery on sample pages
 * - Create and edit custom extraction rules
 * - Test rules against sample HTML
 * - Configure crawl settings
 */

import { useState, useEffect, useCallback, useTransition } from "react";

import Link from "next/link";
import { useParams } from "next/navigation";

import {
  ChevronLeft,
  Loader2,
  Sparkles,
  Plus,
  Settings,
  TestTube,
  Check,
  AlertCircle,
  Globe,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Badge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Slider,
} from "@tevero/ui";


import {
  getScrapeConfig,
  updateScrapeConfig,
  discoverSelectors,
  testExtractionRule,
  type ScrapeConfig,
  type ExtractionRule,
  type AiSelector,
} from "./actions";
import { RuleEditor, createEmptyRule } from "./components/RuleEditor";

// Platform display names and colors
const PLATFORM_INFO: Record<
  string,
  { label: string; color: string }
> = {
  shopify: { label: "Shopify", color: "bg-green-500" },
  woocommerce: { label: "WooCommerce", color: "bg-purple-500" },
  magento: { label: "Magento", color: "bg-orange-500" },
  prestashop: { label: "PrestaShop", color: "bg-pink-500" },
  opencart: { label: "OpenCart", color: "bg-blue-500" },
  custom: { label: "Custom", color: "bg-gray-500" },
};

export default function ScrapeConfigPage() {
  const params = useParams();
  const prospectId = params.prospectId as string;

  const [_isPending, _startTransition] = useTransition();
  const [config, setConfig] = useState<ScrapeConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // AI Discovery state
  const [discoveryUrl, setDiscoveryUrl] = useState("");
  const [discoveryHtml, setDiscoveryHtml] = useState("");
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryResult, setDiscoveryResult] = useState<{
    platform: string;
    platformConfidence: number;
    selectors: AiSelector[];
  } | null>(null);

  // Rule testing state
  const [testUrl, setTestUrl] = useState("");
  const [testHtml, setTestHtml] = useState("");
  const [_testRuleIndex, setTestRuleIndex] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{
    matched: boolean;
    data: Record<string, string | null> | null;
  } | null>(null);
  const [_isTesting, setIsTesting] = useState(false);

  // Local extraction rules state (for editing)
  const [localRules, setLocalRules] = useState<ExtractionRule[]>([]);
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());

  // Crawl settings
  const [maxPages, setMaxPages] = useState(500);
  const [maxDepth, setMaxDepth] = useState(3);
  const [rateLimit, setRateLimit] = useState(2);
  const [includePatterns, setIncludePatterns] = useState("");
  const [excludePatterns, setExcludePatterns] = useState("");

  // Fetch config
  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getScrapeConfig(prospectId);
      if (!result.success) {
        setError(result.error || "Failed to fetch configuration");
        return;
      }

      setConfig(result.data);

      // Initialize local state from config
      if (result.data) {
        setLocalRules(result.data.extractionRules || []);
        setMaxPages(result.data.maxPages);
        setMaxDepth(result.data.maxDepth);
        setRateLimit(result.data.rateLimit);
        setIncludePatterns(result.data.includePatterns?.join("\n") || "");
        setExcludePatterns(result.data.excludePatterns?.join("\n") || "");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [prospectId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Save configuration
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await updateScrapeConfig(prospectId, {
        extractionRules: localRules,
        maxPages,
        maxDepth,
        rateLimit,
        includePatterns: includePatterns
          .split("\n")
          .map((p) => p.trim())
          .filter(Boolean),
        excludePatterns: excludePatterns
          .split("\n")
          .map((p) => p.trim())
          .filter(Boolean),
      });

      if (!result.success) {
        setError(result.error || "Failed to save configuration");
        return;
      }

      setSuccessMessage("Configuration saved successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Run AI discovery
  const handleDiscover = async () => {
    if (!discoveryUrl || !discoveryHtml) {
      setError("Please provide both URL and HTML content");
      return;
    }

    setIsDiscovering(true);
    setError(null);
    setDiscoveryResult(null);

    try {
      const result = await discoverSelectors(
        prospectId,
        discoveryHtml,
        discoveryUrl
      );

      if (!result.success) {
        setError(result.error || "AI discovery failed");
        return;
      }

      setDiscoveryResult(result.data);

      // Also refresh config to get updated AI selectors
      await fetchConfig();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsDiscovering(false);
    }
  };

  // Test extraction rule
  const handleTestRule = async (ruleIndex: number) => {
    const rule = localRules[ruleIndex];
    if (!rule || !testUrl || !testHtml) {
      setError("Please provide test URL and HTML content");
      return;
    }

    setIsTesting(true);
    setTestRuleIndex(ruleIndex);
    setTestResult(null);
    setError(null);

    try {
      const result = await testExtractionRule(
        prospectId,
        rule,
        testHtml,
        testUrl
      );

      if (!result.success) {
        setError(result.error || "Rule test failed");
        return;
      }

      setTestResult(result.data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsTesting(false);
      setTestRuleIndex(null);
    }
  };

  // Convert AI selectors to extraction rule
  const convertSelectorsToRule = () => {
    if (!discoveryResult?.selectors.length) return;

    const newRule: ExtractionRule = {
      id: `rule_${Date.now()}`,
      name: `Auto-generated (${discoveryResult.platform})`,
      urlPattern: "/products/*",
      pageType: "product",
      enabled: true,
      fields: discoveryResult.selectors.map((s) => ({
        name: s.field,
        selectors: s.fallback ? [s.selector, s.fallback] : [s.selector],
        type: "text" as const,
        transform: s.field === "price" ? ("price" as const) : ("trim" as const),
      })),
    };

    setLocalRules([...localRules, newRule]);
    setExpandedRules(new Set([...expandedRules, newRule.id]));
  };

  // Add new rule
  const handleAddRule = () => {
    const newRule = createEmptyRule();
    setLocalRules([...localRules, newRule]);
    setExpandedRules(new Set([...expandedRules, newRule.id]));
  };

  // Update rule
  const handleUpdateRule = (index: number, rule: ExtractionRule) => {
    const newRules = [...localRules];
    newRules[index] = rule;
    setLocalRules(newRules);
  };

  // Delete rule
  const handleDeleteRule = (index: number) => {
    const newRules = localRules.filter((_, i) => i !== index);
    setLocalRules(newRules);
  };

  // Toggle rule expansion
  const toggleRuleExpand = (ruleId: string) => {
    const newExpanded = new Set(expandedRules);
    if (newExpanded.has(ruleId)) {
      newExpanded.delete(ruleId);
    } else {
      newExpanded.add(ruleId);
    }
    setExpandedRules(newExpanded);
  };

  const platformInfo = config?.detectedPlatform
    ? PLATFORM_INFO[config.detectedPlatform] || PLATFORM_INFO.custom
    : null;

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-text-3" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={
              `/prospects/${prospectId}` as Parameters<typeof Link>[0]["href"]
            }
          >
            <Button variant="ghost" size="sm">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Scrape Configuration</h1>
            <p className="text-text-3">
              Configure custom extraction rules for this prospect
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Check className="h-4 w-4 mr-2" />
          )}
          Save Configuration
        </Button>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-error-soft text-error px-4 py-2 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
      {successMessage && (
        <div className="bg-success-soft text-success px-4 py-2 rounded-lg flex items-center gap-2">
          <Check className="h-4 w-4" />
          {successMessage}
        </div>
      )}

      {/* Platform Detection */}
      {platformInfo && (
        <Card className="shadow-card">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-text-3" />
              <span className="text-sm">Detected Platform:</span>
              <Badge className={platformInfo.color}>{platformInfo.label}</Badge>
              {config?.platformVersion && (
                <span className="text-sm text-text-3">
                  v{config.platformVersion}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="rules" className="space-y-6">
        <TabsList>
          <TabsTrigger value="rules">Extraction Rules</TabsTrigger>
          <TabsTrigger value="discovery">AI Discovery</TabsTrigger>
          <TabsTrigger value="settings">Crawl Settings</TabsTrigger>
        </TabsList>

        {/* Extraction Rules Tab */}
        <TabsContent value="rules" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Extraction Rules</h2>
              <p className="text-sm text-text-3">
                Define how to extract data from different page types
              </p>
            </div>
            <Button onClick={handleAddRule}>
              <Plus className="h-4 w-4 mr-2" />
              Add Rule
            </Button>
          </div>

          {/* Test Panel */}
          <Card className="shadow-card bg-surface-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TestTube className="h-4 w-4" />
                Test Extraction
              </CardTitle>
              <CardDescription>
                Provide sample HTML to test your rules
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Test URL</Label>
                <Input
                  value={testUrl}
                  onChange={(e) => setTestUrl(e.target.value)}
                  placeholder="https://example.com/products/sample"
                />
              </div>
              <div>
                <Label>Test HTML</Label>
                <Textarea
                  value={testHtml}
                  onChange={(e) => setTestHtml(e.target.value)}
                  placeholder="Paste HTML content here..."
                  className="font-mono text-[12px] h-32"
                />
              </div>

              {testResult && (
                <div className="border rounded-lg p-3 bg-background">
                  {testResult.matched ? (
                    <>
                      <div className="flex items-center gap-2 text-success mb-2">
                        <Check className="h-4 w-4" />
                        <span className="font-medium">Rule Matched</span>
                      </div>
                      <div className="space-y-1 text-sm">
                        {testResult.data &&
                          Object.entries(testResult.data).map(([key, value]) => (
                            <div
                              key={key}
                              className="flex items-start gap-2"
                            >
                              <span className="font-medium text-text-3 min-w-20">
                                {key}:
                              </span>
                              <span className="break-all">
                                {value || (
                                  <span className="text-text-3 italic">
                                    null
                                  </span>
                                )}
                              </span>
                            </div>
                          ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertCircle className="h-4 w-4" />
                      <span>Rule did not match URL pattern</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rules List */}
          {localRules.length === 0 ? (
            <Card className="shadow-card">
              <CardContent className="py-12 text-center">
                <Settings className="h-12 w-12 mx-auto text-text-3 mb-4" />
                <h3 className="text-lg font-medium mb-2">No extraction rules</h3>
                <p className="text-text-3 mb-4">
                  Create custom rules or use AI to discover selectors
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Button onClick={handleAddRule}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Rule
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {localRules.map((rule, index) => (
                <RuleEditor
                  key={rule.id}
                  rule={rule}
                  onChange={(r) => handleUpdateRule(index, r)}
                  onDelete={() => handleDeleteRule(index)}
                  onTest={() => handleTestRule(index)}
                  isExpanded={expandedRules.has(rule.id)}
                  onToggleExpand={() => toggleRuleExpand(rule.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* AI Discovery Tab */}
        <TabsContent value="discovery" className="space-y-4">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                AI Selector Discovery
              </CardTitle>
              <CardDescription>
                Use AI to automatically discover CSS selectors for product data
                extraction
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Sample Page URL</Label>
                <Input
                  value={discoveryUrl}
                  onChange={(e) => setDiscoveryUrl(e.target.value)}
                  placeholder="https://example.com/products/sample-product"
                />
              </div>
              <div>
                <Label>Page HTML Content</Label>
                <Textarea
                  value={discoveryHtml}
                  onChange={(e) => setDiscoveryHtml(e.target.value)}
                  placeholder="Paste the HTML source of a product page..."
                  className="font-mono text-[12px] h-48"
                />
                <p className="text-[12px] text-text-3 mt-1">
                  Tip: Right-click on a product page and select &quot;View Page
                  Source&quot; to get the HTML
                </p>
              </div>
              <Button
                onClick={handleDiscover}
                disabled={isDiscovering || !discoveryUrl || !discoveryHtml}
              >
                {isDiscovering ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Discover Selectors
              </Button>

              {/* Discovery Results */}
              {discoveryResult && (
                <div className="border rounded-[var(--radius-card)] p-4 space-y-4 bg-surface-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge
                        className={
                          PLATFORM_INFO[discoveryResult.platform]?.color ||
                          "bg-gray-500"
                        }
                      >
                        {PLATFORM_INFO[discoveryResult.platform]?.label ||
                          discoveryResult.platform}
                      </Badge>
                      <span className="text-sm text-text-3">
                        {Math.round(discoveryResult.platformConfidence * 100)}%
                        confidence
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={convertSelectorsToRule}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Create Rule from Selectors
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium">Discovered Selectors</h4>
                    <div className="grid gap-2">
                      {discoveryResult.selectors.map((selector, idx) => (
                        <div
                          key={idx}
                          className="flex items-start justify-between p-2 rounded bg-background"
                        >
                          <div className="space-y-1">
                            <div className="font-medium">{selector.field}</div>
                            <code className="text-[12px] bg-surface-2 px-1 py-0.5 rounded">
                              {selector.selector}
                            </code>
                            {selector.fallback && (
                              <code className="text-[12px] bg-surface-2 px-1 py-0.5 rounded ml-1 text-text-3">
                                fallback: {selector.fallback}
                              </code>
                            )}
                          </div>
                          <div className="text-right">
                            <Badge
                              variant={
                                selector.confidence >= 90
                                  ? "default"
                                  : selector.confidence >= 70
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {selector.confidence}%
                            </Badge>
                            {selector.sampleValue && (
                              <div className="text-[12px] text-text-3 mt-1 max-w-40 truncate">
                                &quot;{selector.sampleValue}&quot;
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Existing AI Selectors from Config */}
              {config?.aiSelectors && config.aiSelectors.length > 0 && !discoveryResult && (
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Previously Discovered Selectors</h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const result = {
                          platform: config.detectedPlatform || "custom",
                          platformConfidence: 1,
                          selectors: config.aiSelectors!,
                        };
                        setDiscoveryResult(result);
                      }}
                    >
                      Use These
                    </Button>
                  </div>
                  <div className="grid gap-2">
                    {config.aiSelectors.map((selector, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded bg-surface-2"
                      >
                        <div>
                          <span className="font-medium">{selector.field}</span>
                          <code className="text-[12px] ml-2">{selector.selector}</code>
                        </div>
                        <Badge variant="outline">{selector.confidence}%</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Crawl Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Crawl Settings</CardTitle>
              <CardDescription>
                Configure how the crawler should process this site
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <Label>Max Pages</Label>
                  <div className="flex items-center gap-4 mt-2">
                    <Slider
                      value={[maxPages]}
                      onValueChange={([v]) => setMaxPages(v)}
                      min={10}
                      max={5000}
                      step={10}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={maxPages}
                      onChange={(e) => setMaxPages(Number(e.target.value))}
                      className="w-20"
                      min={10}
                      max={5000}
                    />
                  </div>
                </div>

                <div>
                  <Label>Max Depth</Label>
                  <div className="flex items-center gap-4 mt-2">
                    <Slider
                      value={[maxDepth]}
                      onValueChange={([v]) => setMaxDepth(v)}
                      min={1}
                      max={10}
                      step={1}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={maxDepth}
                      onChange={(e) => setMaxDepth(Number(e.target.value))}
                      className="w-20"
                      min={1}
                      max={10}
                    />
                  </div>
                </div>

                <div>
                  <Label>Rate Limit (req/sec)</Label>
                  <div className="flex items-center gap-4 mt-2">
                    <Slider
                      value={[rateLimit]}
                      onValueChange={([v]) => setRateLimit(v)}
                      min={1}
                      max={10}
                      step={1}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={rateLimit}
                      onChange={(e) => setRateLimit(Number(e.target.value))}
                      className="w-20"
                      min={1}
                      max={10}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label>Include Patterns (one per line)</Label>
                  <Textarea
                    value={includePatterns}
                    onChange={(e) => setIncludePatterns(e.target.value)}
                    placeholder="/products/*&#10;/collections/*&#10;/pages/*"
                    className="font-mono text-sm h-32"
                  />
                  <p className="text-[12px] text-text-3 mt-1">
                    Only crawl URLs matching these patterns
                  </p>
                </div>

                <div>
                  <Label>Exclude Patterns (one per line)</Label>
                  <Textarea
                    value={excludePatterns}
                    onChange={(e) => setExcludePatterns(e.target.value)}
                    placeholder="/cart&#10;/checkout&#10;/account/*"
                    className="font-mono text-sm h-32"
                  />
                  <p className="text-[12px] text-text-3 mt-1">
                    Skip URLs matching these patterns
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
