/**
 * Tier 1 Image Basics Checks (T1-33 to T1-38)
 * Category F: Image optimization
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";

// T1-33: All images have alt
registerCheck({
  id: "T1-33",
  name: "All images have alt text",
  tier: 1,
  category: "image-basics",
  severity: "high",
  autoEditable: true,
  editRecipe: "Add descriptive alt text to images without alt attribute",
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;
    const allImages = $("img").length;
    const missingAlt = $("img:not([alt])").length;
    const passed = missingAlt === 0;
    return {
      checkId: "T1-33",
      passed,
      severity: passed ? "info" : "high",
      message: passed ? `All ${allImages} images have alt text` : `${missingAlt}/${allImages} images missing alt text`,
      details: { total: allImages, missing: missingAlt },
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Add descriptive alt text to images without alt attribute",
    };
  },
});

// T1-34: Alt text descriptive
registerCheck({
  id: "T1-34",
  name: "Alt text is descriptive",
  tier: 1,
  category: "image-basics",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Replace generic alt text with descriptive content",
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;
    const images = $("img[alt]").toArray();
    if (images.length === 0) {
      return { checkId: "T1-34", passed: true, severity: "info", message: "No images with alt found", autoEditable: false };
    }
    const badAlts = ["image", "img", "photo", "picture", "icon", "logo", "banner", ""];
    let poor = 0;
    for (const img of images) {
      const alt = ($(img).attr("alt") ?? "").toLowerCase().trim();
      if (badAlts.includes(alt) || alt.length < 5) poor++;
    }
    const passed = poor === 0;
    return {
      checkId: "T1-34",
      passed,
      severity: passed ? "info" : "medium",
      message: passed ? "All alt text is descriptive" : `${poor}/${images.length} images have poor alt text`,
      details: { total: images.length, poor },
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Replace generic alt text with descriptive content",
    };
  },
});

// T1-35: Explicit width/height
registerCheck({
  id: "T1-35",
  name: "Images have width/height",
  tier: 1,
  category: "image-basics",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Add explicit width and height attributes to prevent CLS",
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;
    const images = $("img").toArray();
    if (images.length === 0) {
      return { checkId: "T1-35", passed: true, severity: "info", message: "No images found", autoEditable: false };
    }
    let missing = 0;
    for (const img of images) {
      const hasWidth = $(img).attr("width") !== undefined;
      const hasHeight = $(img).attr("height") !== undefined;
      if (!hasWidth || !hasHeight) missing++;
    }
    const passed = missing === 0;
    return {
      checkId: "T1-35",
      passed,
      severity: passed ? "info" : "medium",
      message: passed ? "All images have explicit dimensions" : `${missing}/${images.length} images missing width/height`,
      details: { total: images.length, missing },
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Add explicit width and height attributes to prevent CLS",
    };
  },
});

// T1-36: loading="lazy" on images
registerCheck({
  id: "T1-36",
  name: "Images use lazy loading",
  tier: 1,
  category: "image-basics",
  severity: "low",
  autoEditable: true,
  editRecipe: "Add loading=\"lazy\" to below-the-fold images",
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;
    // Exclude first image (likely hero/LCP)
    const images = $("img").slice(1).toArray();
    if (images.length === 0) {
      return { checkId: "T1-36", passed: true, severity: "info", message: "No below-fold images", autoEditable: false };
    }
    let notLazy = 0;
    for (const img of images) {
      const loading = $(img).attr("loading");
      if (loading !== "lazy") notLazy++;
    }
    const passed = notLazy === 0;
    return {
      checkId: "T1-36",
      passed,
      severity: passed ? "info" : "low",
      message: passed ? "All below-fold images use lazy loading" : `${notLazy}/${images.length} images not using lazy loading`,
      details: { total: images.length, notLazy },
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Add loading=\"lazy\" to below-the-fold images",
    };
  },
});

// T1-37: WebP/AVIF format
registerCheck({
  id: "T1-37",
  name: "Images use modern format",
  tier: 1,
  category: "image-basics",
  severity: "low",
  autoEditable: false,
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;
    const images = $("img[src]").toArray();
    if (images.length === 0) {
      return { checkId: "T1-37", passed: true, severity: "info", message: "No images found", autoEditable: false };
    }
    let modern = 0;
    for (const img of images) {
      const src = $(img).attr("src") ?? "";
      if (/\.(webp|avif)(\?|$)/i.test(src)) modern++;
    }
    const ratio = modern / images.length;
    const passed = ratio >= 0.8; // 80% modern formats
    return {
      checkId: "T1-37",
      passed,
      severity: passed ? "info" : "low",
      message: passed ? `${Math.round(ratio * 100)}% images use WebP/AVIF` : `Only ${Math.round(ratio * 100)}% images use modern formats`,
      details: { total: images.length, modern, ratio },
      autoEditable: false,
    };
  },
});

// T1-38: Lowercase hyphenated filename
registerCheck({
  id: "T1-38",
  name: "Image filenames are SEO-friendly",
  tier: 1,
  category: "image-basics",
  severity: "low",
  autoEditable: false,
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;
    const images = $("img[src]").toArray();
    if (images.length === 0) {
      return { checkId: "T1-38", passed: true, severity: "info", message: "No images found", autoEditable: false };
    }
    let seoFriendly = 0;
    for (const img of images) {
      const src = $(img).attr("src") ?? "";
      try {
        const filename = src.split("/").pop()?.split("?")[0] ?? "";
        // Check: lowercase, uses hyphens, no underscores, descriptive (>3 chars before ext)
        const isLower = filename === filename.toLowerCase();
        const hasHyphens = filename.includes("-");
        const noUnderscores = !filename.includes("_");
        const namepart = filename.replace(/\.[^.]+$/, "");
        if (isLower && (hasHyphens || namepart.length > 10) && noUnderscores) seoFriendly++;
      } catch {
        // Skip invalid URLs
      }
    }
    const ratio = seoFriendly / images.length;
    const passed = ratio >= 0.7;
    return {
      checkId: "T1-38",
      passed,
      severity: passed ? "info" : "low",
      message: passed ? `${Math.round(ratio * 100)}% images have SEO-friendly filenames` : `Only ${Math.round(ratio * 100)}% images have SEO-friendly filenames`,
      details: { total: images.length, seoFriendly },
      autoEditable: false,
    };
  },
});
