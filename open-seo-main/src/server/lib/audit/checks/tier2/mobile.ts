/**
 * Tier 2 Mobile Checks (T2-18 to T2-21)
 * Phase 32: 107 SEO Checks Implementation
 *
 * Mobile-specific UX checks using HTML heuristics.
 * Note: Full accuracy requires rendering; these use DOM-based estimation.
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";

/**
 * Estimate element position from DOM order.
 * Returns estimated pixel offset from top (heuristic).
 */
function estimateElementPosition($: CheckContext["$"], selector: string): number | null {
  const element = $(selector).first();
  if (!element.length) return null;

  // Count elements before this one in the DOM
  let position = 0;
  const body = $("body");

  // Simple heuristic: count preceding siblings and ancestors
  element.parents().each((_, parent) => {
    $(parent)
      .children()
      .each((_, child) => {
        if (child === element[0]) return false;
        // Estimate height based on element type
        const tagName = child.tagName?.toLowerCase() ?? "";
        if (tagName === "header" || tagName === "nav") position += 80;
        else if (tagName === "div" || tagName === "section") position += 100;
        else if (tagName === "p") position += 40;
        else if (tagName === "h1" || tagName === "h2") position += 60;
        else position += 30;
        return undefined;
      });
    return undefined;
  });

  return position;
}

/**
 * Detect interstitial/popup patterns in HTML.
 */
function detectInterstitials($: CheckContext["$"]): Array<{ type: string; selector: string }> {
  const patterns: Array<{ type: string; selector: string }> = [];

  // Check for common popup/modal patterns
  const modalPatterns = [
    { selector: "[class*='modal']", type: "modal" },
    { selector: "[class*='Modal']", type: "modal" },
    { selector: "[class*='popup']", type: "popup" },
    { selector: "[class*='Popup']", type: "popup" },
    { selector: "[class*='overlay']", type: "overlay" },
    { selector: "[class*='Overlay']", type: "overlay" },
    { selector: "[class*='interstitial']", type: "interstitial" },
    { selector: "[class*='dialog']", type: "dialog" },
    { selector: "[class*='Dialog']", type: "dialog" },
    { selector: "[role='dialog']", type: "dialog" },
    { selector: "[class*='newsletter']", type: "newsletter-popup" },
    { selector: "[class*='subscribe']", type: "subscribe-popup" },
    { selector: "[class*='cookie']", type: "cookie-banner" },
    { selector: "[class*='consent']", type: "consent-banner" },
    { selector: "[class*='lightbox']", type: "lightbox" },
  ];

  for (const { selector, type } of modalPatterns) {
    const elements = $(selector);
    if (elements.length > 0) {
      // Check if element appears to be visible/blocking
      elements.each((_, el) => {
        const style = $(el).attr("style") ?? "";
        const className = $(el).attr("class") ?? "";

        // Skip if explicitly hidden
        if (
          style.includes("display: none") ||
          style.includes("display:none") ||
          className.includes("hidden") ||
          className.includes("closed")
        ) {
          return;
        }

        // Check for fixed/absolute positioning (blocking patterns)
        if (
          style.includes("position: fixed") ||
          style.includes("position:fixed") ||
          style.includes("position: absolute") ||
          style.includes("position:absolute") ||
          className.includes("fixed") ||
          className.includes("absolute")
        ) {
          patterns.push({ type, selector });
          return false; // Stop after finding one of this type
        }
      });
    }
  }

  return patterns;
}

/**
 * Extract inline style value.
 */
