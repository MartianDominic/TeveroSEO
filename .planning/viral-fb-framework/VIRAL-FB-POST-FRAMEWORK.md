# Viral Facebook Post Framework for TeveroSEO
## Actionable Mechanisms with Mathematics

**Purpose**: Create viral FB posts for the €2500/6mo SEO guarantee service  
**Target Market**: Lithuanian SMBs (e-commerce, local services)  
**Last Updated**: 2026-05-08

---

## THE MATHEMATICS OF THE GUARANTEE

### Why €2500 for 10 Keywords Works

**Cost Structure (from PrioritizationService.ts):**
```
Per-client operational cost: €0.85/month
├── DataForSEO: €0.10
├── Scraping: €0.08  
├── AI extraction: €0.005
└── AI classification: €0.25

6-month operational cost: €5.10/client
Revenue: €2,500
Gross margin: 99.8%
```

**Break-even on guarantee:**
- If 1 in 5 clients get refunded (20% failure rate), margin drops to ~60%
- Actual failure rate controlled by **5-factor feasibility scoring**

### The 5-Factor Keyword Feasibility Score

From `PrioritizationService.ts`:
```
Score = (0.15 × Volume) + (0.10 × InverseCompetition) + 
        (0.25 × Relevance) + (0.35 × Focus) + (0.15 × Position)
```

| Tier | Score | Selection |
|------|-------|-----------|
| Must-Do | ≥0.75 | Always target |
| Should-Do | ≥0.50 | High confidence |
| Nice-to-Have | ≥0.25 | Conditional |
| Ignore | <0.25 | Never promise |

**Guarantee math**: Only keywords scoring ≥0.50 get promised. This is why the guarantee is defensible.

### Quick Win Detection Multipliers

From `QuickWinDetector.ts`:
```
Striking Distance (1.3x): Position 11-30, Volume ≥200, Competition ≤0.7
Low Hanging Fruit (1.2x): Position 4-10, Competition ≤0.5, Volume ≥100
Fresh Opportunity (1.15x): Not ranking, Relevance ≥0.9, Volume ≥500, Competition ≤0.4
```

### CTR Impact by Position (AWR Benchmarks)

```
Position 1:  28.51% CTR  ← Moving here = 13.7x traffic vs Position 10
Position 2:  15.50% CTR
Position 3:  11.00% CTR
Position 5:   6.50% CTR
Position 10:  2.07% CTR  ← Baseline
Position 20:  0.50% CTR
```

**FB Post Math Hook:**
```
"Moving from position 11 to position 3 = 6x more clicks.
Not 10% more. Not 50% more. 600% more."
```

---

## THE 2026 SEO MECHANISMS

### What Actually Changed (Use in Posts)

| Old Way (2012-2024) | New Way (2026) | Why It Matters |
|---------------------|----------------|----------------|
| Keyword stuffing | Entity Consensus | Google cross-checks 3rd party mentions |
| Random backlinks | Tributary Trust Protocol | Off-page corroboration required |
| Generic AI content | 7 Quality Gates | Reddit Test, Information Gain Test |
| Single page optimization | Site-level topicality | Hub/spoke architecture wins |
| More content = more traffic | 500-token chunk architecture | Google retrieves in specific chunks |

### The 7 Google AI Ranking Signals

From `seobuild-onpage.md`:
```
1. Base Ranking: Topic cluster authority
2. Gecko Score: Semantic embeddings match
3. Jetstream: Context/nuance understanding
4. BM25: Traditional keyword matching
5. PCTR: Predicted click-through rate
6. Freshness: Time-decay recency
7. Boost/Bury: Quality adjustments
```

**FB Post Technical Hook:**
```
"Google 2026 uses 7 AI signals to rank your site.
Most agencies still optimize for just 1 (keywords).
We address all 7. That's why we guarantee results."
```

### QDD Vulnerability (The Hidden Takeover Signal)

When Reddit, Pinterest, or TikTok rank in top 10 for a commercial keyword:
```
QDD_SIGNAL: HIGH_CONFIDENCE_TAKEOVER

Translation: Google is diversity-filling because 
NO authority page exists. This is your moment.
```

