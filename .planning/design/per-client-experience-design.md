# Per-Client Experience — World-Class Design Specification

**Date:** 2026-04-28
**Status:** Design specification — drives prototype `client-hub-v1.html`
**Scope:** The agency user's view when managing a single client (e.g., `/clients/acme-corp`)
**Register:** Linear × Superhuman × Stripe — per `ui-redesign-exploration.md` §9

---

<design_brief>
  <project>TeveroSEO Per-Client Experience</project>
  <intent>
    When an agency user clicks into a single client from the command center, every subsequent
    screen must feel like opening a Bloomberg terminal for that one company — instrument-grade
    information density, editorial intelligence, and a clear answer to "what do I do next."
    The client hub is the single most-visited screen in the platform after the command center.
    It is the primary surface where account managers, analysts, and owners do real work.
  </intent>
  <success_signal>
    A new agency user lands on a client they've never seen before and within 30 seconds knows:
    (1) is this client healthy, (2) what changed recently, (3) what's the most important thing
    to do today. Without scrolling. Without clicking.
  </success_signal>
</design_brief>

---

<personas>

  <persona id="owner" name="Agency owner / principal">
    <jobs>
      Verify portfolio is on track. Spot-check individual clients before sales calls or QBRs.
      Approve high-stakes actions (publishing strategic articles, sending proposals).
    </jobs>
    <session_pattern>Drops in 2–4× per day for 90 seconds at a time.</session_pattern>
    <success_signals>Briefing is enough; doesn't need to drill in unless something's wrong.</success_signals>
  </persona>

  <persona id="analyst" name="SEO analyst">
    <jobs>
      Triage daily — review rank movers, audit issues, keyword opportunities. Schedule deep work.
      Run audits, build keyword maps, write briefs.
    </jobs>
    <session_pattern>Lives in the platform 4–6 hours/day. Power-user. ⌘K everything.</session_pattern>
    <success_signals>Density. Keyboard navigation. No friction between insight and action.</success_signals>
  </persona>

  <persona id="account_manager" name="Account manager">
    <jobs>
      Prep for client calls. Generate and review reports. Send updates. Manage goals and scope.
      Field client questions ("what happened this week?").
    </jobs>
    <session_pattern>30–45 min sessions, 2× per client per week.</session_pattern>
    <success_signals>Editorial summaries that can be paraphrased to clients. Clean PDFs. Annotated charts.</success_signals>
  </persona>

</personas>

---

<workflows>

  <workflow id="morning_check_in">
    <name>Morning client check-in</name>
    <duration>90 seconds per client</duration>
    <steps>
      1. Click client in portfolio table or recent-clients list
      2. Read briefing hero
      3. Glance at action queue
      4. If green: close. If yellow: snooze. If red: drill into the one critical thing
    </steps>
    <hero_loads_must_show>
      Health change since yesterday. Anything that fired (alerts, auto-reverts, new findings).
      A specific recommended action.
    </hero_loads_must_show>
  </workflow>

  <workflow id="prep_for_client_call">
    <name>Prep for a scheduled call with this client</name>
    <duration>10 minutes</duration>
    <steps>
      1. Open client → overview
      2. Read 7-day changes from briefing + movers
      3. Click into open opportunities (top 3)
      4. Glance at content pipeline + scheduled reports
      5. Open the most recent report or generate a fresh one
      6. Copy "stakeholder digest" → paste into call notes
    </steps>
  </workflow>

  <workflow id="deep_keyword_session">
    <name>Keyword research + mapping session</name>
    <duration>45–90 min</duration>
    <steps>
      1. Open client → SEO tab → keywords
      2. Filter to "striking distance" (positions 11–30)
      3. Map keywords to existing pages or queue new pages
      4. Generate briefs for new pages
      5. Schedule articles in calendar
    </steps>
  </workflow>

  <workflow id="audit_triage">
    <name>Post-audit triage</name>
    <duration>20–40 min</duration>
    <steps>
      1. Audit completes (notification or activity feed entry)
      2. Open client → SEO → audit
      3. Group by tier severity
      4. Approve safe auto-fixes (Tier 1 alt text, canonicals, etc.)
      5. Flag complex fixes for human review (title rewrites, content gaps)
      6. Watch traffic the next 24h for auto-revert triggers
    </steps>
  </workflow>

  <workflow id="content_review">
    <name>Article approval + voice review</name>
    <duration>15 min per article × 3–5 articles</duration>
    <steps>
      1. Open client → content (or articles tab)
      2. See queue: pending review (quality gate scored ≥80)
      3. Inspect each: voice compliance, brief adherence, internal linking proposal
      4. Approve → schedules publish + GSC submission + link auto-insertion
    </steps>
  </workflow>

