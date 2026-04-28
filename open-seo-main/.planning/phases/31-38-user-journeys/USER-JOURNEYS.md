# User Journeys: Autonomous SEO Platform (Phases 31-38)

## Overview

This document defines key user journeys for agency personas using the autonomous SEO pipeline. Clients NEVER see the internal software - all interactions are agency-facing.

**Personas:**
- **Sarah (Agency Owner)** - 50 clients, high-level overview, value demonstration
- **Marcus (SEO Specialist)** - 15 accounts, day-to-day operations, technical work
- **Lisa (Content Manager)** - Brand voice, content briefs, quality assurance

**Phases Covered:**
- Phase 31: Site Connection & Platform Detection
- Phase 32: 107 SEO Checks Implementation
- Phase 33: Auto-Fix System with Granular Revert
- Phase 34: Keyword-to-Page Mapping
- Phase 35: Internal Linking Automation
- Phase 36: Content Brief Generation
- Phase 37: Brand Voice Management
- Phase 38: Autonomous Pipeline Orchestration

---

## Journey 1: Morning Agency Health Check

### Persona: Sarah (Agency Owner)
### Goal: Understand which clients need attention before morning standup
### Trigger: Daily login at 8:30 AM

### Steps:

1. **Login & View Dashboard** - `AgencyDashboard` - 10 sec
   - Sees: Health score grid (50 client tiles, color-coded: green/yellow/red)
   - Priority alert banner showing: "3 clients need attention, 12 auto-fixes pending review"
   - Does: Scans for red tiles first

2. **Review Attention Queue** - `AttentionQueue` component - 30 sec
   - Sees: Sorted list by severity: Critical > High > Medium
   - Each item shows: Client name, issue type, impact score, time in queue
   - Decision point: Click client to investigate OR dismiss false positive

3. **Drill Into Critical Client** - `ClientHealthDetail` - 1 min
   - Sees: Issue breakdown, recent ranking changes, pending auto-fixes
   - SEO score trend (7-day, 30-day)
   - Auto-fix success rate for this client
   - Does: Reviews suggested actions

4. **Approve Batch Auto-Fixes** - `AutoFixReviewPanel` - 2 min
   - Sees: Grouped fixes by type (meta tags, schema, links)
   - Preview of changes with before/after
   - Decision point: Approve all, approve selected, or defer
   - Does: Clicks "Approve 8 fixes" for low-risk items

5. **Export Standup Report** - `ReportExport` modal - 30 sec
   - Sees: Pre-generated summary of overnight activity
   - Does: Clicks "Copy to Clipboard" for Slack standup

### Success State:
Sarah knows which 3 clients need team attention, has approved routine fixes, and has standup notes ready. No surprises.

### Total Time: 5 minutes

---

## Journey 2: New Client Site Onboarding

### Persona: Marcus (SEO Specialist)
### Goal: Connect a new client site and run initial audit
### Trigger: Sales closes deal, hands off client domain

### Steps:

1. **Create Client Record** - `ClientCreate` form - 1 min
   - Enters: Client name, primary domain, industry vertical
   - Sees: Domain validation check (reachable, SSL status)
   - Does: Clicks "Create Client"

2. **Platform Detection Scan** - `PlatformDetector` - 30 sec (automated)
   - Sees: Loading spinner, then detected platform badge
   - Platform detected: WordPress 6.4, Yoast SEO, WooCommerce
   - Connector compatibility: Full (CMS API access available)

3. **Site Connection Setup** - `SiteConnector` wizard - 3 min
   - **Step 3a**: Choose connection method
     - Decision point: CMS API (preferred) OR Pixel-only OR Manual
   - **Step 3b**: For WordPress - enters admin URL, generates API key
   - **Step 3c**: Verifies connection with test request
   - Sees: Green checkmark "Connection verified - 847 pages detected"

4. **Run Initial Audit** - `AuditLauncher` - 15 sec to start
   - Sees: Audit queue position, estimated completion (12 min)
   - Does: Clicks "Run Full 107-Check Audit"
   - Background: Phase 32 checks execute across all pages