function extractStyleValue(
  style: string,
  property: string
): string | null {
  const regex = new RegExp(`${property}\\s*:\\s*([^;]+)`, "i");
  const match = style.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Parse size value (px, rem, em) to pixels.
 */
function parseSizeToPixels(value: string): number | null {
  const match = value.match(/^([\d.]+)(px|rem|em|pt|%)?$/i);
  if (!match) return null;

  const num = parseFloat(match[1]);
  const unit = (match[2] ?? "px").toLowerCase();

  switch (unit) {
    case "px":
      return num;
    case "rem":
      return num * 16; // Assume 16px base
    case "em":
      return num * 16; // Assume 16px base
    case "pt":
      return num * 1.333; // pt to px
    case "%":
      return null; // Can't convert without parent size
    default:
      return num;
  }
}

/**
 * T2-18: H1 above fold on mobile
 * Estimate if H1 is within ~500px from top (mobile viewport).
 */
registerCheck({
  id: "T2-18",
  name: "H1 above fold on mobile",
  tier: 2,
  category: "mobile",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Move H1 element higher in the DOM, before large images or navigation",
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;
    const h1 = $("h1").first();

    if (!h1.length) {
      return {
        checkId: "T2-18",
        passed: false,
        severity: "high",
        message: "No H1 element found",
        details: { hasH1: false },
        autoEditable: true,
        editRecipe: "Add H1 element above the fold",
      };
    }

    // Estimate position using DOM traversal
    const estimatedPosition = estimateElementPosition($, "h1");
    const mobileViewportHeight = 500; // Typical mobile "fold"

    // Alternative: count major elements before H1
    let elementsBeforeH1 = 0;
    let foundH1 = false;
    $("body")
      .children()
      .each((_, el) => {
        if (foundH1) return;
        if ($(el).is("h1") || $(el).find("h1").length > 0) {
          foundH1 = true;
          return false;
        }
        const tagName = el.tagName?.toLowerCase() ?? "";
        if (["header", "nav", "div", "section", "aside"].includes(tagName)) {
          elementsBeforeH1++;
        }
        return undefined;
      });

    // Heuristic: if more than 3 major elements before H1, likely below fold
    const likelyAboveFold = elementsBeforeH1 <= 3 && (estimatedPosition ?? 0) < mobileViewportHeight;

    return {
      checkId: "T2-18",
      passed: likelyAboveFold,
      severity: likelyAboveFold ? "info" : "medium",
      message: likelyAboveFold
        ? "H1 appears to be above the fold on mobile"
        : "H1 may be below the fold on mobile (large content before it)",
      details: {
        hasH1: true,
        elementsBeforeH1,
        estimatedPosition,
        mobileViewportHeight,
        likelyAboveFold,
      },
      autoEditable: !likelyAboveFold,
      editRecipe: likelyAboveFold
        ? undefined
        : "Move H1 element higher in the DOM, reduce header/nav size",
    };
  },
});

/**
 * T2-19: No interstitials on load
 * Detect overlay/modal patterns that may block content.
 */
registerCheck({
  id: "T2-19",
  name: "No interstitials on load",
  tier: 2,
  category: "mobile",
  severity: "high",
  autoEditable: false,
  run: (ctx: CheckContext): CheckResult => {
    const interstitials = detectInterstitials(ctx.$);

    // Filter out acceptable patterns (cookie banners are often required)
    const blockingInterstitials = interstitials.filter(
      (i) => !["cookie-banner", "consent-banner"].includes(i.type)
    );

    const passed = blockingInterstitials.length === 0;

    return {
      checkId: "T2-19",
      passed,
      severity: passed ? "info" : "high",
      message: passed
        ? "No blocking interstitials detected"
        : `Detected ${blockingInterstitials.length} potential interstitial(s): ${blockingInterstitials.map((i) => i.type).join(", ")}`,
      details: {
        interstitialsFound: interstitials.length,
        blockingInterstitials: blockingInterstitials.length,
        types: blockingInterstitials.map((i) => i.type),
        note: "Detection is heuristic; may have false positives",
      },
      autoEditable: false,
    };
  },
});

/**
 * T2-20: Tap targets >= 48px
 * Check button/link sizes (from inline styles or class patterns).
 */
registerCheck({
  id: "T2-20",
  name: "Tap targets >= 48px",
  tier: 2,
  category: "mobile",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Increase button/link size to at least 48x48 pixels for mobile tap targets",
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;
    const tapTargets: Array<{ element: string; width: number | null; height: number | null }> = [];
    const smallTargets: Array<{ element: string; width: number | null; height: number | null }> = [];

    // Check buttons and links with inline styles
    $("button, a, [role='button'], input[type='submit'], input[type='button']").each((_, el) => {
      const style = $(el).attr("style") ?? "";
      const className = $(el).attr("class") ?? "";
      const text = $(el).text().trim().substring(0, 20);

      let width: number | null = null;
      let height: number | null = null;

      // Extract from inline style
      const widthStr = extractStyleValue(style, "width");
      const heightStr = extractStyleValue(style, "height");
      const minWidth = extractStyleValue(style, "min-width");
      const minHeight = extractStyleValue(style, "min-height");
      const padding = extractStyleValue(style, "padding");

      if (widthStr) width = parseSizeToPixels(widthStr);
      if (heightStr) height = parseSizeToPixels(heightStr);
      if (minWidth) width = Math.max(width ?? 0, parseSizeToPixels(minWidth) ?? 0);
      if (minHeight) height = Math.max(height ?? 0, parseSizeToPixels(minHeight) ?? 0);

      // Add padding to size estimate
      if (padding) {
        const paddingPx = parseSizeToPixels(padding);
        if (paddingPx) {
          width = (width ?? 0) + paddingPx * 2;
          height = (height ?? 0) + paddingPx * 2;
        }
      }

      // Check for common small pattern classes
      const isLikelySmall =
        className.includes("small") ||
        className.includes("xs") ||
        className.includes("tiny") ||
        className.includes("compact");

      const element = `${el.tagName?.toLowerCase() ?? "element"}${text ? `: "${text}"` : ""}`;

      if (width !== null || height !== null || isLikelySmall) {
        tapTargets.push({ element, width, height });

        if (
          isLikelySmall ||
          (width !== null && width < 48) ||
          (height !== null && height < 48)
        ) {
          smallTargets.push({ element, width, height });
        }
      }
    });

    // If no size info found, we can't determine - pass with note
    if (tapTargets.length === 0) {
      return {
        checkId: "T2-20",
        passed: true,
        severity: "info",
        message: "No tap target size information found in inline styles",
        details: {
          checked: false,
          note: "Sizes defined in external CSS cannot be checked",
        },
        autoEditable: false,
      };
    }

    const passed = smallTargets.length === 0;

    return {
      checkId: "T2-20",
      passed,
      severity: passed ? "info" : "medium",
      message: passed
        ? `All ${tapTargets.length} measured tap targets appear >= 48px`
        : `Found ${smallTargets.length} potentially small tap target(s) (< 48px)`,
      details: {
        measuredTargets: tapTargets.length,
        smallTargets: smallTargets.length,
        examples: smallTargets.slice(0, 5),
        minRecommended: "48x48px",
        note: "Only inline styles checked; external CSS not analyzed",
      },
      autoEditable: !passed,
      editRecipe: passed
        ? undefined
        : "Increase button/link size to at least 48x48 pixels",
    };
  },
});

