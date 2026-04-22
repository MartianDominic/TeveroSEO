/**
 * SEO Check Definitions
 *
 * 107 SEO checks organized by tier:
 * - T1 (27): Critical on-page (title, meta, H1)
 * - T2 (25): Content quality (word count, readability)
 * - T3 (30): Technical SEO (links, images, schema)
 * - T4 (25): Advanced (performance, mobile, security)
 */

import type { CheckDefinition, CheckTier, CheckCategory, CheckSeverity } from "./types";

/**
 * Helper to create check ID
 */
function checkId(tier: CheckTier, num: number): string {
  return `T${tier}-${num.toString().padStart(2, "0")}`;
}

/**
 * Create a check definition
 */
function def(
  tier: CheckTier,
  num: number,
  name: string,
  description: string,
  category: CheckCategory,
  severity: CheckSeverity,
  autoEditable = false,
  editRecipe?: string
): CheckDefinition {
  return {
    id: checkId(tier, num),
    name,
    description,
    tier,
    category,
    severity,
    autoEditable,
    editRecipe,
  };
}

/**
 * Tier 1: Critical On-Page SEO (27 checks)
 */
const tier1Checks: CheckDefinition[] = [
  def(1, 1, "Title Tag Present", "Page must have a title tag", "title", "critical", true, "add-title"),
  def(1, 2, "Meta Description Present", "Page must have a meta description", "meta", "critical", true, "add-meta-desc"),
  def(1, 3, "H1 Present", "Page must have an H1 heading", "headings", "critical", true, "add-h1"),
  def(1, 4, "Title Length", "Title should be 30-60 characters", "title", "high", true, "adjust-title-length"),
  def(1, 5, "Meta Description Length", "Meta description should be 120-160 characters", "meta", "high", true, "adjust-meta-length"),
  def(1, 6, "Single H1", "Page should have exactly one H1", "headings", "high"),
  def(1, 7, "Title Keyword", "Title should contain target keyword", "title", "high", true, "add-keyword-title"),
  def(1, 8, "Meta Keyword", "Meta description should contain target keyword", "meta", "medium", true, "add-keyword-meta"),
  def(1, 9, "H1 Keyword", "H1 should contain target keyword", "headings", "medium", true, "add-keyword-h1"),
  def(1, 10, "Title Unique", "Title should not duplicate site name", "title", "medium"),
  def(1, 11, "Meta Unique", "Meta description should be unique per page", "meta", "medium"),
  def(1, 12, "H2 Present", "Page should have H2 headings", "headings", "medium"),
  def(1, 13, "Heading Hierarchy", "Headings should follow proper hierarchy", "headings", "medium"),
  def(1, 14, "URL Structure", "URL should be clean and descriptive", "technical", "medium"),
  def(1, 15, "URL Keyword", "URL should contain target keyword", "technical", "low"),
  def(1, 16, "Canonical Tag", "Page should have canonical tag", "technical", "high", true, "add-canonical"),
  def(1, 17, "Lang Attribute", "HTML should have lang attribute", "technical", "medium", true, "add-lang"),
  def(1, 18, "Viewport Meta", "Page should have viewport meta tag", "mobile", "high", true, "add-viewport"),
  def(1, 19, "Charset Declaration", "Page should declare character encoding", "technical", "medium", true, "add-charset"),
  def(1, 20, "Doctype Present", "Page should have DOCTYPE declaration", "technical", "low"),
  def(1, 21, "Title Not Empty", "Title should not be empty", "title", "critical"),
  def(1, 22, "Meta Not Empty", "Meta description should not be empty", "meta", "high"),
  def(1, 23, "Title Start Keyword", "Title should start with target keyword", "title", "low"),
  def(1, 24, "Meta Start Keyword", "Meta description should start with target keyword", "meta", "low"),
  def(1, 25, "URL Length", "URL should be under 75 characters", "technical", "low"),
  def(1, 26, "URL Lowercase", "URL should be lowercase", "technical", "low"),
  def(1, 27, "Open Graph Tags", "Page should have Open Graph tags", "meta", "low", true, "add-og-tags"),
];

/**
 * Tier 2: Content Quality (25 checks)
 */
