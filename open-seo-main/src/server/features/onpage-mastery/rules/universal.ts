/**
 * Universal SEO Rules
 * Phase 92-04: RuleEngineService
 *
 * Rules that apply to all verticals. Implements the core 41-point scorecard
 * with structure, content, trust, readability, and schema rules.
 */

import type { RuleDefinition, RuleContext } from "./types";

/**
 * Check heading hierarchy for logical order (H1 -> H2 -> H3, etc.).
 */
function checkHeadingHierarchy($: RuleContext["$"]): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const headings = $("h1, h2, h3, h4, h5, h6");
  let lastLevel = 0;

  headings.each((_, el) => {
    const tag = $(el).prop("tagName")?.toLowerCase() || "";
    const level = parseInt(tag.replace("h", ""), 10);

    if (lastLevel > 0 && level > lastLevel + 1) {
      issues.push(`Jumped from H${lastLevel} to H${level}`);
    }
    lastLevel = level;
  });

  return { valid: issues.length === 0, issues };
}

/**
 * Universal rules that apply to all verticals.
 * 25 rules covering structure, content, trust, readability, and schema.
 */
export const universalRules: RuleDefinition[] = [
  // ============================================
  // STRUCTURE RULES (R-01 to R-08)
  // ============================================
  {
    id: "R-01",
    name: "Single H1",
    description: "Page has exactly one H1 heading",
    category: "structure",
    weight: 1.5,
    severity: "high",
    verticals: "all",
    evaluate: (ctx) => {
      const h1Count = ctx.$("h1").length;
      return {
        passed: h1Count === 1,
        score: h1Count === 1 ? 100 : 0,
        message:
          h1Count === 1
            ? "Single H1 present"
            : `Found ${h1Count} H1s (expected 1)`,
        details: { h1Count },
      };
    },
  },
  {
    id: "R-02",
    name: "Heading hierarchy",
    description: "Headings follow logical order (H1 -> H2 -> H3)",
    category: "structure",
    weight: 1.0,
    severity: "medium",
    verticals: "all",
    evaluate: (ctx) => {
      const { valid, issues } = checkHeadingHierarchy(ctx.$);
      return {
        passed: valid,
        score: valid ? 100 : Math.max(0, 100 - issues.length * 25),
        message: valid
          ? "Heading hierarchy is logical"
          : `Heading issues: ${issues.join(", ")}`,
        details: { issues },
      };
    },
  },
  {
    id: "R-03",
    name: "Meta title present",
    description: "Page has a title tag with content",
    category: "structure",
    weight: 2.0,
    severity: "critical",
    verticals: "all",
    evaluate: (ctx) => {
      const title = ctx.$("title").text().trim();
      const hasTitle = title.length > 0;
      const goodLength = title.length >= 30 && title.length <= 60;
      return {
        passed: hasTitle,
        score: hasTitle ? (goodLength ? 100 : 70) : 0,
        message: hasTitle
          ? `Title: "${title.slice(0, 50)}..." (${title.length} chars)`
          : "Missing title tag",
        details: { title, length: title.length },
      };
    },
  },
  {
    id: "R-04",
    name: "Meta description present",
    description: "Page has a meta description with content",
    category: "structure",
    weight: 1.5,
    severity: "high",
    verticals: "all",
    evaluate: (ctx) => {
      const desc =
        ctx.$('meta[name="description"]').attr("content")?.trim() || "";
      const hasDesc = desc.length > 0;
      const goodLength = desc.length >= 120 && desc.length <= 160;
      return {
        passed: hasDesc,
        score: hasDesc ? (goodLength ? 100 : 70) : 0,
        message: hasDesc
          ? `Description: ${desc.length} chars`
          : "Missing meta description",
        details: { description: desc.slice(0, 100), length: desc.length },
      };
    },
  },
  {
    id: "R-05",
    name: "Canonical URL set",
    description: "Page has a canonical URL defined",
    category: "structure",
    weight: 1.0,
    severity: "medium",
    verticals: "all",
    evaluate: (ctx) => {
      const canonical = ctx.$('link[rel="canonical"]').attr("href") || "";
      const hasCanonical = canonical.length > 0;
      return {
        passed: hasCanonical,
        score: hasCanonical ? 100 : 0,
        message: hasCanonical
          ? `Canonical: ${canonical}`
          : "Missing canonical URL",
        details: { canonical },
      };
    },
  },
  {
    id: "R-06",
    name: "Language attribute set",
    description: "HTML element has lang attribute",
    category: "structure",
    weight: 0.5,
    severity: "low",
    verticals: "all",
    evaluate: (ctx) => {
      const lang = ctx.$("html").attr("lang") || "";
      const hasLang = lang.length > 0;
      return {
        passed: hasLang,
        score: hasLang ? 100 : 0,
        message: hasLang ? `Language: ${lang}` : "Missing lang attribute",
        details: { lang },
      };
    },
  },
  {
    id: "R-07",
    name: "Viewport meta tag",
    description: "Page is mobile-friendly with viewport meta tag",
    category: "structure",
    weight: 1.0,
    severity: "medium",
    verticals: "all",
    evaluate: (ctx) => {
      const viewport =
        ctx.$('meta[name="viewport"]').attr("content") || "";
      const hasViewport = viewport.includes("width=");
      return {
        passed: hasViewport,
        score: hasViewport ? 100 : 0,
        message: hasViewport
          ? "Viewport meta tag present"
          : "Missing viewport meta tag",
        details: { viewport },
      };
    },
  },
  {
    id: "R-08",
    name: "Content structure",
    description: "Page has proper content structure (header, main, footer)",
    category: "structure",
    weight: 0.5,
    severity: "low",
    verticals: "all",
    evaluate: (ctx) => {
      const hasMain = ctx.$("main").length > 0;
      const hasArticle = ctx.$("article").length > 0;
      const hasSection = ctx.$("section").length > 0;
      const hasStructure = hasMain || hasArticle || hasSection;
      return {
        passed: hasStructure,
        score: hasStructure ? 100 : 50,
        message: hasStructure
          ? "Semantic structure elements present"
          : "Consider using semantic HTML (main, article, section)",
        details: { hasMain, hasArticle, hasSection },
      };
    },
  },

  // ============================================
  // CONTENT RULES (R-09 to R-16)
  // ============================================
  {
    id: "R-09",
    name: "Minimum word count",
    description: "Content meets minimum word count for vertical",
    category: "content",
    weight: 2.0,
    severity: "high",
    verticals: "all",
    evaluate: (ctx) => {
      const minWords = ctx.isYmyl ? 800 : 400;
      const wordCount = ctx.metadata.wordCount;
      const passed = wordCount >= minWords;
      return {
        passed,
        score: passed ? 100 : Math.min(100, (wordCount / minWords) * 100),
        message: `${wordCount} words (minimum: ${minWords})`,
        details: { wordCount, minWords, isYmyl: ctx.isYmyl },
      };
    },
  },
  {
    id: "R-10",
    name: "Keyword in first 100 words",
    description: "Primary keyword appears early in content",
    category: "content",
    weight: 1.5,
    severity: "high",
    verticals: "all",
    evaluate: (ctx) => {
      // Extract first 100 words from body
      const words = ctx.text.split(/\s+/).slice(0, 100).join(" ").toLowerCase();
      // Check H1 as proxy for primary keyword
      const h1 = ctx.$("h1").first().text().toLowerCase().trim();
      const keywordWords = h1.split(/\s+/).filter((w) => w.length > 3);

      // Check if any significant keyword word appears in first 100 words
      const found = keywordWords.some((kw) => words.includes(kw));
      return {
        passed: found || keywordWords.length === 0,
        score: found ? 100 : keywordWords.length === 0 ? 100 : 0,
        message: found
          ? "Keyword found in first 100 words"
          : "Consider adding primary keyword earlier in content",
        details: { h1, keywordsChecked: keywordWords },
      };
    },
  },
  {
    id: "R-11",
    name: "Content depth",
    description: "Content covers topic with sufficient depth (H2 sections)",
    category: "content",
    weight: 1.0,
    severity: "medium",
    verticals: "all",
    evaluate: (ctx) => {
      const h2Count = ctx.$("h2").length;
      const minH2 = ctx.isYmyl ? 4 : 2;
      const passed = h2Count >= minH2;
      return {
        passed,
        score: passed ? 100 : Math.min(100, (h2Count / minH2) * 100),
        message: `${h2Count} H2 sections (recommended: ${minH2}+)`,
        details: { h2Count, minH2 },
      };
    },
  },
  {
    id: "R-12",
    name: "Image alt text",
    description: "All images have descriptive alt text",
    category: "content",
    weight: 1.0,
    severity: "medium",
    verticals: "all",
    evaluate: (ctx) => {
      const images = ctx.$("img");
      const total = images.length;
      if (total === 0) {
        return {
          passed: true,
          score: 100,
          message: "No images to check",
        };
      }

      let withAlt = 0;
      images.each((_, el) => {
        const alt = ctx.$(el).attr("alt");
        if (alt && alt.trim().length > 0) withAlt++;
      });

      const percent = (withAlt / total) * 100;
      return {
        passed: percent >= 90,
        score: Math.round(percent),
        message: `${withAlt}/${total} images have alt text`,
        details: { total, withAlt, percent },
      };
    },
  },
  {
    id: "R-13",
    name: "Internal links present",
    description: "Page has internal links for navigation",
    category: "content",
    weight: 1.0,
    severity: "medium",
    verticals: "all",
    evaluate: (ctx) => {
      const internal = ctx.metadata.links.internal;
      const passed = internal >= 2;
      return {
        passed,
        score: passed ? 100 : internal >= 1 ? 50 : 0,
        message: `${internal} internal links`,
        details: { internalLinks: internal },
      };
    },
  },
  {
    id: "R-14",
    name: "External links present",
    description: "Page has external links for authority",
    category: "content",
    weight: 0.5,
    severity: "low",
    verticals: "all",
    evaluate: (ctx) => {
      const external = ctx.metadata.links.external;
      const passed = external >= 1;
      return {
        passed,
        score: passed ? 100 : 50,
        message: passed
          ? `${external} external links`
          : "Consider adding external references",
        details: { externalLinks: external },
      };
    },
  },
  {
    id: "R-15",
    name: "Lists usage",
    description: "Content uses lists for scanability",
    category: "content",
    weight: 0.5,
    severity: "low",
    verticals: "all",
    evaluate: (ctx) => {
      const ulCount = ctx.$("ul").length;
      const olCount = ctx.$("ol").length;
      const totalLists = ulCount + olCount;
      const passed = totalLists >= 1;
      return {
        passed,
        score: passed ? 100 : 50,
        message: passed
          ? `${totalLists} lists present`
          : "Consider using lists for better scanability",
        details: { ulCount, olCount },
      };
    },
  },
  {
    id: "R-16",
    name: "No thin content",
    description: "Page has substantial content beyond boilerplate",
    category: "content",
    weight: 1.5,
    severity: "high",
    verticals: "all",
    evaluate: (ctx) => {
      // Check content-to-code ratio by comparing text length to HTML length
      const textLength = ctx.text.length;
      const htmlLength = ctx.html.length;
      const ratio = htmlLength > 0 ? textLength / htmlLength : 0;

      // Good ratio is typically > 0.15 for content pages
      const passed = ratio > 0.1 && textLength > 500;
      return {
        passed,
        score: passed ? 100 : ratio > 0.05 ? 50 : 0,
        message: passed
          ? `Good content density (${Math.round(ratio * 100)}%)`
          : "Content may be too thin",
        details: { textLength, htmlLength, ratio: Math.round(ratio * 100) },
      };
    },
  },

  // ============================================
  // TRUST RULES (R-17 to R-22)
  // ============================================
  {
    id: "R-17",
    name: "Author byline present",
    description: "Content has visible author attribution",
    category: "trust",
    weight: 1.5,
    severity: "high",
    verticals: "all",
    evaluate: (ctx) => {
      const hasAuthor =
        ctx.$(
          '[rel="author"], .author, .byline, [itemtype*="Person"], [itemprop="author"]'
        ).length > 0;
      return {
        passed: hasAuthor,
        score: hasAuthor ? 100 : 0,
        message: hasAuthor ? "Author attribution found" : "No author byline",
      };
    },
  },
  {
    id: "R-18",
    name: "Published date visible",
    description: "Content shows publication date",
    category: "trust",
    weight: 1.0,
    severity: "medium",
    verticals: "all",
    evaluate: (ctx) => {
      const hasDate =
        ctx.$(
          'time[datetime], [itemprop="datePublished"], .published-date, .post-date, .entry-date'
        ).length > 0;
      return {
        passed: hasDate,
        score: hasDate ? 100 : 0,
        message: hasDate ? "Publication date visible" : "No publication date found",
      };
    },
  },
  {
    id: "R-19",
    name: "Contact information accessible",
    description: "Site has accessible contact information",
    category: "trust",
    weight: 0.5,
    severity: "low",
    verticals: "all",
    evaluate: (ctx) => {
      const hasContact =
        ctx.$('a[href^="mailto:"], a[href^="tel:"], .contact').length > 0;
      const hasContactLink =
        ctx.$('a[href*="contact"], a[href*="about"]').length > 0;
      const found = hasContact || hasContactLink;
      return {
        passed: found,
        score: found ? 100 : 50,
        message: found
          ? "Contact information accessible"
          : "Consider adding contact information",
      };
    },
  },
  {
    id: "R-20",
    name: "Privacy policy link",
    description: "Site has privacy policy accessible",
    category: "trust",
    weight: 0.5,
    severity: "low",
    verticals: "all",
    evaluate: (ctx) => {
      const hasPrivacy =
        ctx.$('a[href*="privacy"], a[href*="policy"]').length > 0;
      return {
        passed: hasPrivacy,
        score: hasPrivacy ? 100 : 50,
        message: hasPrivacy
          ? "Privacy policy linked"
          : "Consider adding privacy policy link",
      };
    },
  },
  {
    id: "R-21",
    name: "HTTPS security",
    description: "Page uses HTTPS protocol",
    category: "trust",
    weight: 1.0,
    severity: "high",
    verticals: "all",
    evaluate: (ctx) => {
      const isHttps = ctx.url.startsWith("https://");
      return {
        passed: isHttps,
        score: isHttps ? 100 : 0,
        message: isHttps ? "Page uses HTTPS" : "Page should use HTTPS",
        details: { url: ctx.url },
      };
    },
  },
  {
    id: "R-22",
    name: "Social proof present",
    description: "Page includes social proof elements",
    category: "trust",
    weight: 0.5,
    severity: "low",
    verticals: "all",
    evaluate: (ctx) => {
      const hasReviews =
        ctx.$(
          '[itemtype*="Review"], .review, .testimonial, .rating, [itemprop="aggregateRating"]'
        ).length > 0;
      return {
        passed: hasReviews,
        score: hasReviews ? 100 : 50,
        message: hasReviews
          ? "Social proof elements found"
          : "Consider adding reviews or testimonials",
      };
    },
  },

  // ============================================
  // SCHEMA RULES (R-23 to R-26)
  // ============================================
  {
    id: "R-23",
    name: "Structured data present",
    description: "Page has JSON-LD structured data",
    category: "schema",
    weight: 1.5,
    severity: "high",
    verticals: "all",
    evaluate: (ctx) => {
      const schemas = ctx.metadata.schemas;
      const hasSchema = schemas.length > 0;
      return {
        passed: hasSchema,
        score: hasSchema ? 100 : 0,
        message: hasSchema
          ? `${schemas.length} JSON-LD schemas found`
          : "No structured data found",
        details: { schemaCount: schemas.length },
      };
    },
  },
  {
    id: "R-24",
    name: "Organization schema",
    description: "Site has Organization schema for brand identity",
    category: "schema",
    weight: 0.5,
    severity: "low",
    verticals: "all",
    evaluate: (ctx) => {
      const hasOrg = ctx.metadata.schemas.some(
        (s) => s.includes('"@type":"Organization"') || s.includes('"@type": "Organization"')
      );
      return {
        passed: hasOrg,
        score: hasOrg ? 100 : 50,
        message: hasOrg
          ? "Organization schema found"
          : "Consider adding Organization schema",
      };
    },
  },
  {
    id: "R-25",
    name: "Breadcrumb schema",
    description: "Page has BreadcrumbList schema for navigation",
    category: "schema",
    weight: 0.5,
    severity: "low",
    verticals: "all",
    evaluate: (ctx) => {
      const hasBreadcrumb = ctx.metadata.schemas.some(
        (s) =>
          s.includes('"@type":"BreadcrumbList"') ||
          s.includes('"@type": "BreadcrumbList"')
      );
      return {
        passed: hasBreadcrumb,
        score: hasBreadcrumb ? 100 : 50,
        message: hasBreadcrumb
          ? "Breadcrumb schema found"
          : "Consider adding Breadcrumb schema",
      };
    },
  },
  {
    id: "R-26",
    name: "Article schema for content",
    description: "Article pages have Article or BlogPosting schema",
    category: "schema",
    weight: 0.5,
    severity: "low",
    verticals: "all",
    evaluate: (ctx) => {
      const hasArticleSchema = ctx.metadata.schemas.some(
        (s) =>
          s.includes('"@type":"Article"') ||
          s.includes('"@type": "Article"') ||
          s.includes('"@type":"BlogPosting"') ||
          s.includes('"@type": "BlogPosting"')
      );
      // Only check if this looks like an article page
      const isArticlePage = ctx.url.includes("/blog") || ctx.url.includes("/article");
      return {
        passed: hasArticleSchema || !isArticlePage,
        score: hasArticleSchema ? 100 : isArticlePage ? 50 : 100,
        message: hasArticleSchema
          ? "Article schema found"
          : isArticlePage
            ? "Consider adding Article schema"
            : "Not an article page",
      };
    },
  },

  // ============================================
  // READABILITY RULES (R-27 to R-30)
  // ============================================
  {
    id: "R-27",
    name: "Paragraph length",
    description: "Paragraphs are readable length (2-4 sentences)",
    category: "readability",
    weight: 0.5,
    severity: "low",
    verticals: "all",
    evaluate: (ctx) => {
      const paragraphs = ctx.$("p");
      let longCount = 0;
      let total = 0;

      paragraphs.each((_, el) => {
        const text = ctx.$(el).text().trim();
        if (text.length > 50) {
          // Only count substantial paragraphs
          total++;
          if (text.length > 500) longCount++;
        }
      });

      const percent = total > 0 ? ((total - longCount) / total) * 100 : 100;
      return {
        passed: percent >= 80,
        score: Math.round(percent),
        message:
          percent >= 80
            ? "Paragraph lengths are readable"
            : `${longCount}/${total} paragraphs are too long`,
        details: { longCount, total },
      };
    },
  },
  {
    id: "R-28",
    name: "Sentence clarity",
    description: "Sentences are clear and not overly complex",
    category: "readability",
    weight: 0.5,
    severity: "low",
    verticals: "all",
    evaluate: (ctx) => {
      // Simple heuristic: check for very long sentences
      const sentences = ctx.text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
      const longSentences = sentences.filter((s) => s.split(/\s+/).length > 35);
      const percent =
        sentences.length > 0
          ? ((sentences.length - longSentences.length) / sentences.length) * 100
          : 100;

      return {
        passed: percent >= 80,
        score: Math.round(percent),
        message:
          percent >= 80
            ? "Sentence clarity is good"
            : `${longSentences.length}/${sentences.length} sentences are too long`,
        details: {
          totalSentences: sentences.length,
          longSentences: longSentences.length,
        },
      };
    },
  },
  {
    id: "R-29",
    name: "Subheading frequency",
    description: "Content has subheadings every 300-500 words",
    category: "readability",
    weight: 0.5,
    severity: "low",
    verticals: "all",
    evaluate: (ctx) => {
      const wordCount = ctx.metadata.wordCount;
      const headingCount = ctx.$("h2, h3").length;
      const expectedHeadings = Math.floor(wordCount / 400);

      const hasEnough = headingCount >= Math.max(1, expectedHeadings - 1);
      return {
        passed: hasEnough,
        score: hasEnough ? 100 : Math.min(100, (headingCount / expectedHeadings) * 100),
        message: hasEnough
          ? `${headingCount} subheadings for ${wordCount} words`
          : `Consider adding more subheadings (${headingCount}/${expectedHeadings} expected)`,
        details: { headingCount, wordCount, expectedHeadings },
      };
    },
  },
  {
    id: "R-30",
    name: "Formatting variety",
    description: "Content uses varied formatting (bold, lists, quotes)",
    category: "readability",
    weight: 0.5,
    severity: "low",
    verticals: "all",
    evaluate: (ctx) => {
      const hasBold = ctx.$("strong, b").length > 0;
      const hasLists = ctx.$("ul, ol").length > 0;
      const hasQuotes = ctx.$("blockquote, q").length > 0;
      const hasTable = ctx.$("table").length > 0;

      const score =
        (hasBold ? 25 : 0) + (hasLists ? 25 : 0) + (hasQuotes ? 25 : 0) + (hasTable ? 25 : 0);
      const passed = score >= 50;

      return {
        passed,
        score,
        message: passed
          ? "Good formatting variety"
          : "Consider adding more formatting variety",
        details: { hasBold, hasLists, hasQuotes, hasTable },
      };
    },
  },
];
