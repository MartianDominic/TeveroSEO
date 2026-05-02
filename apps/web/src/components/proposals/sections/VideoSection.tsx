"use client";

/**
 * VideoSection - Embedded video section editor.
 * Phase 57-05: Custom Sections
 *
 * Features:
 * - URL input with platform detection (YouTube, Vimeo, Loom)
 * - Automatic embed preview
 */

import { type FC, useMemo } from "react";
import { Video, Link, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@tevero/ui";
import { Badge } from "@/components/ui/badge";

export type VideoPlatform = "youtube" | "vimeo" | "loom" | "unknown";

export interface VideoSectionData {
  url: string;
  platform: VideoPlatform;
}

export interface VideoSectionProps {
  /** Section data */
  data: VideoSectionData;
  /** Callback when data changes */
  onChange: (data: VideoSectionData) => void;
  /** Current locale */
  locale?: "en" | "lt";
  /** Whether content is editable */
  editable?: boolean;
}

const labels = {
  en: {
    videoUrl: "Video URL",
    urlPlaceholder: "https://www.youtube.com/watch?v=...",
    preview: "Preview",
    noVideo: "Enter a video URL to see preview",
    detected: "Detected",
    unsupported: "Unsupported platform",
    supportedPlatforms: "Supported: YouTube, Vimeo, Loom",
  },
  lt: {
    videoUrl: "Video URL",
    urlPlaceholder: "https://www.youtube.com/watch?v=...",
    preview: "Perziura",
    noVideo: "Iveskite video URL kad matytumete perziura",
    detected: "Aptikta",
    unsupported: "Nepalaikoma platforma",
    supportedPlatforms: "Palaikoma: YouTube, Vimeo, Loom",
  },
};

/**
 * Detect video platform from URL.
 */
function detectPlatform(url: string): VideoPlatform {
  if (!url) return "unknown";

  const lowerUrl = url.toLowerCase();

  if (lowerUrl.includes("youtube.com") || lowerUrl.includes("youtu.be")) {
    return "youtube";
  }
  if (lowerUrl.includes("vimeo.com")) {
    return "vimeo";
  }
  if (lowerUrl.includes("loom.com")) {
    return "loom";
  }

  return "unknown";
}

/**
 * Extract video ID and generate embed URL.
 */
function getEmbedUrl(url: string, platform: VideoPlatform): string | null {
  if (!url || platform === "unknown") return null;

  try {
    const urlObj = new URL(url);

    if (platform === "youtube") {
      // youtube.com/watch?v=ID or youtu.be/ID
      const videoId =
        urlObj.searchParams.get("v") || urlObj.pathname.split("/").pop();
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }

    if (platform === "vimeo") {
      // vimeo.com/ID
      const videoId = urlObj.pathname.split("/").pop();
      if (videoId) {
        return `https://player.vimeo.com/video/${videoId}`;
      }
    }

    if (platform === "loom") {
      // loom.com/share/ID
      const pathParts = urlObj.pathname.split("/");
      const videoId = pathParts[pathParts.length - 1];
      if (videoId) {
        return `https://www.loom.com/embed/${videoId}`;
      }
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * VideoSection component.
 *
 * Renders a video editor with URL input and platform detection.
 */
export const VideoSection: FC<VideoSectionProps> = ({
  data,
  onChange,
  locale = "en",
  editable = true,
}) => {
  const t = labels[locale];

  const embedUrl = useMemo(
    () => getEmbedUrl(data.url, data.platform),
    [data.url, data.platform]
  );

  const handleUrlChange = (url: string) => {
    const platform = detectPlatform(url);
    onChange({ url, platform });
  };

  const platformLabels: Record<VideoPlatform, string> = {
    youtube: "YouTube",
    vimeo: "Vimeo",
    loom: "Loom",
    unknown: t.unsupported,
  };

  return (
    <div className="space-y-4">
      {/* Video URL input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="video-url" className="flex items-center gap-2 text-sm">
            <Link className="h-4 w-4" />
            {t.videoUrl}
          </Label>
          {data.url && (
            <Badge
              variant={data.platform !== "unknown" ? "secondary" : "outline"}
              className="text-xs"
            >
              {t.detected}: {platformLabels[data.platform]}
            </Badge>
          )}
        </div>
        <Input
          id="video-url"
          type="url"
          value={data.url}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder={t.urlPlaceholder}
          disabled={!editable}
        />
        <p className="text-xs text-muted-foreground">{t.supportedPlatforms}</p>
      </div>

      {/* Video preview */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm">
          <Video className="h-4 w-4" />
          {t.preview}
        </Label>
        <div
          className={cn(
            "rounded-lg border border-dashed border-border",
            "bg-muted/30 overflow-hidden",
            "aspect-video"
          )}
        >
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title="Video preview"
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <Play className="h-8 w-8" />
              <span className="text-sm">{t.noVideo}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoSection;