const tier2Checks: CheckDefinition[] = [
  def(2, 1, "Minimum Word Count", "Page should have at least 300 words", "content", "high"),
  def(2, 2, "Optimal Word Count", "Page should have 800-2000 words", "content", "medium"),
  def(2, 3, "Keyword Density", "Keyword density should be 1-3%", "content", "medium"),
  def(2, 4, "Keyword in First Paragraph", "Keyword should appear in first paragraph", "content", "medium"),
  def(2, 5, "Keyword in Last Paragraph", "Keyword should appear in last paragraph", "content", "low"),
  def(2, 6, "Content Uniqueness", "Content should be original", "content", "high"),
  def(2, 7, "Readability Score", "Content should have good readability", "content", "medium"),
  def(2, 8, "Sentence Length", "Sentences should not be too long", "content", "low"),
  def(2, 9, "Paragraph Length", "Paragraphs should not be too long", "content", "low"),
  def(2, 10, "Active Voice", "Content should use active voice", "content", "low"),
  def(2, 11, "No Duplicate Content", "No duplicate paragraphs on page", "content", "medium"),
  def(2, 12, "LSI Keywords", "Content should include related keywords", "content", "low"),
  def(2, 13, "Question Words", "Content should answer questions", "content", "low"),
  def(2, 14, "Call to Action", "Content should have clear CTA", "content", "medium"),
  def(2, 15, "Content Freshness", "Content should be recently updated", "content", "low"),
  def(2, 16, "Subheading Distribution", "Subheadings should be evenly distributed", "headings", "low"),
  def(2, 17, "List Usage", "Content should use lists where appropriate", "content", "low"),
  def(2, 18, "Multimedia Content", "Page should include images or videos", "content", "medium"),
  def(2, 19, "Internal Linking", "Content should link to related pages", "links", "medium"),
  def(2, 20, "External Linking", "Content should cite external sources", "links", "low"),
  def(2, 21, "Anchor Text Diversity", "Internal links should have varied anchor text", "links", "low"),
  def(2, 22, "Keyword Variations", "Content should use keyword variations", "content", "low"),
  def(2, 23, "Entity Coverage", "Content should mention related entities", "content", "low"),
  def(2, 24, "Topic Completeness", "Content should cover topic thoroughly", "content", "medium"),
  def(2, 25, "Featured Snippet Optimization", "Content should be formatted for snippets", "content", "low"),
];

/**
 * Tier 3: Technical SEO (30 checks)
 */
const tier3Checks: CheckDefinition[] = [
  def(3, 1, "Images Have Alt Text", "All images should have alt attributes", "images", "high", true, "add-alt-text"),
  def(3, 2, "Image Alt Contains Keyword", "Image alt should contain target keyword", "images", "low"),
  def(3, 3, "Image Dimensions Specified", "Images should have width/height", "images", "medium"),
  def(3, 4, "Responsive Images", "Images should be responsive", "images", "medium"),
  def(3, 5, "Image Format Optimization", "Images should use modern formats", "images", "low"),
  def(3, 6, "Broken Internal Links", "No broken internal links", "links", "critical"),
  def(3, 7, "Broken External Links", "No broken external links", "links", "high"),
  def(3, 8, "Link Attributes", "External links should have rel attributes", "links", "medium"),
  def(3, 9, "Orphan Pages", "No orphan pages in site", "links", "medium"),
  def(3, 10, "Deep Links", "Important pages should be within 3 clicks", "links", "medium"),
  def(3, 11, "Schema Markup Present", "Page should have structured data", "schema", "medium", true, "add-schema"),
  def(3, 12, "Valid Schema", "Structured data should be valid", "schema", "medium"),
  def(3, 13, "Article Schema", "Articles should have Article schema", "schema", "low"),
  def(3, 14, "Breadcrumb Schema", "Pages should have breadcrumb schema", "schema", "low"),
  def(3, 15, "Organization Schema", "Site should have Organization schema", "schema", "low"),
  def(3, 16, "FAQ Schema", "FAQ pages should have FAQ schema", "schema", "low"),
  def(3, 17, "Product Schema", "Product pages should have Product schema", "schema", "medium"),
  def(3, 18, "Review Schema", "Reviews should have Review schema", "schema", "low"),
  def(3, 19, "Robots Meta Tag", "Robots meta tag should allow indexing", "technical", "critical"),
  def(3, 20, "Hreflang Tags", "Multilingual pages should have hreflang", "technical", "medium"),
  def(3, 21, "X-Robots-Tag", "X-Robots-Tag should allow indexing", "technical", "high"),
  def(3, 22, "No Noindex", "Page should not be noindexed unintentionally", "technical", "critical"),
  def(3, 23, "Sitemap Referenced", "Page should be in sitemap", "technical", "medium"),
  def(3, 24, "Crawlable JavaScript", "JS content should be crawlable", "technical", "medium"),
  def(3, 25, "No Render Blocking", "Reduce render-blocking resources", "technical", "medium"),
  def(3, 26, "CSS Optimization", "CSS should be optimized", "technical", "low"),
  def(3, 27, "JavaScript Optimization", "JavaScript should be optimized", "technical", "low"),
  def(3, 28, "HTML Validation", "HTML should be valid", "technical", "low"),
  def(3, 29, "No Flash Content", "Page should not use Flash", "technical", "medium"),
  def(3, 30, "No Frames", "Page should not use frames", "technical", "medium"),
];