5. **Review Audit Results** - `AuditResultsDashboard` - 5 min
   - Sees: Score breakdown by category (Technical, Content, Performance)
   - Issue list sorted by impact score
   - Quick wins highlighted (high impact, easy fix)
   - Does: Marks 5 critical issues for immediate attention

6. **Enable Autonomous Mode** - `AutonomousSettings` panel - 2 min
   - Decision points:
     - Auto-fix threshold: Low-risk only / Medium / Aggressive
     - Notification preference: Before fix / After fix / Weekly digest
     - Content changes: Review required / Auto-publish
   - Does: Sets "Low-risk auto-fix, notify after" for new client

7. **Schedule Recurring Audit** - `AuditScheduler` - 30 sec
   - Sees: Frequency options (daily, weekly, monthly)
   - Does: Sets weekly full audit, daily quick scan

### Success State:
Client site connected, initial audit complete with 23 issues identified, autonomous mode enabled for low-risk fixes, weekly audits scheduled.

### Total Time: 12 minutes

---

## Journey 3: Reviewing and Approving Auto-Fix Suggestions

### Persona: Marcus (SEO Specialist)
### Goal: Review auto-generated fixes before they apply to client sites
### Trigger: Notification "15 auto-fixes ready for review"

### Steps:

1. **Open Fix Review Queue** - `AutoFixQueue` - 10 sec
   - Sees: 15 pending fixes across 6 clients
   - Filter options: By client, by fix type, by risk level
   - Does: Filters to "Medium risk" fixes (7 items)

2. **Review Individual Fix** - `FixDetailView` - 2 min per fix
   - Sees for meta title fix:
     - Current: "Home | ABC Corp"
     - Proposed: "ABC Corp | Industrial Automation Solutions"
     - Rationale: "Current title too short (12 chars), missing primary keyword"
     - Impact prediction: "+15% CTR potential"
     - Risk assessment: Low (title change, easily reversible)
   - Decision point: Approve / Reject / Edit / Defer

3. **Edit Proposed Fix** - `FixEditor` inline - 1 min
   - Does: Modifies proposed title to "ABC Corp - Industrial Automation"
   - Sees: Character count, preview in SERP simulator
   - Does: Clicks "Approve with edits"

4. **Batch Approve Similar Fixes** - `BatchApproval` - 30 sec
   - Sees: "4 similar fixes (meta description length)"
   - Does: Reviews sample, clicks "Approve all 4"

5. **Reject with Feedback** - `RejectDialog` - 30 sec
   - For a schema markup change that conflicts with client preference
   - Does: Selects rejection reason "Client preference override"
   - System learns: Similar fixes for this client auto-flagged for review

6. **View Applied Changes Log** - `ChangeLog` - 1 min
   - Sees: Chronological list of all approved fixes
   - Each entry shows: Timestamp, fix type, before/after, applied by
   - Does: Verifies 11 fixes now showing as "Applied"

### Success State:
11 fixes approved (2 with edits), 4 rejected with learning feedback. All medium-risk changes reviewed. Client sites updated.

### Total Time: 15 minutes

---

## Journey 4: Handling a Ranking Emergency

### Persona: Marcus (SEO Specialist)
### Goal: Diagnose and fix sudden ranking drop for key client
### Trigger: Alert "Client XYZ: 15 keywords dropped 10+ positions overnight"

### Steps:

1. **View Alert Details** - `AlertDetail` page - 30 sec
   - Sees: Keyword list with position changes
   - Timeline: Drop occurred between 2 AM - 4 AM
   - Affected pages: 3 product pages, 1 category page

2. **Check Recent Changes** - `ChangeTimeline` - 2 min
   - Sees: All changes in last 72 hours
   - Finds: Auto-fix applied internal links 3 hours before drop
   - Does: Clicks on the change to see details

3. **Analyze Impact** - `ImpactAnalysis` - 1 min
   - Sees: Correlation score between change and ranking drop
   - System suggestion: "Internal link removal may have impacted page authority flow"
   - Confidence: 73%

4. **Preview Revert** - `RevertPreview` - 1 min
   - Sees: Exact state before the change
   - Shows: Which pages will be affected by revert
   - Does: Reviews that revert wont break anything else

