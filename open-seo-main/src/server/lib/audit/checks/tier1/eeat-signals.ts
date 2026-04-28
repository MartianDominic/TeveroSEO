/**
 * Tier 1 E-E-A-T Signals Checks (T1-60 to T1-66)
 * Category K: Experience, Expertise, Authoritativeness, Trustworthiness
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";

function getWordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// T1-60: Author byline present
registerCheck({
  id: "T1-60",
  name: "Author byline present",
  tier: 1,
  category: "eeat-signals",
  severity: "high",
  autoEditable: true,
  editRecipe: "Add author byline with name",
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;
    // Look for common author patterns
    const authorSelectors = [
      '[rel="author"]',
      '[itemprop="author"]',
      '.author',
      '.byline',
      '[class*="author"]',
      'a[href*="/author/"]',
      'a[href*="/writers/"]',
    ];
    let found = false;
    for (const sel of authorSelectors) {
      if ($(sel).length > 0) { found = true; break; }
    }
    // Also check for "By " pattern
    if (!found) {
      const bodyText = $("body").text();
      found = /\bby\s+[A-Z][a-z]+\s+[A-Z]/i.test(bodyText);
    }
    return {
      checkId: "T1-60",
      passed: found,
      severity: found ? "info" : "high",
      message: found ? "Author byline detected" : "No author byline found",
      autoEditable: !found,
      editRecipe: found ? undefined : "Add author byline with name",
    };
  },
});

// T1-61: Author links to author page
registerCheck({
  id: "T1-61",
  name: "Author links to author page",
  tier: 1,
  category: "eeat-signals",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Link author name to author bio page",
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;
    const authorLinks = $('[rel="author"][href], [itemprop="author"] a[href], .author a[href], a[href*="/author/"]');
    const passed = authorLinks.length > 0;
    return {
      checkId: "T1-61",
      passed,
      severity: passed ? "info" : "medium",
      message: passed ? "Author links to author page" : "Author name not linked to author page",
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Link author name to author bio page",
    };
  },
});

// T1-62: Author bio >=150 words
registerCheck({
  id: "T1-62",
  name: "Author bio >=150 words",
  tier: 1,
  category: "eeat-signals",
  severity: "medium",
  autoEditable: false,
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;
    // Look for author bio sections
    const bioSelectors = [
      '.author-bio',
      '.author-description',
      '[itemprop="author"] [itemprop="description"]',
      '.about-author',
      '[class*="author-bio"]',
    ];
    let bioText = "";
    for (const sel of bioSelectors) {
      const el = $(sel);
      if (el.length > 0) {
        bioText = el.text();
        break;
      }
    }
    if (!bioText) {
      return { checkId: "T1-62", passed: true, severity: "info", message: "No author bio section found on page", autoEditable: false };
    }
    const wordCount = getWordCount(bioText);
    const passed = wordCount >= 150;
    return {
      checkId: "T1-62",
      passed,
      severity: passed ? "info" : "medium",
      message: passed ? `Author bio is ${wordCount} words (good)` : `Author bio is ${wordCount} words (aim for 150+)`,
      details: { wordCount },
      autoEditable: false,
    };
  },
});

// T1-63: Author bio >=300 words (YMYL)
registerCheck({
  id: "T1-63",
  name: "Author bio >=300 words (YMYL)",
  tier: 1,
  category: "eeat-signals",
  severity: "high",
  autoEditable: false,
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;
    // Detect YMYL topics
    const bodyText = $("body").text().toLowerCase();
    const ymylKeywords = ["health", "medical", "finance", "money", "legal", "insurance", "investment", "tax", "loan", "mortgage", "safety"];
    const isYmyl = ymylKeywords.some(k => bodyText.includes(k));
    if (!isYmyl) {
      return { checkId: "T1-63", passed: true, severity: "info", message: "Not a YMYL page", autoEditable: false };
    }
    // Look for author bio
    const bioSelectors = ['.author-bio', '.author-description', '[class*="author-bio"]'];
    let bioText = "";
    for (const sel of bioSelectors) {
      const el = $(sel);
      if (el.length > 0) { bioText = el.text(); break; }
    }
    if (!bioText) {
      return { checkId: "T1-63", passed: false, severity: "high", message: "YMYL page but no author bio found", autoEditable: false };
    }
    const wordCount = getWordCount(bioText);
    const passed = wordCount >= 300;
    return {
      checkId: "T1-63",
      passed,
      severity: passed ? "info" : "high",
      message: passed ? `YMYL author bio is ${wordCount} words (good)` : `YMYL author bio is ${wordCount} words (need 300+)`,
      details: { wordCount, isYmyl: true },
      autoEditable: false,
    };
  },
});

// T1-64: Credentials in bio
registerCheck({
  id: "T1-64",
  name: "Credentials in author bio",
  tier: 1,
  category: "eeat-signals",
  severity: "medium",
  autoEditable: false,
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;
    const bioSelectors = ['.author-bio', '.author-description', '[class*="author-bio"]', '.about-author'];
    let bioText = "";
    for (const sel of bioSelectors) {
      const el = $(sel);
      if (el.length > 0) { bioText = el.text(); break; }
    }
    if (!bioText) {
      return { checkId: "T1-64", passed: true, severity: "info", message: "No author bio found", autoEditable: false };
    }
    // Check for credential patterns
    const credentialPattern = /\b(MD|PhD|CPA|JD|MBA|RN|DO|DDS|DMD|PharmD|EdD|PsyD|LCSW|LMFT|CFP|CFA|PE|Esq|LLB|MFA|MS|MA|BSc|BA|MBBS|FRCS)\b/i;
    const passed = credentialPattern.test(bioText);
    return {
      checkId: "T1-64",
      passed,
      severity: passed ? "info" : "medium",
      message: passed ? "Credentials found in author bio" : "No credentials detected in author bio",
      autoEditable: false,
    };
  },
});

// T1-65: About page exists
registerCheck({
  id: "T1-65",
  name: "About page link exists",
  tier: 1,
  category: "eeat-signals",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Add link to /about page in footer or navigation",
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;
    const aboutLinks = $('a[href*="/about"], a[href*="about-us"], a[href$="about"]');
    const passed = aboutLinks.length > 0;
    return {
      checkId: "T1-65",
      passed,
      severity: passed ? "info" : "medium",
      message: passed ? "About page link found" : "No about page link detected",
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Add link to /about page in footer or navigation",
    };
  },
});

// T1-66: Contact page exists
registerCheck({
  id: "T1-66",
  name: "Contact page link exists",
  tier: 1,
  category: "eeat-signals",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Add link to /contact page in footer or navigation",
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;
    const contactLinks = $('a[href*="/contact"], a[href*="contact-us"], a[href$="contact"]');
    const passed = contactLinks.length > 0;
    return {
      checkId: "T1-66",
      passed,
      severity: passed ? "info" : "medium",
      message: passed ? "Contact page link found" : "No contact page link detected",
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Add link to /contact page in footer or navigation",
    };
  },
});