</workflows>

---

<information_architecture>

  <breadcrumb_model>
    Workspace › Clients › [Client name] › [Section] › [Detail]
    Always visible. Always clickable. Always short.
  </breadcrumb_model>

  <client_scoped_navigation>
    <intent>
      When inside a client, the global sidebar should remain visible (workspace-level nav)
      but a CLIENT TAB BAR appears below the client identity strip, scoping all subsequent
      navigation to this one client. This is how Stripe handles it — global nav stays put,
      a secondary tab bar appears for the focused entity.
    </intent>
    <tabs>
      Overview     · default landing (this spec)
      SEO          · audit + keywords + rankings + backlinks + internal-linking + keyword-mapping + domain
      Content      · articles + calendar + brand voice + brief generation
      Analytics    · GSC/GA4 deep dive
      Reports      · generated PDFs + schedule
      Activity     · changes log + alerts history + auto-fix events
      Settings     · CMS connection + branding + report templates + voice profile + webhooks
    </tabs>
    <secondary_navigation_rule>
      Within each tab, sub-navigation is exposed via a left rail (NOT more tabs).
      Tabs are top-level. Sub-rails are page-level. Never nest tabs.
    </secondary_navigation_rule>
  </client_scoped_navigation>

</information_architecture>

---

<adaptive_hero>
  <intent>
    The client hub hero (top of the Overview tab) MUST adapt to the client's lifecycle state.
    A new client needs setup guidance; a healthy client needs status; a regressing client
    needs urgency. One template doesn't fit all states. This is the world-class differentiator.
  </intent>

  <state id="onboarding">
    <trigger>Client created &lt; 14 days ago, OR setup checklist incomplete</trigger>
    <hero_copy_pattern>
      "{Client} joined {N} days ago. {X} of {Y} setup steps complete. Next: {specific action}."
    </hero_copy_pattern>
    <example>
      "Acme Corp joined 6 days ago. 4 of 7 setup steps complete. Next: connect Google Search Console
      to start backfilling 90 days of data."
    </example>
    <action_queue_focus>Setup completion items only.</action_queue_focus>
  </state>

  <state id="active_growth">
    <trigger>Health ≥ 80, traffic trend positive, recent wins exist</trigger>
    <hero_copy_pattern>
      "{Client} is up. {Headline metric} {direction} {magnitude}, driven by {top mover}.
      {N} opportunities ready to action: {summary}."
    </hero_copy_pattern>
    <example>
      "Acme is up. Organic traffic grew 18.4% this week, driven by 'enterprise seo platform'
      reaching #1. Two opportunities are ready to action: 8 keywords sitting in positions 11–15
      (push to page 1), and 6 articles awaiting brand-voice review."
    </example>
    <action_queue_focus>Growth opportunities + content review.</action_queue_focus>
  </state>

  <state id="watching">
    <trigger>Health 60–79 OR mixed signals (some up, some down)</trigger>
    <hero_copy_pattern>
      "{Client} is mixed. {Positive signal}, but {concerning signal}. {Specific recommendation}."
    </hero_copy_pattern>
    <example>
      "Globex is mixed. Traffic stable at +0.2% week-over-week, but 3 keywords dropped from
      Top 10 ('industrial automation', 'enterprise iot', 'ai manufacturing'). Consider running
      a competitive SERP analysis on those queries before they drop further."
    </example>
    <action_queue_focus>Investigative tasks + preventive actions.</action_queue_focus>
  </state>

  <state id="critical">
    <trigger>Health &lt; 60, OR active critical alert, OR auto-revert in last 7d</trigger>
    <hero_copy_pattern>
      "{Client} needs attention. {Headline issue}. {What you should do RIGHT NOW}.
      {Context: what fired, when, why}."
    </hero_copy_pattern>
    <example>
      "Tyrell needs attention. Traffic dropped 28% week-over-week — auto-revert fired on
      yesterday's title-tag fixes. Investigate /products/* before scheduling more changes.
      The reverts have restored ~14% so far; remaining 14% may be a separate signal."
    </example>
    <action_queue_focus>Critical-only. Hide growth items until resolved.</action_queue_focus>
  </state>

  <state id="maintenance">
    <trigger>Health ≥ 90, no opportunities flagged, mature client (&gt; 6 months)</trigger>
    <hero_copy_pattern>
      "{Client} is healthy. {Headline metric}. {Optional: gentle improvement suggestion}.
      Nothing urgent today."
    </hero_copy_pattern>
    <example>
      "Wayne Industries is healthy. 9 of 9 goals on track, 24.7% traffic growth.
      The next strategic move is expanding into the 'industrial automation' cluster
      where you have authority but no targeted pages yet. Nothing urgent today."
    </example>
    <action_queue_focus>Strategic-only suggestions. Reduced cadence.</action_queue_focus>
  </state>