5. **Execute Granular Revert** - `RevertExecutor` - 30 sec
   - Decision point: Revert single change OR revert to checkpoint
   - Does: Selects "Revert this change only"
   - Sees: Confirmation with revert hash for tracking

6. **Set Monitoring Alert** - `CustomAlert` setup - 1 min
   - Does: Creates 48-hour watch on affected keywords
   - Threshold: Alert if any further drops > 3 positions
   - Does: Adds note "Reverted internal link change, monitoring"

7. **Document Incident** - `IncidentLog` - 2 min
   - Does: Creates incident record with:
     - Root cause: Automated internal link removal
     - Resolution: Granular revert
     - Learning: Add approval requirement for internal link removal on this client
   - System updates: Client autonomous settings adjusted

### Success State:
Change reverted within 20 minutes of alert. Monitoring active. Incident documented. Autonomous rules updated to prevent recurrence.

### Total Time: 8 minutes

---

## Journey 5: Setting Up Brand Voice for New Client

### Persona: Lisa (Content Manager)
### Goal: Configure brand voice profile so AI-generated content matches client expectations
### Trigger: New client onboarded, needs content brief generation enabled

### Steps:

1. **Open Brand Voice Wizard** - `BrandVoiceSetup` - 10 sec
   - Sees: Empty brand profile with guided setup steps
   - Progress indicator: 0/6 sections complete

2. **Upload Voice Samples** - `VoiceSampleUploader` - 3 min
   - Does: Uploads 5 existing client blog posts, 2 landing pages
   - Sees: Upload progress, parsing status
   - System: Extracts tone, vocabulary, sentence structure patterns

3. **Review AI-Detected Voice Attributes** - `VoiceAnalysis` - 2 min
   - Sees AI analysis:
     - Tone: Professional, authoritative (85% confidence)
     - Formality: High (avoids contractions, uses industry terms)
     - Sentence length: Medium-long (avg 18 words)
     - Key phrases: "industry-leading", "proven results", "transform your"
   - Decision point: Accept / Adjust / Re-analyze with more samples

4. **Set Voice Parameters** - `VoiceParameterEditor` - 3 min
   - Adjusts sliders:
     - Formality: 8/10 (client is B2B enterprise)
     - Technical depth: 7/10 (knowledgeable audience)
     - Call-to-action strength: 6/10 (soft sell preferred)
   - Does: Adds banned phrases ("cutting-edge", "synergy")
   - Does: Adds required phrases ("enterprise-grade", client product names)

5. **Configure Industry Context** - `IndustryContext` - 1 min
   - Selects: Industry vertical (Manufacturing > Industrial Automation)
   - Does: Reviews auto-loaded industry terminology
   - Adds: Client-specific jargon ("servo controllers", "PLC integration")

6. **Test Voice with Sample Generation** - `VoiceTestGenerator` - 2 min
   - Does: Enters test topic "Benefits of automated quality inspection"
   - Sees: AI generates 3 paragraph samples using configured voice
   - Decision point: Approve voice OR iterate on parameters
   - Does: Adjusts formality down to 7/10, regenerates

7. **Activate Brand Voice** - `VoiceActivation` - 30 sec
   - Does: Clicks "Activate for all content generation"
   - Sees: Confirmation "Brand voice active - will apply to all briefs and content"

### Success State:
Brand voice profile complete with 85%+ match to client samples. Test content approved. Voice active for all future content generation.

### Total Time: 12 minutes

---

## Journey 6: Creating and Managing Content Briefs

### Persona: Lisa (Content Manager)
### Goal: Generate content brief for target keyword, review and assign
### Trigger: Keyword-to-page mapping identified gap: no page targets "industrial automation ROI"

### Steps:

1. **View Content Gaps** - `ContentGapDashboard` - 1 min
   - Sees: List of keywords with no mapped pages
   - Sorted by: Search volume * business relevance
   - Top gap: "industrial automation ROI" (2,400 vol, high relevance)
   - Does: Clicks "Create Brief" on top gap

