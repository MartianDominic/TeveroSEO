# Content Refresh Engine

> Autonomous detection and refresh of decaying content to maintain and recover rankings.

## The Problem

Content decays. What ranked #3 six months ago now sits at #12 because:
- Statistics are outdated ("In 2024..." when it's 2026)
- Competitors published fresher content
- Links broke
- New subtopics emerged that we don't cover
- Search intent shifted

Manual content audits don't scale. With 500+ pages per client, decay goes unnoticed until rankings tank.

## The Solution

Continuous monitoring → Automatic detection → Diagnosis → Auto-fix → Verification

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     CONTENT REFRESH LOOP                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│       ┌──────────┐                                                       │
│       │ MONITOR  │◀────────────────────────────────────┐                │
│       │          │                                      │                │
│       │ GSC data │                                      │                │
│       │ Rankings │                                      │                │
│       │ Traffic  │                                      │                │
│       └────┬─────┘                                      │                │
│            │                                            │                │
│            ▼                                            │                │
│       ┌──────────┐     ┌──────────┐     ┌──────────┐   │                │
│       │  DETECT  │────▶│ DIAGNOSE │────▶│   FIX    │───┘                │
│       │          │     │          │     │          │                     │
│       │ Triggers │     │ Root     │     │ Auto or  │                     │
│       │ fire     │     │ cause    │     │ Queue    │                     │
│       └──────────┘     └──────────┘     └──────────┘                     │
│            │                                  │                           │
│            │           ┌──────────┐           │                           │
│            └──────────▶│  VERIFY  │◀──────────┘                           │
│                        │          │                                       │
│                        │ Recovery │                                       │
│                        │ tracking │                                       │
│                        └──────────┘                                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Stage 1: Detection

### Trigger Types

| Trigger | Threshold | Detection Logic |
|---------|-----------|-----------------|
| **Ranking Drop** | Position fell 5+ in 14 days | Compare current vs 14-day-ago position |
| **Traffic Drop** | Organic down 20%+ MoM | Compare current vs 30-day-ago sessions |
| **Competitor Gain** | New competitor in top 5 | SERP monitoring detects new domain |
| **Content Age** | No updates in 6+ months | Check last_updated_at timestamp |
| **Freshness Signals** | Outdated dates/stats detected | Content analysis finds old years, stale stats |
| **CTR Drop** | CTR dropped 30%+ at same position | Compare CTR while holding position constant |

### Detection Query

```sql
WITH ranking_changes AS (
  SELECT 
    kr.keyword_id,
    kr.page_url,
    kr.position as current_position,
    LAG(kr.position, 14) OVER (
      PARTITION BY kr.keyword_id 
      ORDER BY kr.date
    ) as position_14d_ago,
    kr.impressions
  FROM keyword_rankings kr
  WHERE kr.project_id = $1
    AND kr.date >= NOW() - INTERVAL '30 days'
),
traffic_changes AS (
  SELECT
    pa.page_url,
    pa.sessions as current_sessions,
    LAG(pa.sessions, 30) OVER (
      PARTITION BY pa.page_url
      ORDER BY pa.date
    ) as sessions_30d_ago
  FROM page_analytics pa
  WHERE pa.project_id = $1
)
SELECT 
  p.id as page_id,
  p.url,
  p.title,
  p.last_updated_at,
  
  -- Ranking metrics
  rc.current_position,
  rc.position_14d_ago,
  (rc.current_position - rc.position_14d_ago) as position_change,
  
  -- Traffic metrics  
  tc.current_sessions,
  tc.sessions_30d_ago,
  
  -- Decay trigger type
  CASE
    WHEN (rc.current_position - rc.position_14d_ago) >= 5 THEN 'ranking_drop'
    WHEN tc.current_sessions < tc.sessions_30d_ago * 0.8 THEN 'traffic_drop'
    WHEN p.last_updated_at < NOW() - INTERVAL '6 months' THEN 'content_age'
    ELSE 'other'
  END as decay_trigger,
  
  -- Priority score (higher = more urgent)
  (
    COALESCE((rc.current_position - rc.position_14d_ago) * 2, 0) +
    CASE WHEN tc.current_sessions < tc.sessions_30d_ago * 0.8 THEN 20 ELSE 0 END +
    CASE WHEN p.last_updated_at < NOW() - INTERVAL '6 months' THEN 10 ELSE 0 END +
    COALESCE(rc.impressions / 1000, 0)
  ) as priority_score

FROM pages p
LEFT JOIN ranking_changes rc ON rc.page_url = p.url
LEFT JOIN traffic_changes tc ON tc.page_url = p.url
WHERE p.project_id = $1
  AND (
    (rc.current_position - rc.position_14d_ago) >= 5
    OR tc.current_sessions < tc.sessions_30d_ago * 0.8
    OR p.last_updated_at < NOW() - INTERVAL '6 months'
  )
  AND (p.last_refresh_at IS NULL OR p.last_refresh_at < NOW() - INTERVAL '30 days')
ORDER BY priority_score DESC
LIMIT 50;
```

### BullMQ Worker

```typescript
// Runs daily at 4 AM
const decayDetectionWorker = new Worker('decay-detection', async (job) => {
  const { projectId } = job.data;
  
  const decayingContent = await detectDecayingContent(projectId);
  
  for (const page of decayingContent) {
    await refreshQueue.add('diagnose', {
      projectId,
      pageId: page.page_id,
      pageUrl: page.url,
      decayTrigger: page.decay_trigger,
      priorityScore: page.priority_score,
    }, {
      priority: Math.max(1, 100 - page.priority_score),
    });
  }
  
  return { detected: decayingContent.length };
});
```

---

## Stage 2: Diagnosis

### Issue Types

| Issue Type | How Detected | Auto-Fixable |
|------------|--------------|--------------|
| `outdated_stats` | Gemini identifies stats without recent sources | Yes |
| `broken_links` | HTTP HEAD requests return 4xx/5xx | Yes |
| `thin_content` | Section word count < 100 | Yes |
| `missing_subtopics` | Competitor headings we don't have | Yes |
| `old_dates` | Regex finds years 2+ years old | Yes |
| `stale_screenshots` | Image URLs reference old versions | Partial |
| `missing_faq` | No FAQ section + PAA questions available | Yes |
| `poor_meta` | Meta description < 120 chars or missing keyword | Yes |

### Diagnosis Process

```typescript
interface DecayDiagnosis {
  pageUrl: string;
  issues: DecayIssue[];
  competitorAnalysis: CompetitorGap[];
  recommendedActions: RefreshAction[];
}

async function diagnoseDecay(
  pageUrl: string,
  pageContent: string,
  competitors: CompetitorContent[],
): Promise<DecayDiagnosis> {
  const issues: DecayIssue[] = [];
  
  // 1. Check for outdated dates/years
  const dateIssues = detectOutdatedDates(pageContent);
  if (dateIssues.length > 0) {
    issues.push({
      type: 'old_dates',
      severity: 'medium',
      details: `Found outdated dates: ${dateIssues.join(', ')}`,
      autoFixable: true,
    });
  }
  
  // 2. Check for broken links
  const brokenLinks = await checkLinks(pageContent);
  if (brokenLinks.length > 0) {
    issues.push({
      type: 'broken_links',
      severity: 'high',
      details: `${brokenLinks.length} broken links found`,
      autoFixable: true,
    });
  }
  
  // 3. Check for outdated statistics (Gemini analysis)
  const outdatedStats = await detectOutdatedStats(pageContent);
  if (outdatedStats.length > 0) {
    issues.push({
      type: 'outdated_stats',
      severity: 'high',
      details: `${outdatedStats.length} statistics may be outdated`,
      autoFixable: true,
    });
  }
  
  // 4. Check content depth vs competitors
  const contentGap = analyzeContentGap(pageContent, competitors);
  if (contentGap.missingSubtopics.length > 0) {
    issues.push({
      type: 'missing_subtopics',
      severity: 'high',
      details: `Missing: ${contentGap.missingSubtopics.join(', ')}`,
      autoFixable: true,
    });
  }
  
  // 5. Check for thin sections
  const thinSections = detectThinSections(pageContent);
  if (thinSections.length > 0) {
    issues.push({
      type: 'thin_content',
      severity: 'medium',
      details: `${thinSections.length} sections under 100 words`,
      autoFixable: true,
    });
  }
  
  // 6. Check for missing FAQ
  const hasFaq = /faq|frequently asked/i.test(pageContent);
  const paaQuestions = await fetchPeopleAlsoAsk(pageUrl);
  if (!hasFaq && paaQuestions.length > 0) {
    issues.push({
      type: 'missing_faq',
      severity: 'low',
      details: `No FAQ, ${paaQuestions.length} PAA questions available`,
      autoFixable: true,
    });
  }
  
  return {
    pageUrl,
    issues,
    competitorAnalysis: contentGap.competitorDetails,
    recommendedActions: prioritizeActions(issues),
  };
}
```

### Outdated Date Detection

```typescript
function detectOutdatedDates(content: string): string[] {
  const currentYear = new Date().getFullYear();
  const outdated: string[] = [];
  
  // Match year patterns
  const yearPattern = /\b(20[0-2][0-9])\b/g;
  let match;
  while ((match = yearPattern.exec(content)) !== null) {
    const year = parseInt(match[1]);
    if (year < currentYear - 1) {
      outdated.push(match[0]);
    }
  }
  
  // Match relative date patterns
  const relativePatterns = [
    /last year/gi,
    /in 202[0-4]/gi,
    /recent(ly)? (in )?(20[0-2][0-4])/gi,
  ];
  
  for (const pattern of relativePatterns) {
    const matches = content.match(pattern);
    if (matches) {
      outdated.push(...matches);
    }
  }
  
  return [...new Set(outdated)];
}
```

### Competitor Content Gap Analysis

```typescript
async function analyzeContentGap(
  ourContent: string,
  competitors: CompetitorContent[],
): Promise<ContentGap> {
  // Extract headings from our content
  const ourHeadings = extractHeadings(ourContent);
  
  // Extract headings from competitors
  const competitorHeadings = competitors.flatMap(c => extractHeadings(c.content));
  
  // Find headings competitors have that we don't (semantic matching)
  const missingSubtopics = await findSemanticGaps(ourHeadings, competitorHeadings);
  
  // Compare section depth
  const thinnerSections = compareSectionDepth(ourContent, competitors);
  
  return {
    missingSubtopics,
    thinnerSections,
    competitorDetails: competitors.map(c => ({
      url: c.url,
      wordCount: c.wordCount,
      uniqueTopics: extractUniqueTopics(c.content, ourContent),
    })),
  };
}
```

---

## Stage 3: Auto-Fix

### Action Priority

| Priority | Issue Type | Fix Method | Effort |
|----------|------------|------------|--------|
| 1 | `old_dates` | Regex + Gemini context-aware replacement | Low |
| 2 | `broken_links` | Find archived URL (Wayback) or remove | Low |
| 3 | `outdated_stats` | Gemini researches current data | Medium |
| 4 | `poor_meta` | Gemini rewrites meta description | Low |
| 5 | `missing_faq` | Generate FAQ from PAA questions | Medium |
| 6 | `thin_content` | Expand sections with RAG + Gemini | Medium |
| 7 | `missing_subtopics` | Generate new section with RAG | High |

### Fix Implementation

```typescript
async function applyRefresh(
  page: Page,
  diagnosis: DecayDiagnosis,
  clientKnowledge: KnowledgeBase,
): Promise<RefreshResult> {
  let content = page.content;
  const changes: AppliedChange[] = [];
  
  const actions = diagnosis.recommendedActions.sort((a, b) => a.priority - b.priority);
  
  for (const action of actions) {
    switch (action.type) {
      case 'update_dates':
        const dateResult = await updateDates(content);
        content = dateResult.content;
        changes.push({ type: 'update_dates', details: dateResult.changes });
        break;
        
      case 'fix_broken_links':
        const linkResult = await fixBrokenLinks(content, action.brokenLinks);
        content = linkResult.content;
        changes.push({ type: 'fix_broken_links', details: linkResult.changes });
        break;
        
      case 'update_statistics':
        const statsResult = await updateStatistics(content, action.outdatedStats);
        content = statsResult.content;
        changes.push({ type: 'update_statistics', details: statsResult.changes });
        break;
        
      case 'add_faq':
        const faqResult = await generateFAQ(page.targetKeyword, clientKnowledge);
        content = insertFAQ(content, faqResult.faq);
        changes.push({ type: 'add_faq', details: faqResult });
        break;
        
      case 'expand_sections':
        const expandResult = await expandThinSections(content, action.thinSections, clientKnowledge);
        content = expandResult.content;
        changes.push({ type: 'expand_sections', details: expandResult.changes });
        break;
        
      case 'add_subtopics':
        const subtopicResult = await addMissingSubtopics(content, action.missingSubtopics, clientKnowledge);
        content = subtopicResult.content;
        changes.push({ type: 'add_subtopics', details: subtopicResult.changes });
        break;
    }
  }
  
  // Store original for rollback
  await storeContentVersion(page.id, page.content, 'pre_refresh');
  
  return {
    pageUrl: page.url,
    originalContent: page.content,
    refreshedContent: content,
    changesApplied: changes,
    rollbackAvailable: true,
  };
}
```

### Statistics Update

```typescript
async function updateStatistics(
  content: string,
  outdatedStats: OutdatedStat[],
): Promise<{ content: string; changes: string[] }> {
  const changes: string[] = [];
  let updated = content;
  
  for (const stat of outdatedStats.filter(s => s.outdatedLikelihood !== 'low')) {
    // Research current data with Gemini
    const currentData = await researchCurrentStatistic(stat.claim);
    
    if (currentData.found) {
      const replacement = `${currentData.currentValue} (${currentData.source}, ${currentData.sourceYear})`;
      
      // Context-aware replacement
      updated = await replaceStatisticInContext(updated, stat.claim, replacement);
      changes.push(`Updated: "${stat.claim}" → "${replacement}"`);
    }
  }
  
  return { content: updated, changes };
}

async function researchCurrentStatistic(claim: string): Promise<StatisticResearch> {
  const prompt = `
    Find the current, most recent statistic for: "${claim}"
    Search for 2025-2026 data from reputable sources.
    
    Return JSON:
    {
      "found": true,
      "currentValue": "...",
      "source": "...",
      "sourceYear": 2026
    }
    
    Or if not found: { "found": false }
  `;
  
  return await gemini.generateContent(prompt);
}
```

### Section Expansion

```typescript
async function expandThinSections(
  content: string,
  thinSections: ThinSection[],
  knowledge: KnowledgeBase,
): Promise<{ content: string; changes: string[] }> {
  const changes: string[] = [];
  let updated = content;
  
  for (const section of thinSections) {
    // Retrieve relevant knowledge via RAG
    const relevantKnowledge = await retrieveKnowledge(knowledge.clientId, section.heading, 3);
    
    const expandPrompt = `
      Expand this thin section while maintaining the article's voice.
      
      CURRENT SECTION:
      ## ${section.heading}
      ${section.content}
      
      (Currently ${section.wordCount} words, target 200-300 words)
      
      KNOWLEDGE TO INCORPORATE:
      ${relevantKnowledge.map(k => JSON.stringify(k.data)).join('\n')}
      
      RULES:
      - Maintain same tone and style
      - Integrate knowledge naturally
      - Add practical examples
      - No fluff - every sentence adds value
    `;
    
    const expansion = await gemini.generateContent(expandPrompt);
    updated = replaceSection(updated, section.heading, expansion.text);
    changes.push(`Expanded "${section.heading}" from ${section.wordCount} to ~${countWords(expansion.text)} words`);
  }
  
  return { content: updated, changes };
}
```

### WordPress Plugin Application

```typescript
async function applyToWordPress(
  siteUrl: string,
  pageId: string,
  refreshResult: RefreshResult,
  apiKey: string,
): Promise<void> {
  const response = await fetch(`${siteUrl}/wp-json/openseo/v1/content/${pageId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-OpenSEO-Key': apiKey,
    },
    body: JSON.stringify({
      content: refreshResult.refreshedContent,
      meta_description: refreshResult.newMetaDescription,
      changes: refreshResult.changesApplied,
      rollback_version: refreshResult.originalContent,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`WordPress update failed: ${await response.text()}`);
  }
}
```

---

## Stage 4: Verification

### Recovery Tracking

```typescript
interface RecoveryStatus {
  pageId: string;
  refreshedAt: Date;
  daysSinceRefresh: number;
  
