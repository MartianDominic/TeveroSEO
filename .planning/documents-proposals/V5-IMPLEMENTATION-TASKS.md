# V5 Slippery Slope Implementation Tasks

**Source:** `v4-slippery-slope.html`
**Target:** `v5-slippery-slope.html`
**CTA Target:** https://m.me/dominicjenkins33888 (Messenger)
**Status:** Ready for Implementation

---

## Final Decisions

| # | Decision | Choice | Notes |
|---|----------|--------|-------|
| 1 | Guarantee styling | Horizontal rules | No box, top/bottom `<hr>` for prominence |
| 2 | CTA funnel | Soft → Prices → Messenger | All soft CTAs anchor to #planai, only pricing CTAs go to Messenger |
| 3 | Hero CTA | Reword | "Norite iškart pereiti prie kainų?" |
| 4 | Pain CTA | Move | Place after solution reveal, not after pain pullquote |
| 5 | Process section | Appendix style | Inline summaries (Label+Title+Result), full detail in appendix |
| 6 | Line-height | Keep 1.9 | No change |
| 7 | Secondary button | Keep both | Primary button + secondary as text link |
| 8 | Secondary styling | Text link | Not button, subtle underlined link |
| 9 | Bucket brigade tone | Soften | "Galbūt skamba per gerai..." |
| 10 | btn-mid color | Black | Red only for final CTA |

---