/**
 * T2-21: Text >= 16px on mobile
 * Check base font size in styles.
 */
registerCheck({
  id: "T2-21",
  name: "Text >= 16px on mobile",
  tier: 2,
  category: "mobile",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Increase base font-size to at least 16px for mobile readability",
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;
    const fontSizes: number[] = [];
    const smallFonts: Array<{ element: string; size: number }> = [];

    // Check body font-size
    const bodyStyle = $("body").attr("style") ?? "";
    const bodyFontSize = extractStyleValue(bodyStyle, "font-size");
    if (bodyFontSize) {
      const size = parseSizeToPixels(bodyFontSize);
      if (size !== null) {
        fontSizes.push(size);
        if (size < 16) {
          smallFonts.push({ element: "body", size });
        }
      }
    }

    // Check html font-size (for rem base)
    const htmlStyle = $("html").attr("style") ?? "";
    const htmlFontSize = extractStyleValue(htmlStyle, "font-size");
    if (htmlFontSize) {
      const size = parseSizeToPixels(htmlFontSize);
      if (size !== null) {
        fontSizes.push(size);
        if (size < 16) {
          smallFonts.push({ element: "html", size });
        }
      }
    }

    // Check paragraphs with inline styles
    $("p, span, div, li").each((i, el) => {
      if (i > 20) return false; // Limit checking

      const style = $(el).attr("style") ?? "";
      const fontSize = extractStyleValue(style, "font-size");

      if (fontSize) {
        const size = parseSizeToPixels(fontSize);
        if (size !== null) {
          fontSizes.push(size);
          if (size < 16) {
            const text = $(el).text().trim().substring(0, 20);
            smallFonts.push({
              element: `${el.tagName?.toLowerCase() ?? "element"}${text ? `: "${text}"` : ""}`,
              size,
            });
          }
        }
      }

      return undefined;
    });

    // Check meta viewport for user-scalable=no (bad practice)
    const viewport = $('meta[name="viewport"]').attr("content") ?? "";
    const userScalableNo =
      viewport.includes("user-scalable=no") || viewport.includes("user-scalable=0");

    // If no font size info found, we can't determine - pass with note
    if (fontSizes.length === 0) {
      const passed = !userScalableNo;

      return {
        checkId: "T2-21",
        passed,
        severity: passed ? "info" : "medium",
        message: userScalableNo
          ? "user-scalable=no in viewport meta (prevents zooming)"
          : "No font-size information found in inline styles",
        details: {
          checked: false,
          userScalableNo,
          note: "Sizes defined in external CSS cannot be checked",
        },
        autoEditable: !passed,
        editRecipe: passed
          ? undefined
          : "Remove user-scalable=no from viewport meta tag",
      };
    }

    const hasSmallFonts = smallFonts.length > 0;
    const passed = !hasSmallFonts && !userScalableNo;

    return {
      checkId: "T2-21",
      passed,
      severity: passed ? "info" : "medium",
      message: passed
        ? `All ${fontSizes.length} measured font sizes are >= 16px`
        : hasSmallFonts
          ? `Found ${smallFonts.length} element(s) with font-size < 16px`
          : "user-scalable=no in viewport meta",
      details: {
        measuredFontSizes: fontSizes.length,
        smallFonts: smallFonts.length,
        examples: smallFonts.slice(0, 5),
        minRecommended: "16px",
        userScalableNo,
        note: "Only inline styles checked; external CSS not analyzed",
      },
      autoEditable: !passed,
      editRecipe: passed
        ? undefined
        : hasSmallFonts
          ? "Increase font-size to at least 16px for mobile readability"
          : "Remove user-scalable=no from viewport meta tag",
    };
  },
});

// Export check IDs for documentation
export const mobileCheckIds = ["T2-18", "T2-19", "T2-20", "T2-21"];