2. **AI Brief Generation** - `BriefGenerator` - 30 sec (automated)
   - System generates:
     - Suggested title options (3)
     - Target word count (1,800-2,200)
     - Outline with H2/H3 structure
     - Competitor analysis (top 5 ranking pages)
     - Semantic keywords to include
     - Internal link opportunities

3. **Review Generated Brief** - `BriefEditor` - 5 min
   - Sees: Full brief with all sections expandable
   - Reviews outline:
     - H2: Understanding Industrial Automation ROI
     - H2: Key Factors Affecting ROI
     - H2: Calculating Your ROI
     - H2: Case Studies (client case studies auto-suggested)
   - Decision points per section: Accept / Edit / Remove / Add

4. **Enhance with Client Knowledge** - `KnowledgeInserter` - 2 min
   - Sees: Suggested client stats, case studies, testimonials from knowledge base
   - Does: Adds "Client achieved 340% ROI for AutoParts Inc" to Case Studies section
   - Does: Inserts product mention in Calculating section

5. **Set SEO Parameters** - `SEOParameterPanel` - 1 min
   - Confirms: Primary keyword, secondary keywords
   - Sets: Target featured snippet (definition box)
   - Reviews: Required schema markup (FAQ, HowTo)

6. **Quality Check** - `BriefQualityScore` - 30 sec
   - Sees: Brief completeness score (94/100)
   - Missing: "Add competitor differentiation angle"
   - Does: Adds differentiation note to introduction section

7. **Assign and Schedule** - `BriefAssignment` - 1 min
   - Decision point: Assign to writer OR queue for AI generation
   - Does: Selects "AI Draft + Human Review"
   - Sets: Due date, reviewer (self), publish target date
   - Does: Clicks "Generate Draft"

### Success State:
Content brief approved (94/100 quality score), queued for AI draft generation, review scheduled for Thursday.

### Total Time: 11 minutes

---

## Journey 7: Agency Client Value Demonstration

### Persona: Sarah (Agency Owner)
### Goal: Prepare monthly report showing ROI and requesting continued engagement
### Trigger: Monthly client call scheduled for tomorrow

### Steps:

1. **Select Client Report** - `ReportBuilder` - 30 sec
   - Selects: Client "MegaCorp Industries"
   - Period: Last 30 days
   - Template: Executive Summary (designed for CMOs)

2. **Review Auto-Generated Metrics** - `MetricsDashboard` - 2 min
   - Sees key metrics pre-calculated:
     - Organic traffic: +23% (14,200 > 17,466 sessions)
     - Keyword rankings: 47 improved, 12 declined, 156 stable
     - Technical health: 94/100 (up from 78)
     - Content published: 4 new pages, 8 updated
     - Auto-fixes applied: 127 (saving est. 12 hours manual work)

3. **Highlight Key Wins** - `WinSelector` - 2 min
   - System suggests top 3 wins:
     - "industrial automation systems" #3 > #1 (est. +$4,200/mo value)
     - Homepage load time 4.2s > 1.8s
     - 15 broken links auto-fixed before impacting rankings
   - Does: Selects wins to feature, adds context notes

4. **Add Client-Specific Commentary** - `CommentaryEditor` - 3 min
   - Does: Writes executive summary paragraph
   - Does: Adds recommendation section: "Expand content to adjacent keywords"
   - Sees: AI-suggested talking points for call

5. **Generate Deliverables** - `DeliverableGenerator` - 1 min
   - Selects output formats:
     - PDF report (branded)
     - Google Slides deck (for call)
     - Raw data export (for client data team)
   - Does: Clicks "Generate All"

6. **Preview and Approve** - `ReportPreview` - 2 min
   - Does: Reviews PDF in preview mode
   - Sees: All charts, metrics, branding correct
   - Does: Makes minor text edit to summary
   - Does: Clicks "Finalize and Send" (optional email delivery)

7. **Schedule Follow-up Actions** - `ActionScheduler` - 1 min
   - System suggests: "Create content briefs for recommended keywords"
   - Does: Accepts suggestion, queues for post-call execution
   - Does: Sets reminder for 30 days for next report

### Success State:
Professional PDF report ready, Slides deck generated, data export available. Client call prep complete. Follow-up actions queued.

### Total Time: 12 minutes

---