**FB Post Contrarian Hook:**
```
"When Reddit ranks on page 1 for a business keyword,
most SEOs say 'too hard.'

We say 'perfect.'

Because Google is showing Reddit as a placeholder.
No real authority exists yet. 

One well-structured page can displace it
in a single index cycle."
```

### 500-Token Chunk Architecture

From `ChunkExtractor.ts`:
```
Google retrieves content in ~500 tokens (~375 words)
LLMs chunk at ~600 words with ~300 word overlap
Content not structured to these boundaries = fragmented retrieval
```

**FB Post Technical Hook:**
```
"Google's AI reads your content in 500-word chunks.
If your answer spans two chunks, it gets lost.
If your evidence is 3 sections away from your claim, it doesn't count.

We structure content to match exactly how Google reads it.
This is why AI Overviews cite our clients."
```

---

## THE 7 QUALITY GATES (Content Differentiation)

### What Each Gate Catches

| Gate | Test | Pass Threshold |
|------|------|----------------|
| T5-01 | Reddit Test | Embedding similarity ≥0.85 |
| T5-02 | Information Gain | ≥40% unique vs SERP |
| T5-03 | Prove-It Details | 1 evidence per 200 words |
| T5-04 | Not For You | Must exist |
| T5-05 | QDD Vulnerability | Similarity <0.9 to any SERP |
| T5-06 | Thin Content | YMYL: 800w, ecom: 300w |
| T5-07 | Fluff Detection | <10 weasel words per 1000w |

### Banned Phrases (Auto-Detected)

```
FLUFF: "in today's digital age", "it goes without saying", "when it comes to"
WEASEL: "may", "might", "could potentially", "possibly", "some experts"
```

**FB Post Quality Hook:**
```
"Before any content touches your site, it passes 7 gates:

✓ Would it survive r/[your industry] without being called 'AI slop'?
✓ Does it add 40%+ unique information vs. page 1 results?
✓ Is every claim backed by evidence IN THE SAME PARAGRAPH?
✓ Does it tell readers when this is NOT for them?
✓ No 'in today's digital age' or 'some experts believe'

One failed gate = content doesn't publish.
That's why our content ranks."
```

---

## THE GUARANTEE PSYCHOLOGY

### Why the Guarantee is Defensible (Internal Logic)

```
1. 5-factor feasibility scoring → Only promise achievable keywords
2. Quick win detection → Prioritize easiest wins first
3. 7 quality gates → Content actually ranks
4. GSC integration → Real data, not estimates
5. Keyword lock-in → Accountability at contract signing
```

**The Self-Limiting Logic (Use in Objection Handling):**
```
"If we did black-hat SEO, our guarantee would bankrupt us.
We'd rank you for 3 months, Google would ban your site,
and we'd owe you €2,500 back.

Our entire model depends on white-hat tactics that last.
That's not ethics. That's survival."
```

### Objection Pre-Emption Map

| Objection | Root Fear | Address In Post |
|-----------|-----------|-----------------|
| "Is this black SEO?" | Penalty fear | Guarantee self-limiting logic |
| "Too expensive" | ROI uncertainty | CTR math (6x traffic) |
| "We tried SEO before" | Past failure | "Google 2026 is different" paradigm shift |
| "How long for results?" | Impatience | "6 months or money back" |
| "Can you prove it?" | Skepticism | Real-time portal access |

---

## THE VIRAL POST FORMULA

### 5-Phase Persuasion Architecture

```
PHASE 1: PATTERN INTERRUPT (1-2 lines)
└── Question or contrarian statement that stops scroll

PHASE 2: OUT-GROUP CREATION (3-5 lines)  
└── "Most businesses think..." [wrong beliefs list]

PHASE 3: PARADIGM SHIFT (1 line)
└── "Google 2026 is a completely different game."

PHASE 4: IN-GROUP KNOWLEDGE (3-5 lines)
└── "What actually works:" [truth list]

PHASE 5: PROOF + CTA (2-3 lines)
└── Guarantee mention + engagement request
```

### Hook Templates

