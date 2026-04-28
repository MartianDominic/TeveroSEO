/**
 * Platform Selector Component
 * Phase 31-04: Connection Wizard UI
 *
 * Domain input with auto-detection and manual override.
 * Detects platform from domain URL and shows confidence.
 */
import { useState, useCallback } from "react";
import { Input } from "@/client/components/ui/input";
import { Button } from "@/client/components/ui/button";
import { Badge } from "@/client/components/ui/badge";
import { Label } from "@/client/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { Loader2, Search, Check, AlertCircle } from "lucide-react";
import { detectPlatformFn } from "@/serverFunctions/connections";
import type { PlatformType, DetectionResult } from "@/server/features/connections";

interface PlatformSelectorProps {
  onPlatformSelected: (platform: PlatformType, siteUrl: string) => void;
  initialDomain?: string;
}

const PLATFORM_LABELS: Record<PlatformType, string> = {
  wordpress: "WordPress",
  shopify: "Shopify",
  wix: "Wix",
  squarespace: "Squarespace",
  webflow: "Webflow",
  custom: "Custom / Other",
  pixel: "Pixel Only",
};

const CONFIDENCE_COLORS = {
  high: "bg-green-500/10 text-green-600 border-green-500/20",
  medium: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  low: "bg-gray-500/10 text-gray-600 border-gray-500/20",
};

/**
 * Platform selector with auto-detection.
 */
export function PlatformSelector({
  onPlatformSelected,
  initialDomain = "",
}: PlatformSelectorProps) {
  const [domain, setDomain] = useState(initialDomain);
  const [detecting, setDetecting] = useState(false);
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformType | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  /**
   * Normalize domain to URL format.
   */
  const normalizeUrl = useCallback((input: string): string => {
    let url = input.trim();
    if (!url) return "";

    // Add protocol if missing
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }

    // Remove trailing slash
    return url.replace(/\/$/, "");
  }, []);

  /**
   * Detect platform from domain.
   */
  const handleDetect = useCallback(async () => {
    const normalizedUrl = normalizeUrl(domain);
    if (!normalizedUrl) {
      setError("Please enter a domain");
      return;
    }

    setDetecting(true);
    setError(null);
    setDetection(null);

    try {
      const result = await detectPlatformFn({ data: { domain: normalizedUrl } });
      setDetection(result);
      setSelectedPlatform(result.platform);
    } catch (err) {
      setError((err as Error).message || "Detection failed");
    } finally {
      setDetecting(false);
    }
  }, [domain, normalizeUrl]);

  /**
   * Handle platform selection change (manual override).
   */
  const handlePlatformChange = useCallback((value: string) => {
    setSelectedPlatform(value as PlatformType);
  }, []);

  /**
   * Continue to next step.
   */
  const handleContinue = useCallback(() => {
    if (!selectedPlatform) return;
    const normalizedUrl = normalizeUrl(domain);
    onPlatformSelected(selectedPlatform, normalizedUrl);
  }, [selectedPlatform, domain, normalizeUrl, onPlatformSelected]);

  return (
    <div className="space-y-4">
      {/* Domain Input */}
      <div className="space-y-2">
        <Label htmlFor="domain">Website Domain</Label>
        <div className="flex gap-2">
          <Input
            id="domain"
            type="text"
            placeholder="example.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleDetect();
              }
            }}
            className="flex-1"
          />
          <Button
            type="button"
            onClick={handleDetect}
            disabled={detecting || !domain.trim()}
            variant="outline"
          >
            {detecting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            <span className="ml-2">Detect</span>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Enter the website domain to auto-detect the platform
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Detection Result */}
      {detection && (
        <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Detected Platform</span>
            <Badge className={CONFIDENCE_COLORS[detection.confidence]}>
              {detection.confidence} confidence
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600" />
            <span className="font-medium">
              {PLATFORM_LABELS[detection.platform]}
            </span>
          </div>

          {detection.signals.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <span>Signals: </span>
              {detection.signals.map((s, i) => (
                <span key={i}>
                  {s.found}
                  {i < detection.signals.length - 1 ? ", " : ""}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Manual Platform Override */}
      <div className="space-y-2">
        <Label htmlFor="platform">Platform</Label>
        <Select
          value={selectedPlatform || undefined}
          onValueChange={handlePlatformChange}
        >
          <SelectTrigger id="platform">
            <SelectValue placeholder="Select platform..." />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PLATFORM_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {detection && selectedPlatform !== detection.platform && (
          <p className="text-xs text-muted-foreground">
            Overriding detected platform ({PLATFORM_LABELS[detection.platform]})
          </p>
        )}
      </div>

      {/* Continue Button */}
      <Button
        type="button"
        onClick={handleContinue}
        disabled={!selectedPlatform || !domain.trim()}
        className="w-full"
      >
        Continue
      </Button>
    </div>
  );
}

export default PlatformSelector;