## Journey 8: Autonomous Pipeline Configuration

### Persona: Sarah (Agency Owner)
### Goal: Configure autonomous operation levels for portfolio to minimize manual intervention
### Trigger: Quarterly efficiency review - want to automate more across mature clients

### Steps:

1. **Open Autonomy Dashboard** - `AutonomyOverview` - 30 sec
   - Sees: Portfolio autonomy heatmap
   - Current stats: 40% full auto, 35% semi-auto, 25% manual review
   - Opportunity: "15 clients eligible for autonomy upgrade"

2. **Review Autonomy Tiers** - `TierExplainer` modal - 1 min
   - Sees tier definitions:
     - **Tier 1 (Manual)**: All changes require approval
     - **Tier 2 (Semi-Auto)**: Low-risk auto, medium+ requires review
     - **Tier 3 (Full Auto)**: All except content changes auto-apply
     - **Tier 4 (Autonomous)**: Everything including content, human notified
   - Does: Understands risk profile per tier

3. **Analyze Eligible Clients** - `EligibilityAnalysis` - 2 min
   - Sees: 15 clients flagged for upgrade
   - Eligibility criteria shown:
     - 90+ day history with platform
     - <2% revert rate on auto-fixes
     - No ranking emergencies in 60 days
     - Stable SEO score (no major fluctuations)
   - Does: Reviews list, filters to "6+ month history"

4. **Batch Upgrade Clients** - `TierUpgradeWizard` - 3 min
   - Selects: 8 mature clients for Tier 2 > Tier 3 upgrade
   - Decision point: Apply to all or customize per client
   - Does: Applies Tier 3 to 6 clients, keeps 2 at Tier 2 (client preference)
   - Sets: Notification preference "Daily digest of auto-applied changes"

5. **Configure Guardrails** - `GuardrailSettings` - 2 min
   - Sets global rules:
     - Max changes per day per client: 20
     - Pause on ranking drop > 5 positions
     - Never touch: Homepage title, main navigation
     - Alert threshold: Any content change > 500 words
   - Does: Saves guardrail configuration

6. **Enable Predictive Alerts** - `PredictiveAlerts` - 1 min
   - Toggles on: "Alert before potential ranking impact"
   - Sets sensitivity: Medium (alert on 60%+ confidence predictions)
   - Does: Reviews alert delivery channels (email, Slack, in-app)

7. **Review Projected Efficiency Gains** - `EfficiencyProjection` - 1 min
   - Sees: "Estimated time savings: 8.5 hours/week"
   - Breakdown: Technical fixes (4h), content updates (2.5h), reporting (2h)
   - Does: Accepts projection, schedules 30-day review

### Success State:
8 clients upgraded to higher autonomy tier. Guardrails configured. Predictive alerts enabled. Expected 8.5 hours/week efficiency gain.

### Total Time: 11 minutes

---

## Journey 9: Internal Linking Optimization Campaign

### Persona: Marcus (SEO Specialist)
### Goal: Implement AI-suggested internal linking improvements across client site
### Trigger: Monthly audit flagged "Internal linking opportunities: 47 suggestions"

### Steps:

1. **Open Link Suggestions** - `InternalLinkOpportunities` - 30 sec
   - Sees: 47 link suggestions sorted by impact score
   - Categories: Orphan pages (12), Topic clusters (23), Authority flow (12)
   - Does: Filters to "Authority flow" (highest impact)

2. **Review Link Graph** - `LinkGraphVisualizer` - 2 min
   - Sees: Visual representation of internal link structure
   - Highlighted: Pages with high authority but few outbound links
   - Highlighted: Important pages receiving few inbound links
   - Does: Identifies "pricing page" receiving only 2 internal links

3. **Review AI Suggestions for Page** - `LinkSuggestionDetail` - 2 min
   - Sees suggestions for pricing page:
     - Add link from "solutions overview" (relevance: 92%)
     - Add link from "ROI calculator" (relevance: 88%)
     - Add link from 3 blog posts mentioning pricing
   - Each shows: Anchor text suggestion, insertion point preview