</adaptive_hero>

---

<screens>

<screen id="client_hub_overview">
  <route>/clients/[clientId]</route>
  <purpose>
    The default landing when an agency user enters a client. Single screen that delivers
    state, recent change, recommended action, and pathways to deep work — without scrolling
    if possible.
  </purpose>

  <anatomy>

    <region id="topbar" priority="utility">
      Standard global topbar (search ⌘K, notifications, settings).
    </region>

    <region id="breadcrumb" priority="orientation">
      Workspace › Clients › Acme Corp
    </region>

    <region id="identity_strip" priority="hero">
      <intent>
        Compact info-dense bar — like Stripe's customer header. Logo, name, domain,
        plan, key inline metrics, primary actions. ALL on one row. NOT a card stack.
      </intent>
      <layout_left>
        Client logo (32px square) · Client name (display serif, 24px) · Domain (sans, monospaced for URL feel) · Plan pill (e.g., "Growth · €1,200/mo")
      </layout_left>
      <layout_right>
        Inline ticker: Health 84 · Traffic 30d 128k +18% · Top 10 47 · Goals 7/9 · Last sync 2h
        Each metric is clickable → drills to that surface.
        Then primary actions: ⌘K search · "Generate report" · "Run audit"
      </layout_right>
    </region>

    <region id="client_tabs" priority="navigation">
      Overview · SEO · Content · Analytics · Reports · Activity · Settings
      Active state: emerald underline + bold text. Hairline border below.
    </region>

    <region id="briefing_hero" priority="critical">
      <description>
        The world-class differentiator. Adaptive narrative paragraph generated from current state.
        2–4 sentences. Editorial tone — NOT bulleted, NOT data-as-copy. Reads like a Bloomberg
        intro paragraph. State-aware per the &lt;adaptive_hero&gt; rules above.
      </description>
      <typography>
        Display serif (Fraunces/GT Sectra) at 18–20px, line-height 1.4, color text-1.
        Inline metric numbers stay in serif for "expensive instrument" feel.
        Inline accent words (key keyword, "auto-revert", etc.) use accent color.
      </typography>
      <padding>
        Generous. 32px top, 24px sides. Optical centering. Limit width to ~720px for readability.
      </padding>
      <signals>
        Below the paragraph, a thin metadata strip: "Briefing generated 2h ago · period: last 7 days · sources: 3"
        Subtle. The agency user should trust the briefing — show it's grounded.
      </signals>
    </region>

    <region id="goal_progress_strip" priority="anchor">
      <intent>
        Horizontal strip showing all configured goals for this client with attainment %.
        Anchored to the agency's goal contract — every metric below relates to one of these.
      </intent>
      <layout>
        Single row. 9 goal pills max (typical client). If &gt;9, scrolls horizontally.
        Each pill: goal name · attainment % · trend arrow.
        Color: emerald if ≥100%, amber 75–99%, red &lt;75%.
      </layout>
      <example>
        Keywords in Top 10: 47/50 ↑ · #1 Rankings: 4/5 ↑ · Weekly Clicks: 32k/30k ↑ · MoM Growth: 18%/15% ↑ · CTR: 3.4%/4.0% ↓
      </example>
    </region>

    <region id="action_queue" priority="critical">
      <intent>
        AI-prioritized list of 3–5 specific actions. NOT a generic task list. Each item is
        a single-line action with a primary CTA button on the right. The user should be able
        to action all of them in ≤2 minutes.
      </intent>
      <prioritization_rule>
        Priority score = (alerts × 1000) + (auto-revert events × 500) + (goal gaps × 50) + (opportunities × 20).
        Hide items with score &lt; 10 unless &lt; 3 actionable items exist.
      </prioritization_rule>
      <item_anatomy>
        [icon] [bold action title] · [terse context] [→ action button]
      </item_anatomy>
      <examples>
        ⚠ Investigate auto-revert on /products/* · 12 changes reverted, traffic still down 14% [Investigate]
        🔍 Review 6 articles blocked at quality gate · avg score 72, voice profile incomplete [Configure voice]
        📈 Push 8 striking-distance keywords to page 1 · est. +18,400 traffic [View opportunities]
        🔗 Approve 14 internal link suggestions · all ≥85% confidence [Approve safe]
        📅 Acme weekly report generates today 5pm · 2 recipients confirmed [Preview]
      </examples>
    </region>

    <region id="performance_chart" priority="hero">
      <intent>
        90-day dual-axis chart: organic clicks (line) + average position (line, inverted axis).
        EDITORIAL ANNOTATIONS overlaid: when audit ran, when articles published, when fixes applied,
        when alerts fired. This is the "instrument" feel — context for every wiggle.
      </intent>
      <annotations>
        Vertical hairline at significant events. Tooltip on hover.
        e.g., "Apr 14: Audit run · 31 fixes applied"
        e.g., "Apr 18: Article published — 'enterprise seo platform guide'"
        e.g., "Apr 22: Auto-revert fired on /products/*"
      </annotations>
      <styling>
        Use the hatched-fill signature on the area-under-the-line for clicks.
        Position line stays solid emerald. Inverted right axis (lower position = higher visually).
        Hairline gridlines. No vertical gridlines.
      </styling>
    </region>

    <region id="movers_split" priority="information">
      <intent>
        Two columns side-by-side: Rank gainers (left) | Rank losers (right).
        Top 5 each. Click any keyword → drill to keyword detail.
      </intent>
      <columns>
        Each row: keyword · old position → new position · sparkline · est. traffic delta
      </columns>
    </region>

    <region id="content_pipeline_mini" priority="information">
      <intent>
        This-client-only article state distribution + next 7 days scheduled.
        Same component as command center but scoped.
      </intent>
    </region>

    <region id="open_issues_strip" priority="information">
      <intent>
        Bloomberg-style horizontal strip showing audit findings by tier.
        Tier 1 (DOM/regex): 3 critical, 12 warn · Tier 2 (calculated): 1 critical, 8 warn ·
        Tier 3 (API): 0 critical, 3 warn · Tier 4 (site-wide): 0 critical, 2 warn
        Each tier clickable → audit drilldown filtered to that tier.
      </intent>
    </region>

    <region id="activity_feed_scoped" priority="information">
      <intent>
        Real-time activity for THIS CLIENT ONLY. Same component as command center,
        filtered. Includes auto-fix events, article state transitions, alerts, integrations.
      </intent>
    </region>

    <region id="stakeholder_rail" priority="utility">
      <intent>
        Right-side mini-rail with stakeholder controls — actions the account manager
        does to communicate OUT to the client. NOT analyst tools.
      </intent>
      <controls>
        - Weekly digest preview (rendered like the email the client gets)
        - Share latest report (copy link / email)
        - Schedule call (Calendly link)
        - Contract status (next renewal, MRR, plan)
        - Last contact: 4 days ago (with quick-log "Just talked to them" button)
      </controls>
    </region>

  </anatomy>

  <interaction_patterns>

    <pattern name="Command palette is everywhere">
      ⌘K opens search globally, but inside a client it's CLIENT-SCOPED by default.
      Escape with ⌘⇧K to switch to global search.
    </pattern>

    <pattern name="Keyboard for everything">
      G then O = Overview · G then S = SEO · G then C = Content · G then A = Analytics · G then R = Reports
      J/K = navigate list items
      Enter = open
      ⌘E = export
      ⌘⇧A = run audit
      ⌘⇧R = generate report
      ? = show all shortcuts
    </pattern>

    <pattern name="Inline editing">
      Plan pill in identity strip → click → edit MRR/plan inline.
      Goal attainment pill → click → edit target inline.
      Voice profile incomplete badge → click → opens voice editor in side panel (not navigation).
    </pattern>

    <pattern name="Side panel for deep edits">
      Anything that would normally be a "Settings" navigation can also open as a side panel
      on top of the current view. Preserves context. Like Linear's issue side panel.
    </pattern>

    <pattern name="Editorial linking">
      Every metric and entity is a link. "47 keywords in Top 10" is clickable → keywords filtered.
      "Acme weekly report" is clickable → opens report. Hover shows preview tooltip.
    </pattern>

  </interaction_patterns>

  <microcopy_rules>
    <rule>Numbers in display serif. Labels in sans. Always.</rule>
    <rule>Time-relative not absolute. "2h ago" not "14:32". "Tomorrow" not "Apr 29".</rule>
    <rule>Never use "click here". Verbs only on CTAs ("Investigate", "Approve safe", "Preview").</rule>
    <rule>Prefer specific over generic. "8 striking-distance keywords" beats "potential opportunities".</rule>
    <rule>Show your work. "Briefing generated 2h ago · sources: 3" beats hiding the methodology.</rule>
    <rule>Never apologize. No "Oops" or "Whoops". Errors are direct: "Couldn't reach GSC. Reconnect."</rule>
    <rule>Stakeholder-safe copy on stakeholder rail. Internal jargon allowed elsewhere.</rule>
  </microcopy_rules>

</screen>

</screens>

---

<screen_inventory_secondary>
  Screens that follow the same patterns once Overview lands:

  <screen id="seo_audit">/clients/[id]/seo/[projectId]/audit — findings list grouped by tier, severity filter, bulk-action toolbar, side panel for finding detail with before/after diff and approve/reject buttons.</screen>
  <screen id="seo_keywords">/clients/[id]/seo/[projectId]/keywords — keyword table dominates; left rail with saved filters (striking distance, low-hanging, brand, etc.), right side panel for keyword detail (rank history chart, SERP preview, mapping suggestion).</screen>
  <screen id="seo_keyword_mapping">/clients/[id]/seo/[projectId]/keyword-mapping — two-column: keywords (left) ↔ pages (right), drag-to-map. AI-suggested mappings shown as dashed lines.</screen>
  <screen id="content_articles">/clients/[id]/articles — article library table; status filter pills; quick action: generate / approve / publish.</screen>
  <screen id="content_calendar">/clients/[id]/calendar — react-big-calendar at full bleed; events color-coded by status; hover preview; click to open article side panel.</screen>
  <screen id="content_brief_editor">/clients/[id]/articles/new — split view: brief structure (left) ↔ generated content preview (right); voice compliance meter pinned; quality gate score prominent.</screen>
  <screen id="analytics">/clients/[id]/analytics — GSC + GA4 charts, top queries table, dimension filters; period selector controls everything.</screen>
  <screen id="report_viewer">/clients/[id]/reports/[reportId] — clean editorial layout, white-label branded, "Send to client" hero CTA.</screen>
</screen_inventory_secondary>

---

<implementation_notes>
  <stack>Next.js 15 RSC. shadcn/ui. Tailwind. Recharts. All restyled per `ui-redesign-exploration.md` §9.</stack>

  <new_components_needed>
    - `&lt;BriefingHero&gt;` — adaptive paragraph. Server-rendered. Takes client state, returns serif-typeset narrative.
    - `&lt;ActionQueue&gt;` — prioritized list with primary CTA. Each action has a server-action handler.
    - `&lt;GoalProgressStrip&gt;` — horizontal pills, click → drill.
    - `&lt;AnnotatedTimeline&gt;` — Recharts dual-axis with custom event markers via &lt;ReferenceLine&gt;.
    - `&lt;MoversSplit&gt;` — two-column rank-change list with sparklines.
    - `&lt;StakeholderRail&gt;` — right-side mini-rail with comms-oriented controls.
    - `&lt;SidePanel&gt;` — overlay for deep edits without nav. Keyboard: Esc closes, ⌘W closes.
  </new_components_needed>

  <briefing_generation>
    Generate via Claude Haiku with prompt template per &lt;adaptive_hero&gt; state.
    Cache 1h per client. Regenerate on: significant event (alert fires, audit completes, +-10% traffic).
    Show "Briefing generated Nh ago" footer for trust.
  </briefing_generation>

  <data_dependencies>
    - `getClientHero(clientId)` — returns state + briefing-relevant payload
    - `getActionQueue(clientId)` — server action; runs prioritization
    - `getGoalAttainment(clientId)` — already exists per Phase 22
    - `getAnnotatedTimeline(clientId, period)` — joins gsc_snapshots with site_changes, articles, alerts
    - `getRankMovers(clientId, period)` — keyword rank diff
    - `getOpenFindingsByTier(clientId)` — already exists per Phase 32
  </data_dependencies>

  <progressive_loading>
    Identity strip + tabs: instant (cached client meta).
    Briefing hero: stream via React Suspense; fallback is "Reading state…" with subtle pulse.
    Chart: stream second.
    Below-fold (movers, content pipeline, activity): stream third.
    Feels alive while loading; nothing blocks the visible surface.
  </progressive_loading>

  <accessibility>
    All metric pills are buttons (keyboard-focusable).
    Briefing hero has aria-live="polite" so screen readers announce updates.
    Activity feed: role=feed, with aria-label="Recent activity for {client}".
    Color is never the only signal — every status uses icon + text + color triple.
  </accessibility>
</implementation_notes>

---

<quality_bar>
  This screen is benchmarked against:
  - Stripe customer detail (information density + inline editing)
  - Linear project view (keyboard-first + side panel pattern)
  - Bloomberg terminal (annotated timelines + briefing-style hero)
  - Mercury account view (editorial tone for finance — applied to SEO)
  - Superhuman email (state-adaptive UI based on context)

  If a chosen detail doesn't pass the test "would Stripe/Linear/Bloomberg ship this?", revise.
</quality_bar>