**Curiosity Gap:**
```
"The strangest part about SEO in 2026?"
"Here's what no one's telling you about Google rankings:"
"I analyzed 100 sites. One thing separated winners from losers:"
```

**Contrarian:**
```
"Everyone thinks more content = more traffic. They're wrong."
"Your SEO agency is lying to you (and they don't even know it)."
"The #1 SEO tactic is something most agencies actively avoid."
```

**Specific Number:**
```
"83% of Lithuanian businesses get this wrong about Google."
"Position 1 gets 28.51% of clicks. Position 10 gets 2.07%. The math matters."
"We analyzed 109 SEO checks. Only 7 actually matter in 2026."
```

**Confession:**
```
"I used to believe backlinks were everything. I was wrong."
"Last year we ranked 50 sites. 12 got penalized. Here's what we learned:"
"Our first SEO guarantee failed. Here's how we fixed the model:"
```

### Out-Group Lists (Use 3-5 Items)

```
WRONG BELIEFS (Out-group):
- "Write more blog posts"
- "Get more backlinks"  
- "Stuff keywords everywhere"
- "Use AI to generate content faster"
- "SEO takes years to work"

TRUTH (In-group):
- Technical foundation first
- Entity consensus across platforms
- Content structured for AI retrieval
- Site-level topicality beats single-page optimization
- Results in 6 months with the right system
```

### CTA Variations by Goal

**Engagement (Algorithm boost):**
```
"Drop a 🔥 if you knew this"
"Comment 'SEO' and I'll send you the full breakdown"
"Tag a business owner who needs to hear this"
```

**Lead Generation:**
```
"Comment your niche below. I'll tell you if page 1 is realistic."
"DM 'AUDIT' for a free keyword feasibility report"
"Leave your website URL. I'll check if you have quick wins."
```

**Qualification:**
```
"If you're doing €10K+/month, DM me for the guarantee details"
"This only works for e-commerce above 1000 products. Comment if that's you."
```

---

## COMPLETE POST TEMPLATES

### Template A: The Guarantee Reveal

```
Mes užkelsime tavo verslą į pirmą Google puslapį arba nemokėsi nė cento.

Keisčiausia dalis?

Didžioji dalis verslų vis dar galvoja, kad SEO yra:
• "parašom kelis straipsnius"
• "numetam backlinkų"
• "prageneruojam AI tekstų"

Tada po pusmečio stebisi kodėl niekas nevyksta.

Google 2026 jau visai kitas žaidimas.

Jiems seniai nebeįdomu kas daugiau raktažodžių prikišo į tekstą.

Dabar laimi svetainės kurios:
• techniškai tvarkingos
• greitos
• normaliai parašytos žmonėms
• aiškiai atsako į tai ko žmogus ieško
• turi stiprią teminę struktūrą

Realiai Google dabar nori vieno dalyko.
Kad tavo svetainė atrodytų kaip geriausias atsakymas internete.

Mes tiesiog viską išlaižome pagal tai.

Todėl ir galime duoti garantiją.

Parašyk komentaruose savo veiklą.
Patikrinsiu ar realu patekti į pirmą Google puslapį.
```

### Template B: The Math Hook

```
Pozicija #1 Google = 28.51% paspaudimų.
Pozicija #10 = 2.07%.

Tai reiškia, kad pirmoje pozicijoje gausi 13.7x daugiau lankytojų nei dešimtoje.

Ne 10% daugiau. Ne 50% daugiau.
1370% daugiau.

Bet čia ne viskas.

Pozicija #11 (antras puslapis) = 1.8%.
Niekas ten neeina.

Dauguma SEO agentūrų tau parodo grafiką:
"Štai, tavo pozicijos kilo iš #25 į #15!"

Matematiškai tai reiškia: 0.3% → 0.7%
Praktiškai: niekas nepasikeitė.

Mes nerodome grafiko.
Mes garantuojame 10 raktažodžių PIRMAME puslapyje per 6 mėnesius.

Arba grąžiname pinigus. Iki cento.

Įdomu? Rašyk savo nišą komentaruose.
```

### Template C: The Technical Reveal