4. **Approve Link Placements** - `LinkPlacementApproval` - 3 min
   - Does: Reviews each suggestion with content preview
   - Decision points per link: Approve / Edit anchor / Reject
   - Does: Approves 4 links, edits anchor on 1, rejects 1 (awkward placement)

5. **Review Anchor Text Diversity** - `AnchorTextAnalysis` - 1 min
   - Sees: Current anchor text distribution for target page
   - Warning: "80% exact match - consider diversifying"
   - Does: Accepts AI suggestion to vary anchor text

6. **Apply Changes** - `LinkChangeExecutor` - 30 sec (automated)
   - Does: Clicks "Apply 5 approved changes"
   - Sees: Progress indicator as changes deploy
   - Confirmation: "5 internal links added successfully"

7. **Schedule Link Audit Follow-up** - `LinkAuditScheduler` - 30 sec
   - Does: Sets 14-day follow-up audit for affected pages
   - Purpose: Measure ranking impact of new internal links

### Success State:
5 strategic internal links added to improve pricing page authority. Anchor text diversified. Follow-up audit scheduled.

### Total Time: 10 minutes

---

## Journey 10: Content Quality Assurance Review

### Persona: Lisa (Content Manager)
### Goal: Review AI-generated draft before publishing to client site
### Trigger: Notification "AI draft ready for review: Industrial Automation ROI"

### Steps:

1. **Open Draft Review** - `DraftReviewQueue` - 30 sec
   - Sees: Draft status "Ready for review"
   - Brief link, word count (2,147), generation date
   - Does: Clicks "Start Review"

2. **Compare to Brief** - `BriefComparisonView` - 2 min
   - Sees: Side-by-side: Brief outline vs Draft structure
   - Checklist auto-populated:
     - All H2 sections present
     - Word count within target
     - Required keywords included
     - Client case study inserted
   - Does: Verifies checklist items

3. **Review Voice Compliance** - `VoiceComplianceScore` - 1 min
   - Sees: Voice match score: 91%
   - Flags: "2 instances of banned phrase 'cutting-edge'"
   - Does: Notes for editing

4. **Check SEO Elements** - `SEOElementReview` - 2 min
   - Reviews:
     - Title tag: 58 chars (good)
     - Meta description: 155 chars (good)
     - H1 matches target keyword
     - Internal links: 4 (brief required 3+)
     - External links: 2 authoritative sources
     - Images: 3 with alt text
   - Does: Approves SEO elements

5. **Edit Content** - `DraftEditor` - 5 min
   - Does: Fixes 2 banned phrase instances
   - Does: Strengthens CTA in conclusion
   - Does: Adds one more client stat for credibility
   - Sees: Auto-save indicator

6. **Run Final Quality Check** - `QualityGate` - 30 sec (automated)
   - Sees: Quality dimensions scored:
     - Accuracy: 88
     - Readability: 92
     - SEO: 94
     - Voice: 93
     - Engagement: 85
   - All scores > 75 threshold

7. **Approve for Publishing** - `PublishApproval` - 30 sec
   - Decision point: Publish now / Schedule / Send back
   - Does: Selects "Schedule for Tuesday 9 AM"
   - Does: Clicks "Approve and Schedule"

8. **Notify Stakeholders** - `NotificationSender` - 30 sec (automated)
   - System sends: Slack notification to client channel (if configured)
   - System queues: Post-publish monitoring alert

### Success State:
Content reviewed, edited, quality gate passed (all dimensions 85+), scheduled for Tuesday publication. Stakeholders notified.

### Total Time: 12 minutes

---

## Summary: Journey Coverage Matrix