## CTA Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  SOFT CTAs (all point to #planai)                          │
│  ├─ Hero soft CTA: "Norite iškart pereiti prie kainų?"     │
│  ├─ After solution reveal whisper CTA                       │
│  ├─ After FAQ soft CTA box                                  │
│  └─ After disqualification self-selection CTA               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  PRICING SECTION (#planai)                                  │
│  └─ Post-pricing mid-CTA → Messenger                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  FINAL CTA SECTION                                          │
│  ├─ Primary button → Messenger                              │
│  ├─ Secondary text link → #planai (back to prices)          │
│  └─ P.S. → Messenger                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Constraints

- **No testimonials** — skip all testimonial tasks
- **One before/after only** — optional, only if authentic
- **No fake deadlines** — competitor-advantage framing only
- **No boxes/cards** — horizontal rules for prominence instead
- **Keep line-height 1.9** — intentional for long-form reading

---

## PHASE 1: Typography Fixes

### Task 1.1: h2 margin-bottom reduction
- [ ] **Status:** TODO
- **Element:** `h2`
- **Current:** `margin-bottom: 48px`
- **Change to:** `margin-bottom: 32px`
- **Rationale:** Headlines should lean INTO text, not stand as monuments.

### Task 1.2: numbered-label visibility
- [ ] **Status:** TODO
- **Element:** `.numbered-label`
- **Current:** `font-size: 15px; color: #A1A1AA`
- **Change to:** `font-size: 14px; color: #71717A; letter-spacing: 0.05em`
- **Rationale:** Navigation landmarks must be visible for scanning.

### Task 1.3: pullquote line-height
- [ ] **Status:** TODO
- **Element:** `.pullquote`
- **Current:** `line-height: 1.45`
- **Change to:** `line-height: 1.55`
- **Also:** `border-left: 2px solid #18181B` (stronger visual break)
- **Rationale:** Italic serif needs breathing room.

### Task 1.4: price-guarantee prominence (HORIZONTAL RULES, NOT BOX)
- [ ] **Status:** TODO
- **Element:** `.price-guarantee`
- **Current:** Plain text with top border
- **Change to:**
```css
.price-guarantee {
  font-size: 18px;
  line-height: 1.7;
  color: #18181B;
  padding: 24px 0;
  margin-top: 24px;
  border-top: 1px solid #18181B;
  border-bottom: 1px solid #18181B;
}
```
- **Rationale:** Horizontal rules create prominence without boxes. Maintains "no cards" principle.

### Task 1.5: final-cta paragraph contrast
- [ ] **Status:** TODO
- **Element:** `.final-cta p`
- **Current:** `color: rgba(250, 250, 250, 0.75)`
- **Change to:** `color: rgba(250, 250, 250, 0.85)`

### Task 1.6: P.S. visibility
- [ ] **Status:** TODO
- **Element:** `.ps`
- **Current:** `font-size: 17px; color: rgba(250, 250, 250, 0.7)`
- **Change to:** `font-size: 18px; color: rgba(250, 250, 250, 0.85)`

### Task 1.7: hr margin reduction
- [ ] **Status:** TODO
- **Element:** `hr`
- **Current:** `margin: 120px 0`
- **Change to:** `margin: 80px 0`

### Task 1.8: signoff-role visibility
- [ ] **Status:** TODO
- **Element:** `.signoff-role`
- **Current:** `color: rgba(250, 250, 250, 0.5)`
- **Change to:** `color: rgba(250, 250, 250, 0.65)`

---

## PHASE 2: CTA Infrastructure (Replace Phone with Messenger)

### Task 2.1: Update topbar
- [ ] **Status:** TODO
- **Location:** Topbar
- **Current:** `<a href="tel:+37068364665">+370 683 64665</a>`
- **Change to:** Remove contact link entirely. Topbar becomes minimal brand only:
```html
<div class="topbar-inner">
  <span>Tevero · SEO partneriai</span>
</div>
```

### Task 2.2: Update footer
- [ ] **Status:** TODO
- **Location:** Footer
- **Current:** Contains phone number
- **Change to:** Remove phone, keep business info:
```html
<footer class="footer">
  Tevero MB · Įm. kodas 307565560 · Vilnius · tevero.lt
</footer>
```

### Task 2.3: Add #planai anchor to pricing section
- [ ] **Status:** TODO
- **Location:** "Trys planai" h2
- **Change to:** `<h2 id="planai">Trys planai. Išsirinkite jums tinkamiausią lygį.</h2>`

### Task 2.4: Update primary CTA button
- [ ] **Status:** TODO
- **Location:** Final CTA section
- **Current:** `<a href="tel:+37068364665" class="btn">Skambinti dabar →</a>`
- **Change to:** `<a href="https://m.me/dominicjenkins33888" class="btn" target="_blank">Parašykite žinutę →</a>`

### Task 2.5: Update secondary CTA to text link
- [ ] **Status:** TODO
- **Location:** Final CTA section
- **Current:** `<a href="#" class="btn btn-secondary">Peržiūrėti paketus</a>`
- **Change to:** 
```html
<a href="https://m.me/dominicjenkins33888" class="btn" target="_blank">Parašykite žinutę →</a>
<p class="secondary-link">arba <a href="#planai">peržiūrėkite paketus ↑</a></p>
```
- **CSS needed:**
```css
.secondary-link {
  margin-top: 20px;
  font-size: 15px;
  color: rgba(250, 250, 250, 0.6);
}
.secondary-link a {
  color: rgba(250, 250, 250, 0.8);
  text-decoration: underline;
  text-underline-offset: 3px;
}
```

---

## PHASE 3: Strategic CTAs

### Task 3.1: Hero soft CTA (→ #planai)
- [ ] **Status:** TODO
- **Location:** After hero-lead paragraph
- **HTML:**
```html
<p class="hero-soft-cta">Norite iškart pereiti prie kainų? <a href="#planai">Žiūrėti planus →</a></p>
```
- **CSS:**
```css
.hero-soft-cta {
  font-size: 16px;
  color: #71717A;
  margin-top: 32px;
}
.hero-soft-cta a {
  color: #18181B;
  text-decoration: underline;
  text-underline-offset: 3px;
}
```

### Task 3.2: After solution reveal whisper CTA (→ #planai)
- [ ] **Status:** TODO
- **Location:** After "Jei to nepadarome, mes grąžiname visus pinigus. Tai aiškiai įrašyta sutartyje."
- **HTML:**
```html
<p class="whisper-cta"><em>Jei tai jau skamba įtikinamai — <a href="#planai">peržiūrėkite planus</a> ir susisiekite.</em></p>
```
- **CSS:**
```css
.whisper-cta {
  font-size: 17px;
  color: #52525B;
  margin: 32px 0;
}
.whisper-cta a {
  color: #18181B;
}
```

### Task 3.3: After FAQ soft CTA box (→ #planai)
- [ ] **Status:** TODO
- **Location:** After the three "Klausimas" blocks, before hr
- **HTML:**
```html
<p class="soft-cta-text">Jei jūsų abejonės atsakytos — <a href="#planai">peržiūrėkite planus</a> ir parašykite svetainės adresą. Atsakysiu per 24 valandas.</p>
```
- **CSS:**
```css
.soft-cta-text {
  font-size: 18px;
  color: #3F3F46;
  margin: 48px 0;
  padding: 24px 0;
  border-top: 1px solid #E4E4E7;
  border-bottom: 1px solid #E4E4E7;
}
.soft-cta-text a {
  color: #18181B;
  font-weight: 500;
}
```

### Task 3.4: Post-pricing mid-CTA (→ Messenger)
- [ ] **Status:** TODO
- **Location:** After the three price blocks, before "O kas vyksta po 6 mėnesių?"
- **HTML:**
```html
<div class="mid-cta">
  <p><strong>Pasiruošę pradėti?</strong></p>
  <a href="https://m.me/dominicjenkins33888" class="btn-mid" target="_blank">Susisiekite per Messenger →</a>
</div>
```
- **CSS:**
```css
.mid-cta {
  text-align: center;
  padding: 48px 0;
  margin: 48px 0;
  border-top: 1px solid #E4E4E7;
  border-bottom: 1px solid #E4E4E7;
}
.mid-cta p {
  margin-bottom: 20px;
  font-size: 20px;
}
.btn-mid {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 16px 28px;
  background: #18181B;
  color: #FFFFFF;
  font-family: 'Inter', sans-serif;
  font-size: 16px;
  font-weight: 500;
  text-decoration: none;
  border-radius: 4px;
  transition: all 0.2s ease;
}
.btn-mid:hover {
  background: #27272A;
}
```

### Task 3.5: After disqualification self-selection CTA (→ #planai)
- [ ] **Status:** TODO
- **Location:** After the "verslams, kurie jau žino savo vertę" pullquote
- **HTML:**
```html
<p>Jei čia apie jus — <a href="#planai">peržiūrėkite planus</a> ir susisiekime. Jei ne — linkiu sėkmės su kitais sprendimais.</p>
```

### Task 3.6: P.S. with Messenger link
- [ ] **Status:** TODO
- **Location:** P.S. section
- **Change to:**
```html
<div class="ps">
  <strong>P.S.</strong> Jei dar dvejojate — pagalvokite apie tai: kiekvienas mėnuo be veiksmų yra dar vienas mėnuo, kai jūsų konkurentai renka jūsų potencialius klientus. Mes siūlome 100% pinigų grąžinimo garantiją. Jūs tiesiog neturite ko prarasti. → <a href="https://m.me/dominicjenkins33888" target="_blank">Parašykite dabar</a>
</div>
```

---

## PHASE 4: Bucket Brigades

### Task 4.1: Before problem section
- [ ] **Status:** TODO
- **Location:** After "Skaitykite toliau..." paragraph
- **Add:** `Bet pirma leiskite parodyti, kas vyksta su jūsų verslu šiuo metu...`

### Task 4.2: Before industry attack
- [ ] **Status:** TODO  
- **Location:** After the pullquote about losing money to competitors
- **Add:** `Ir čia prasideda tikroji problema.`

### Task 4.3: Before Tevero reveal (SOFTENED)
- [ ] **Status:** TODO
- **Location:** After "Problema ta, kad agentūra nerizikuoja niekuo..."
- **Add:** `Bet ką, jei būtų kitaip? Ką, jei agentūra prisiimtų visą riziką?`
- **Then:** Keep "Būtent todėl atsirado Tevero."

### Task 4.4: After guarantee statement (SOFTENED with "Galbūt")
- [ ] **Status:** TODO
- **Location:** After "Jei to nepadarome, mes grąžiname visus pinigus. Tai aiškiai įrašyta sutartyje."
- **Add:** `Galbūt skamba per gerai, kad būtų tiesa? Suprantu. Todėl atsakykime į klausimus, kurie jums dabar sukasi galvoje.`

### Task 4.5: Before content demo section
- [ ] **Status:** TODO
- **Location:** Before "Kaip realiai atrodo tekstas" h2
- **Add:** `Bet pakalbėkime apie tai, kas iš tikrųjų padeda parduoti.`

### Task 4.6: Between process stages
- [ ] **Status:** TODO
- **Location:** After Stage III result line
- **Add:** `Bet dar ne viskas.`
- **Location:** After Stage V result line  
- **Add:** `Ir štai kas viską sujungia.`

### Task 4.7: Before price reveal
- [ ] **Status:** TODO
- **Location:** Before "Kiek tai realiai kainuoja" h2
- **Add:** `Dabar jau suprantate, ką mes darome ir kodėl tai veikia. Bet greičiausiai jau galvojate apie vieną dalyką.`

---

## PHASE 5: Process Section Restructure (Appendix Style)

### Task 5.1: Create inline summary structure
- [ ] **Status:** TODO
- **Action:** Replace full process stages with condensed version:

```html
<h2>Ką mes realiai veiksime tuos 6 mėnesius?</h2>

<p>Štai 6 etapai, per kuriuos vedame kiekvieną projektą:</p>

<div class="process-summary">
  <div class="process-item">
    <div class="process-label">I etapas</div>
    <div class="process-title">Auditas, po kurio aišku, ką daryti.</div>
    <div class="process-result">→ Tikslus prioritetų sąrašas, o ne statistika.</div>
  </div>

  <div class="process-item">
    <div class="process-label">II etapas</div>
    <div class="process-title">Raktinių žodžių atranka.</div>
    <div class="process-result">→ Pilnas, pelningų frazių žemėlapis.</div>
  </div>

  <div class="process-item">
    <div class="process-label">III etapas</div>
    <div class="process-title">Techninis svetainės sutvarkymas.</div>
    <div class="process-result">→ Techniškai sutvarkyta svetainė, kurią „Google" gali lengvai nuskaityti.</div>
  </div>

  <!-- Bucket brigade: "Bet dar ne viskas." -->

  <div class="process-item">
    <div class="process-label">IV etapas</div>
    <div class="process-title">Turinys, kuris padeda parduoti.</div>
    <div class="process-result">→ Turinys, kuris ne tik renka srautą, bet ir padeda parduoti.</div>
  </div>

  <div class="process-item">
    <div class="process-label">V etapas</div>
    <div class="process-title">Išorinio autoriteto stiprinimas.</div>
    <div class="process-result">→ Augantis svetainės autoritetas be nereikalingos rizikos.</div>
  </div>

  <!-- Bucket brigade: "Ir štai kas viską sujungia." -->

  <div class="process-item">
    <div class="process-label">VI etapas</div>
    <div class="process-title">Kassavaitinė kontrolė ir korekcijos.</div>
    <div class="process-result">→ Jūs matote kas vyksta, mes taisome silpniausias vietas.</div>
  </div>
</div>

<p class="process-detail-link">Detalesnį kiekvieno etapo aprašymą rasite <a href="#metodologija">žemiau, prieš pabaigą</a>.</p>
```

### Task 5.2: Create process summary CSS
- [ ] **Status:** TODO
```css
.process-summary {
  margin: 40px 0;
}
.process-item {
  padding: 20px 0;
  border-bottom: 1px solid #F4F4F5;
}
.process-item:first-child {
  border-top: 1px solid #F4F4F5;
}
.process-label {
  font-family: 'Newsreader', Georgia, serif;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.03em;
  color: #71717A;
  margin-bottom: 8px;
}
.process-title {
  font-family: 'Newsreader', Georgia, serif;
  font-size: 22px;
  font-weight: 500;
  color: #18181B;
  margin-bottom: 8px;
}
.process-result {
  font-size: 17px;
  color: #52525B;
}
.process-detail-link {
  font-size: 16px;
  color: #71717A;
  margin-top: 32px;
}
.process-detail-link a {
  color: #18181B;
  text-decoration: underline;
}
```

### Task 5.3: Create appendix section (before final CTA)
- [ ] **Status:** TODO
- **Location:** After "Kaip pradedame?" section, before final-cta
- **HTML:**
```html
<section class="appendix" id="metodologija">
  <h2>Detaliau: 6 etapų metodologija</h2>
  
  <p class="appendix-intro">Jei norite geriau suprasti, kas tiksliai vyksta kiekviename etape — štai išsamus aprašymas.</p>

  <!-- Full content from original stages goes here -->
  <div class="appendix-stage">
    <h4>I etapas: Auditas</h4>
    <p>Dažniausiai agentūros atsiunčia 47 puslapių PDF failą...</p>
    <p>Mūsų auditas atsako į vieną klausimą...</p>
  </div>

  <!-- Repeat for stages II-VI -->
</section>
```

### Task 5.4: Create appendix CSS
- [ ] **Status:** TODO
```css
.appendix {
  margin-top: 80px;
  padding-top: 80px;
  border-top: 1px solid #E4E4E7;
}
.appendix h2 {
  font-size: 28px;
  margin-top: 0;
  margin-bottom: 24px;
}
.appendix-intro {
  font-size: 17px;
  color: #52525B;
  margin-bottom: 48px;
}
.appendix-stage {
  margin-bottom: 48px;
}
.appendix-stage h4 {
  font-family: 'Newsreader', Georgia, serif;
  font-size: 20px;
  font-weight: 500;
  color: #18181B;
  margin-bottom: 16px;
}
.appendix-stage p {
  font-size: 17px;
  line-height: 1.75;
  color: #52525B;
  margin-bottom: 16px;
}
```

---

## PHASE 6: Content Adjustments

### Task 6.1: Remove "Kodėl to nepadaro vien SEO įrankis?" section
- [ ] **Status:** TODO
- **Rationale:** This is now redundant with condensed process section. The appendix covers detail.

### Task 6.2: Keep "Ahrefs 96.55%" pullquote
- [ ] **Status:** TODO
- **Location:** After process section, before keyword selection
- **Action:** Keep as-is — strong proof point

### Task 6.3: Soft urgency reframe
- [ ] **Status:** TODO
- **Location:** Final CTA section text
- **Change:** Remove or soften any fake deadline language
- **Keep:** "Per mėnesį priimame tik 8 naujus projektus" — this is real capacity
- **Remove:** Any "limited time" or artificial scarcity

---

## Implementation Order

1. **Create v5** — Copy v4 to v5-slippery-slope.html
2. **Phase 1** — Typography fixes (CSS only)
3. **Phase 2** — CTA infrastructure (HTML + CSS)
4. **Phase 5** — Process restructure (major content change)
5. **Phase 3** — Strategic CTAs (HTML + CSS)
6. **Phase 4** — Bucket brigades (content additions)
7. **Phase 6** — Content cleanup

---

## Verification Checklist

After implementation, verify:
- [ ] All soft CTAs link to #planai
- [ ] Only post-pricing and final CTAs link to Messenger
- [ ] P.S. has Messenger link
- [ ] No phone numbers remain
- [ ] Process section is condensed inline
- [ ] Appendix exists with full detail
- [ ] All typography fixes applied
- [ ] Mobile responsive still works
- [ ] No boxes/cards — only horizontal rules for prominence