```
Google 2026 naudoja 7 AI signalus tavo svetainei vertinti:

1. Base Ranking (tema)
2. Gecko Score (semantika)
3. Jetstream (kontekstas)
4. BM25 (raktažodžiai)
5. PCTR (numatomas paspaudimų dažnis)
6. Freshness (aktualumas)
7. Boost/Bury (kokybės korekcijos)

Dauguma agentūrų optimizuoja tik vieną (#4 - raktažodžius).

Štai kodėl tu moki €500/mėn ir nieko nevyksta.

Mes adresuojame visus 7.

Todėl galime garantuoti rezultatus:
10 raktažodžių pirmame puslapyje per 6 mėn, arba pinigai atgal.

Komentaruose parašyk savo svetainę.
Per 24h atsiųsiu nemokamą analizę - kiek turi "quick win" galimybių.
```

### Template D: The Objection Killer

```
"Bet ar tai ne black SEO?"

Geras klausimas.

Jei mes naudotume black hat taktikas:
1. Tu užsikeltum į #1 poziciją per 2 mėnesius
2. Google tave nubautų per 4 mėnesius
3. Tavo svetainė dingtu iš paieškos VISAM LAIKUI
4. Mes turėtume grąžinti €2,500

Tai mūsų pačių kaulus sulaužytų.

Mūsų visas modelis stovi ant to, kad Google MYLI tai, ką mes darome:
• Pilnas techninis sutvarkymas
• Turinio struktūra pagal 500 žodžių blokus (kaip Google skaito)
• Entitetų konsensusas per kitas platformas
• 7 kokybės vartai prieš bet kokį turinį

Viskas 100% balta.
Nes kitaip mes pirmieji žlugtume.

Rašyk "INFO" ir atsiųsiu kaip tai atrodytų tavo atveju.
```

### Template E: The Re-engagement (Cold Follow-up)

```
Sveiki!

Vakar tvarkiau senus užrašus ir akis užkliuvo už mūsų pokalbių.

Atvirai pasakius, pasijutau šiek tiek kaltas.

Net džiaugiuosi, kad tada nieko jums nepardavėme.

Prieš kelis mėnesius padariau negailestingą VISŲ savo projektų auditą.
Pažiūrėjau - kiek realių klientų tos svetainės atveda verslams?

Matematika buvo žiauri:
• Standartinė svetainė: ~200 lankytojų/mėn
• Konversija: 0.5-1%
• Realios užklausos: 1-2/mėn

Tai ne verslas. Tai brangi vizitinė kortelė internete.

Tą dieną viską sustabdžiau ir perstatėme sistemą iš pagrindų.

Dabar skaičiai kitokie:
• Srautas: 3,000+ lankytojų
• Konversija: 3-5%
• Užklausos: 90-150/mėn

Aš nežinau tavo dabartinės situacijos.

Bet jei norėtum mašinos, kuri realiai atveda klientus...
Tiesiog atrašyk vieną žodį: "Įdomu"

Jokio spaudimo. Atsiųsiu trumpą pavyzdį kaip tai atrodytų tavo atveju.
```

---

## EDGERANK OPTIMIZATION

### The Three Factors

```
AFFINITY (past interaction):
→ Post from accounts you engage with shows more
→ Tactic: Reply to EVERY comment, ask questions

WEIGHT (content type priority):
Video > Carousel > Image > Link > Text
→ Tactic: Native video or image carousel

RELEVANCE (topic + timing):
→ Post when YOUR audience is online
→ Use interest-targeted language
```

### Timing Strategy for Lithuanian Market

```
Optimal posting times (B2B in Lithuania):
• Tuesday-Thursday: 9:00-10:00, 13:00-14:00
• Avoid: Monday (overwhelmed), Friday PM (checked out)
• Weekend: Lower reach but higher engagement per viewer
```

### Video vs. Image vs. Text Performance

```
Native Video: 10x reach multiplier (must be uploaded, not linked)
Image Carousel: 5x reach multiplier (3-5 images optimal)
Single Image: 3x reach multiplier
Link Post: 1x (baseline, actually penalized)
Text Only: 0.5x (unless very short and engaging)
```

---

## ENGAGEMENT RESPONSE TEMPLATES

### When They Comment Their Niche