| Journey | Primary Phase | Secondary Phases | Persona | Time |
|---------|---------------|------------------|---------|------|
| 1. Morning Health Check | 38 (Orchestration) | 32 (Checks), 33 (Auto-Fix) | Sarah | 5 min |
| 2. New Client Onboarding | 31 (Connection) | 32 (Checks), 38 (Orchestration) | Marcus | 12 min |
| 3. Auto-Fix Review | 33 (Auto-Fix) | 32 (Checks) | Marcus | 15 min |
| 4. Ranking Emergency | 33 (Revert) | 32 (Checks), 38 (Orchestration) | Marcus | 8 min |
| 5. Brand Voice Setup | 37 (Voice) | 36 (Briefs) | Lisa | 12 min |
| 6. Content Brief Creation | 36 (Briefs) | 34 (Keyword Mapping), 37 (Voice) | Lisa | 11 min |
| 7. Value Demonstration | 38 (Orchestration) | All phases | Sarah | 12 min |
| 8. Autonomy Configuration | 38 (Orchestration) | 33 (Auto-Fix) | Sarah | 11 min |
| 9. Internal Linking | 35 (Linking) | 32 (Checks) | Marcus | 10 min |
| 10. Content QA Review | 36 (Briefs) | 37 (Voice), 34 (Mapping) | Lisa | 12 min |

---

## Component Index (Referenced Screens)

### Dashboard Components
- `AgencyDashboard` - Main landing, health grid
- `AttentionQueue` - Priority issues list
- `ClientHealthDetail` - Single client deep-dive
- `AutonomyOverview` - Portfolio autonomy heatmap

### Site Connection (Phase 31)
- `ClientCreate` - New client form
- `PlatformDetector` - CMS/platform identification
- `SiteConnector` - Connection wizard

### Audit System (Phase 32)
- `AuditLauncher` - Start audit
- `AuditResultsDashboard` - Results overview
- `AuditScheduler` - Recurring audit setup

### Auto-Fix System (Phase 33)
- `AutoFixQueue` - Pending fixes list
- `AutoFixReviewPanel` - Batch review
- `FixDetailView` - Single fix detail
- `FixEditor` - Edit proposed fix
- `BatchApproval` - Bulk approve
- `RejectDialog` - Rejection with feedback
- `ChangeLog` - Applied changes history
- `ChangeTimeline` - Chronological changes
- `RevertPreview` - Before revert preview
- `RevertExecutor` - Execute revert

### Keyword Mapping (Phase 34)
- `ContentGapDashboard` - Keywords without pages

### Internal Linking (Phase 35)
- `InternalLinkOpportunities` - Link suggestions
- `LinkGraphVisualizer` - Visual link structure
- `LinkSuggestionDetail` - Per-page suggestions
- `LinkPlacementApproval` - Approve placements
- `AnchorTextAnalysis` - Anchor diversity
- `LinkChangeExecutor` - Apply changes

### Content Briefs (Phase 36)
- `BriefGenerator` - AI brief creation
- `BriefEditor` - Edit brief
- `KnowledgeInserter` - Add client knowledge
- `SEOParameterPanel` - SEO settings
- `BriefQualityScore` - Completeness check
- `BriefAssignment` - Assign/schedule
- `DraftReviewQueue` - Review queue
- `BriefComparisonView` - Brief vs draft
- `DraftEditor` - Edit content
- `QualityGate` - 5-dimension scoring
- `PublishApproval` - Approve/schedule

### Brand Voice (Phase 37)
- `BrandVoiceSetup` - Setup wizard
- `VoiceSampleUploader` - Upload examples
- `VoiceAnalysis` - AI-detected attributes
- `VoiceParameterEditor` - Adjust parameters
- `IndustryContext` - Industry settings
- `VoiceTestGenerator` - Test generation
- `VoiceActivation` - Activate voice
- `VoiceComplianceScore` - Content voice match

### Orchestration (Phase 38)
- `AutonomousSettings` - Per-client autonomy
- `TierExplainer` - Autonomy tier definitions
- `EligibilityAnalysis` - Upgrade eligibility
- `TierUpgradeWizard` - Batch upgrade
- `GuardrailSettings` - Global safety rules
- `PredictiveAlerts` - Proactive alerts
- `EfficiencyProjection` - Time savings
- `CustomAlert` - Ad-hoc monitoring
- `IncidentLog` - Incident documentation

### Reporting
- `ReportBuilder` - Report configuration
- `MetricsDashboard` - Auto-calculated metrics
- `WinSelector` - Highlight achievements
- `CommentaryEditor` - Add narrative
- `DeliverableGenerator` - Generate outputs
- `ReportPreview` - Preview and approve
- `ReportExport` - Export options
- `ActionScheduler` - Follow-up actions
