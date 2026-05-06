/**
 * Tier 5: Content Quality Intelligence Checks
 *
 * Phase 92: On-Page SEO Mastery
 *
 * These checks are opt-in and require:
 * - Vertical classification (vertical field in CheckContext)
 * - For SERP checks: serpContent array populated
 * - Client has tier5Enabled: true in clientSeoSettings
 *
 * Blocking Checks (can prevent publication):
 * - T5-01: Reddit Test (blocking if score < 50)
 * - T5-02: Information Gain vs SERP (blocking if score < 40)
 * - T5-03: Prove-It Details (blocking if score < 30)
 * - T5-06: Thin Content Detection (blocking if score < 20)
 * - T5-08: AI Slop Detection (blocking if score < 40)
 *
 * Non-blocking Checks (recommendations only):
 * - T5-04: Not For You Block
 * - T5-05: QDD Vulnerability
 * - T5-07: Fluff Detection
 * - T5-09: Voice Consistency
 * - T5-10: Tone Appropriateness
 * - T5-11: Audience Alignment
 * - T5-12: Sentence Length Distribution
 * - T5-13: Paragraph Length Optimization
 *
 * @see .planning/phases/92-on-page-seo-mastery/92-CONTEXT.md
 */

// Blocking checks (can prevent publication)
import "./T5-01-reddit-test";
import "./T5-02-info-gain";
import "./T5-03-prove-it";
import "./T5-06-thin-content";
import "./T5-08-ai-slop";

// Non-blocking checks (recommendations only)
import "./T5-04-not-for-you";
import "./T5-05-qdd";
import "./T5-07-fluff";
import "./T5-09-voice-consistency";
import "./T5-10-tone";
import "./T5-11-audience";
import "./T5-12-sentence-length";
import "./T5-13-paragraph-length";