```
[Name], ačiū! 

[Niche] yra įdomi rinka. Pirminis vertinimas:

Konkurencija: [aukšta/vidutinė/žema]
Quick wins: [tikėtina yra/gali būti/sunkiau]
Prognozė: [realus/sudėtingas] kelias į pirmą puslapį

Norint tiksliau - man reikia tavo svetainės URL.
Galiu per 24h atsiųsti konkretų skaičių kiek raktažodžių turėtum "striking distance" zonoje (pozicijos 11-20, kur lengviausia pakilti).

Jei nori - DM arba parašyk URL čia.
```

### When They Show Interest

```
Super! Padarysiu štai ką:

1. Patikrinsiu tavo dabartines pozicijas per Google Search Console
2. Identifikuosiu "quick win" galimybes (kur jau esi arti, tik reikia stumtelėti)
3. Apskaičiuosiu tikėtiną srauto padidėjimą jei patektum į Top 10

Tai nemokamai, užtrunka ~30 min.

Atsiųsk savo svetainės URL ir per 24-48h turėsi ataskaitą.
```

### When They Object on Price

```
Suprantu! €2,500 skamba daug.

Bet pažiūrėk matematiką:

Tavo niša, pagal pradinę analizę:
• Vidutinis raktažodžio paieškų: ~500/mėn
• Top 3 pozicija = ~15% CTR = 75 lankytojai/mėn
• 10 tokių raktažodžių = 750 lankytojų/mėn
• Su 3% konversija = 22 užklausos/mėn

Jei vienas klientas tau vertas €100+, tai per 6 mėnesius ROI yra [X]x.

Bet suprantu jei šiuo metu biudžetas neleidžia.
Galiu atsiųsti nemokamą analizę, ir kai bus tinkamas momentas - žinosi kiek galimybių turi.

Siųsti?
```

---

## KEY METRICS TO TRACK

### Post Performance

```
Engagement Rate = (Likes + Comments + Shares) / Reach × 100

Good: >3%
Great: >5%
Viral potential: >10%
```

### Conversion Funnel

```
Post Reach → Comments → DM conversations → Proposals sent → Closed deals

Target: 
• 1000 reach → 30 comments (3%)
• 30 comments → 10 DMs (33%)
• 10 DMs → 3 proposals (30%)
• 3 proposals → 1 close (33%)

CAC from organic FB: ~€0 (time only)
```

---

## WEEKLY POSTING SCHEDULE

```
WEEK TEMPLATE:

Monday: Skip (low engagement)

Tuesday: Educational post (Template C - Technical Reveal)
→ Goal: Establish authority

Wednesday: Engagement post (Template A - Guarantee Reveal)  
→ Goal: Comments and shares

Thursday: Social proof / Case study
→ Goal: Trust building

Friday AM: Quick tip / Myth bust
→ Goal: Easy engagement before weekend

Weekend: Optional - Story format, behind the scenes
→ Goal: Personal connection
```

---

## FILES REFERENCED

**Mathematics:**
- `open-seo-main/src/server/features/keywords/services/PrioritizationService.ts` - 5-factor scoring
- `open-seo-main/src/server/features/keywords/services/QuickWinDetector.ts` - Quick win multipliers
- `open-seo-main/src/server/features/analytics/services/CtrBenchmarkService.ts` - AWR CTR curves

**Technical SEO:**
- `.planning/phases/92-on-page-seo-mastery/seobuild-onpage.md` - Complete SEO-AGI system
- `open-seo-main/src/server/features/onpage-mastery/services/QualityGateService.ts` - 7 quality gates
- `open-seo-main/src/server/features/onpage-mastery/utils/ChunkExtractor.ts` - 500-token architecture

**Content System:**
- `open-seo-main/src/server/features/voice/services/VoiceConstraintBuilder.ts` - 40-field voice profiles
- `AI-Writer/backend/services/voice_precedence.py` - 8-level precedence

**Portal/Transparency:**
- `open-seo-main/src/server/features/portal/services/DashboardService.ts` - Real-time metrics
- `.planning/phases/CLIENT-PORTAL-SPEC.md` - Keyword lock-in system