/**
 * Tier 4: Advanced SEO (25 checks)
 */
const tier4Checks: CheckDefinition[] = [
  def(4, 1, "Page Load Time", "Page should load in under 3 seconds", "performance", "high"),
  def(4, 2, "Time to First Byte", "TTFB should be under 600ms", "performance", "medium"),
  def(4, 3, "First Contentful Paint", "FCP should be under 1.8s", "performance", "medium"),
  def(4, 4, "Largest Contentful Paint", "LCP should be under 2.5s", "performance", "high"),
  def(4, 5, "Cumulative Layout Shift", "CLS should be under 0.1", "performance", "high"),
  def(4, 6, "First Input Delay", "FID should be under 100ms", "performance", "medium"),
  def(4, 7, "Total Blocking Time", "TBT should be under 300ms", "performance", "medium"),
  def(4, 8, "Page Size", "Page should be under 3MB", "performance", "medium"),
  def(4, 9, "Request Count", "Page should have under 100 requests", "performance", "low"),
  def(4, 10, "Compression Enabled", "Resources should be compressed", "performance", "medium"),
  def(4, 11, "Mobile Friendly", "Page should be mobile-friendly", "mobile", "critical"),
  def(4, 12, "Touch Targets", "Touch targets should be adequately sized", "mobile", "medium"),
  def(4, 13, "Font Size Mobile", "Font size should be readable on mobile", "mobile", "medium"),
  def(4, 14, "No Horizontal Scroll", "No horizontal scrolling on mobile", "mobile", "medium"),
  def(4, 15, "AMP Version", "Page could have AMP version", "mobile", "low"),
  def(4, 16, "HTTPS Enabled", "Page should use HTTPS", "security", "critical"),
  def(4, 17, "Mixed Content", "No mixed HTTP/HTTPS content", "security", "high"),
  def(4, 18, "Security Headers", "Page should have security headers", "security", "medium"),
  def(4, 19, "HSTS Enabled", "HSTS should be enabled", "security", "medium"),
  def(4, 20, "Content Security Policy", "CSP header should be present", "security", "low"),
  def(4, 21, "Accessible Links", "Links should be accessible", "accessibility", "medium"),
  def(4, 22, "Color Contrast", "Text should have sufficient contrast", "accessibility", "medium"),
  def(4, 23, "ARIA Labels", "Interactive elements should have ARIA labels", "accessibility", "low"),
  def(4, 24, "Keyboard Navigation", "Page should be keyboard navigable", "accessibility", "medium"),
  def(4, 25, "Skip Links", "Page should have skip navigation links", "accessibility", "low"),
];

/**
 * All 107 check definitions
 */
export const CHECK_DEFINITIONS: CheckDefinition[] = [
  ...tier1Checks,
  ...tier2Checks,
  ...tier3Checks,
  ...tier4Checks,
];

/**
 * Get check definition by ID
 */
export function getCheckById(checkId: string): CheckDefinition | undefined {
  return CHECK_DEFINITIONS.find((def) => def.id === checkId);
}

/**
 * Get checks by tier
 */
export function getChecksByTier(tier: CheckTier): CheckDefinition[] {
  return CHECK_DEFINITIONS.filter((def) => def.tier === tier);
}

/**
 * Get checks by category
 */
export function getChecksByCategory(category: CheckCategory): CheckDefinition[] {
  return CHECK_DEFINITIONS.filter((def) => def.category === category);
}

/**
 * Get tier from check ID
 */
export function getTierFromCheckId(checkId: string): CheckTier {
  const tier = parseInt(checkId.split("-")[0].replace("T", ""));
  return tier as CheckTier;
}

/**
 * Check counts by tier
 */
export const CHECK_COUNTS = {
  tier1: tier1Checks.length, // 27
  tier2: tier2Checks.length, // 25
  tier3: tier3Checks.length, // 30
  tier4: tier4Checks.length, // 25
  total: CHECK_DEFINITIONS.length, // 107
};