  positionAtRefresh: number;
  positionNow: number;
  positionChange: number;
  
  trafficAtRefresh: number;
  trafficNow: number;
  trafficChangePercent: number;
  
  status: 'recovered' | 'improving' | 'no_change' | 'declined' | 'too_early';
  recommendation: 'close' | 'monitor' | 'deeper_refresh' | 'rollback';
}

async function checkRecoveryStatus(pageId: string, refreshRecord: RefreshRecord): Promise<RecoveryStatus> {
  const daysSinceRefresh = daysBetween(refreshRecord.refreshedAt, new Date());
  
  // Need at least 14 days to judge
  if (daysSinceRefresh < 14) {
    return { status: 'too_early', recommendation: 'monitor', /* ... */ };
  }
  
  const currentMetrics = await getCurrentMetrics(pageId);
  
  const positionChange = refreshRecord.positionAtRefresh - currentMetrics.position;
  const trafficChange = percentChange(refreshRecord.trafficAtRefresh, currentMetrics.traffic);
  
  // Determine status
  let status: RecoveryStatus['status'];
  let recommendation: RecoveryStatus['recommendation'];
  
  if (positionChange >= 3 || trafficChange >= 15) {
    status = 'recovered';
    recommendation = 'close';
  } else if (positionChange >= 1 || trafficChange >= 5) {
    status = 'improving';
    recommendation = 'monitor';
  } else if (positionChange >= -2 && trafficChange >= -10) {
    status = 'no_change';
    recommendation = daysSinceRefresh > 30 ? 'deeper_refresh' : 'monitor';
  } else {
    status = 'declined';
    recommendation = 'rollback';
  }
  
  return { pageId, status, recommendation, /* ... */ };
}
```

### Recovery Thresholds

| Status | Position Change | Traffic Change | Action |
|--------|-----------------|----------------|--------|
| **Recovered** | Improved 3+ | OR +15%+ | Close, success |
| **Improving** | Improved 1-2 | OR +5-14% | Keep monitoring |
| **No Change** | -2 to +1 | AND -10% to +5% | Try deeper refresh after 30 days |
| **Declined** | Dropped 3+ | OR -20%+ | Rollback immediately |

### Verification Worker

```typescript
// Runs daily, checks all refreshes from 14-60 days ago
const recoveryVerificationWorker = new Worker('recovery-verification', async (job) => {
  const { projectId } = job.data;
  
  const pendingVerification = await getPendingVerifications(projectId);
  
  for (const record of pendingVerification) {
    const status = await checkRecoveryStatus(record.pageId, record);
    
    await updateRefreshRecord(record.id, status);
    
    switch (status.recommendation) {
      case 'rollback':
        await rollbackContent(record.pageId, record.originalContent);
        await flagForManualReview(record.pageId, 'Refresh caused decline');
        break;
        
      case 'deeper_refresh':
        await refreshQueue.add('deep-refresh', {
          pageId: record.pageId,
          previousRefreshId: record.id,
        });
        break;
    }
  }
});
```

---

## Database Schema

```sql
CREATE TABLE content_refreshes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  
  -- Trigger info
  decay_trigger TEXT NOT NULL,
  priority_score INTEGER NOT NULL,
  
  -- Diagnosis
  diagnosis JSONB NOT NULL,
  issues_found TEXT[] NOT NULL,
  
  -- Refresh details
  actions_taken JSONB NOT NULL,
  original_content TEXT NOT NULL,
  refreshed_content TEXT NOT NULL,
  
  -- Metrics at refresh time
  position_at_refresh REAL,
  traffic_at_refresh INTEGER,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'applied',
  verification_status TEXT,
  verification_data JSONB,
  
  -- Timestamps
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  refreshed_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE content_versions (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  meta_description TEXT,
  version_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refreshes_project ON content_refreshes(project_id);
CREATE INDEX idx_refreshes_status ON content_refreshes(status);
CREATE INDEX idx_versions_page ON content_versions(page_id);
```

---

## Safeguards

### Rate Limiting

| Limit | Value | Reason |
|-------|-------|--------|
| Max refreshes per page | 1 per 30 days | Avoid churn signals |
| Max refreshes per day | 10 per project | Gradual rollout |
| Max deep refreshes | 5 per month | High-effort limit |

### Rollback Capability

Every refresh stores the original content. If verification detects decline:
1. Restore original content via WordPress plugin
2. Mark refresh as "rolled_back"
3. Flag for manual review

### Human Escalation Triggers

- 2 consecutive failed refreshes on same page
- Rollback triggered
- Refresh caused >20% traffic decline
- Page has >10,000 monthly sessions (high-value)

---

## Summary

| Stage | What Happens | Frequency |
|-------|--------------|-----------|
| **Detect** | Scan for ranking/traffic drops, stale content | Daily |
| **Diagnose** | Identify root causes | Per-detection |
| **Fix** | Apply targeted fixes via WordPress plugin | Queued |
| **Verify** | Track recovery for 14-30 days | Daily checks |

**Core Principle:** Fix surgically, verify empirically, rollback safely.
