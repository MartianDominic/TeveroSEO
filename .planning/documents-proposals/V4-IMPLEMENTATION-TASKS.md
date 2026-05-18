# V4 Slippery Slope Implementation Tasks

**Document:** `v4-slippery-slope.html`
**CTA Target:** https://m.me/dominicjenkins33888 (Messenger)
**Status:** In Progress

---

## Constraints

- **No testimonials available** — skip all testimonial-related tasks
- **One before/after only** — can add if brief, but don't force multiple
- **No hard deadlines** — "8 projects/month" is soft; avoid fake urgency
- **Replace all phone CTAs** with Messenger link

---

## PHASE 1: Typography Fixes (High Priority)

### Task 1.1: h2 margin-bottom reduction
- [ ] **Status:** TODO
- **File:** v4-slippery-slope.html
- **Element:** `h2` (line ~123)
- **Current:** `margin-bottom: 48px`
- **Change to:** `margin-bottom: 32px`
- **Rationale:** 48px creates visual wall between headline and opening paragraph. Headlines should lean INTO the text, not stand as monuments.

### Task 1.2: numbered-label visibility
- [ ] **Status:** TODO
- **File:** v4-slippery-slope.html
- **Element:** `.numbered-label` (line ~184)
- **Current:** `font-size: 15px; color: #A1A1AA`
- **Change to:** `font-size: 14px; color: #71717A; letter-spacing: 0.05em`
- **Rationale:** Labels like "Klausimas 01" and "I etapas" are navigation landmarks. Current styling too faint — readers can't scan/navigate.

### Task 1.3: pullquote line-height
- [ ] **Status:** TODO
- **File:** v4-slippery-slope.html
- **Element:** `.pullquote` (line ~146)
- **Current:** `line-height: 1.45`
- **Change to:** `line-height: 1.55`
- **Also consider:** `border-left: 2px solid #18181B` (stronger visual break)
- **Rationale:** Italic serif text at large sizes needs more breathing room. 1.45 feels cramped.

### Task 1.4: price-guarantee prominence
- [ ] **Status:** TODO
- **File:** v4-slippery-slope.html
- **Element:** `.price-guarantee` (line ~263)
- **Current:** Plain text with top border only
- **Change to:**
```css
.price-guarantee {
  font-size: 18px;
  line-height: 1.7;
  color: #18181B;
  background: #FAFAFA;
  padding: 20px 24px;
  border-radius: 4px;
  border-left: 3px solid #18181B;
  margin-top: 24px;
}
```
- **Rationale:** The guarantee is the MOST important trust element. Currently styled as afterthought. Should feel like a certificate.

### Task 1.5: final-cta paragraph contrast
- [ ] **Status:** TODO
- **File:** v4-slippery-slope.html
- **Element:** `.final-cta p` (line ~303)
- **Current:** `color: rgba(250, 250, 250, 0.75)`
- **Change to:** `color: rgba(250, 250, 250, 0.85)`
- **Rationale:** Decision moment needs maximum clarity. 75% opacity creates unnecessary reading friction.

### Task 1.6: P.S. visibility
- [ ] **Status:** TODO
- **File:** v4-slippery-slope.html
- **Element:** `.ps` (line ~360)
- **Current:** `font-size: 17px; color: rgba(250, 250, 250, 0.7)`
- **Change to:** `font-size: 18px; color: rgba(250, 250, 250, 0.85)`
- **Rationale:** P.S. is most-read element after headline (Halbert). Currently too faint.

### Task 1.7: hr margin reduction
- [ ] **Status:** TODO
- **File:** v4-slippery-slope.html
- **Element:** `hr` (line ~164)
- **Current:** `margin: 120px 0`
- **Change to:** `margin: 80px 0`
- **Rationale:** 120px creates visual "canyons" that break momentum. Readers may think section ended.

### Task 1.8: body line-height tightening
- [ ] **Status:** TODO
- **File:** v4-slippery-slope.html
- **Element:** `body` (line ~29)
- **Current:** `line-height: 1.9`
- **Change to:** `line-height: 1.8`
- **Rationale:** 1.9 is on high end — paragraphs feel slightly floaty. 1.8 creates denser, more compelling blocks.

### Task 1.9: signoff-role visibility
- [ ] **Status:** TODO
- **File:** v4-slippery-slope.html
- **Element:** `.signoff-role` (line ~354)
- **Current:** `color: rgba(250, 250, 250, 0.5)`
- **Change to:** `color: rgba(250, 250, 250, 0.65)`
- **Rationale:** Signer's credentials reinforce authority. 50% opacity too faint.

---

## PHASE 2: CTA Restructure (Replace Phone with Messenger)

### Task 2.1: Update primary CTA button
- [ ] **Status:** TODO
- **Location:** Final CTA section (line ~953)
- **Current:** `<a href="tel:+37068364665" class="btn">Skambinti dabar →</a>`
- **Change to:** `<a href="https://m.me/dominicjenkins33888" class="btn" target="_blank">Parašykite žinutę →</a>`
- **Rationale:** User prefers Messenger over phone calls.

### Task 2.2: Update secondary CTA button
- [ ] **Status:** TODO
- **Location:** Final CTA section (line ~954)
- **Current:** `<a href="#" class="btn btn-secondary">Peržiūrėti paketus</a>`
- **Change to:** Link to pricing section with anchor: `<a href="#planai" class="btn btn-secondary">Peržiūrėti paketus ↑</a>`
- **Also:** Add `id="planai"` to the "Trys planai" h2

### Task 2.3: Update topbar phone link
- [ ] **Status:** TODO
- **Location:** Topbar (line ~463)
- **Current:** `<a href="tel:+37068364665">+370 683 64665</a>`
- **Change to:** `<a href="https://m.me/dominicjenkins33888" target="_blank">Messenger</a>` or remove entirely
- **Decision needed:** Keep topbar minimal or remove contact?

### Task 2.4: Update footer contact
- [ ] **Status:** TODO
- **Location:** Footer (line ~970)
- **Current:** Contains phone number `+370 683 64665`
- **Change to:** Replace with Messenger link or remove phone
- **New text:** `Tevero MB · Įm. kodas 307565560 · Vilnius · tevero.lt`

---

## PHASE 3: Add Strategic CTAs (Soft + Hard)

### Task 3.1: Post-pricing hard CTA button
- [ ] **Status:** TODO
- **Location:** After the three price blocks, before "O kas vyksta po 6 mėnesių?" (line ~879)
- **Type:** Hard CTA (button)
- **HTML to add:**
```html
<div class="mid-cta">
  <p><strong>Pasiruošę pradėti?</strong></p>
  <a href="https://m.me/dominicjenkins33888" class="btn btn-mid" target="_blank">Susisiekite per Messenger →</a>
</div>
```
- **CSS needed:** `.mid-cta` and `.btn-mid` styling (smaller than final CTA)
- **Rationale:** After seeing prices, many buyers ready to act. Currently must scroll 60+ more lines.

### Task 3.2: Hero soft CTA
- [ ] **Status:** TODO
- **Location:** After hero-lead paragraph (line ~479)
- **Type:** Soft inline link
- **HTML to add:**
```html
<p class="hero-soft-cta">Jau žiūrit planus? <a href="#planai">Pasirinkite sau tinkamą →</a></p>
```
- **CSS needed:** Subtle styling, not prominent
- **Rationale:** Ready Buyers (5-10%) already convinced. Give them path to act.

### Task 3.3: After FAQ section CTA
- [ ] **Status:** TODO
- **Location:** After the three "Klausimas" blocks, before the hr (line ~559)
- **Type:** Soft prominent (light box)
- **HTML to add:**
```html
<div class="soft-cta-box">
  <p>Jei jūsų abejonės atsakytos — <a href="https://m.me/dominicjenkins33888" target="_blank">parašykite svetainės adresą</a>. Atsakysiu per 24 valandas.</p>
</div>
```
- **CSS needed:** Light gray background, subtle styling
- **Rationale:** Logical Skeptics convert after objections answered. This is "moment of maximum credibility."

### Task 3.4: P.S. Messenger link
- [ ] **Status:** TODO
- **Location:** P.S. section (line ~962)
- **Current P.S.:** Generic text with no action
- **Change to:**
```html
<div class="ps">
  <strong>P.S.</strong> Jei dar dvejojate — pagalvokite apie tai: kiekvienas mėnuo be veiksmų yra dar vienas mėnuo, kai jūsų konkurentai renka jūsų potencialius klientus. Mes siūlome 100% pinigų grąžinimo garantiją. Jūs tiesiog neturite ko prarasti. → <a href="https://m.me/dominicjenkins33888" target="_blank">Parašykite dabar</a>
</div>
```
- **Rationale:** P.S. most-read element for skimmers. Must have action mechanism.

### Task 3.5: After pain pull quote whisper CTA
- [ ] **Status:** TODO
- **Location:** After the pull quote "jūsų tiesiog nesimato" (line ~502)
- **Type:** Whispered suggestion (italic, inline)
- **HTML to add:**
```html
<p class="whisper-cta"><em>Jei norite sužinoti, kiek tiksliai prarandate — <a href="https://m.me/dominicjenkins33888" target="_blank">pakalbėkime</a>. Tai nieko nekainuoja.</em></p>
```
- **CSS needed:** `.whisper-cta` with subtle styling
- **Rationale:** Emotional peak — reader just felt pain of invisibility. Some convert here.

### Task 3.6: After disqualification self-selection CTA
- [ ] **Status:** TODO
- **Location:** After the pull quote about "verslams, kurie jau žino savo vertę" (line ~910)
- **Type:** Soft inline
- **HTML to add:**
```html
<p>Jei čia apie jus — <a href="https://m.me/dominicjenkins33888" target="_blank">pakalbėkime</a>. Jei ne — linkiu sėkmės su kitais sprendimais.</p>
```
- **Rationale:** Self-qualifying buyers who identify with description are ready to act.

---

## PHASE 4: Bucket Brigades (Momentum Restoration)

### Task 4.1: Before problem section
- [ ] **Status:** TODO
- **Location:** After line 490 ("Skaitykite toliau...")
- **Add:** New paragraph: `Bet pirma leiskite parodyti, kas vyksta su jūsų verslu šiuo metu...`

### Task 4.2: Before industry attack
- [ ] **Status:** TODO
- **Location:** After the pull quote about losing money to competitors (line ~502), after whisper CTA
- **Add:** `Ir čia prasideda tikroji problema.`

### Task 4.3: Before Tevero reveal
- [ ] **Status:** TODO
- **Location:** Line ~522, before "Būtent todėl atsirado Tevero"
- **Current:** "Problema ta, kad agentūra nerizikuoja niekuo..."
- **Add bridge:** `Bet ką, jei būtų kitaip? Ką, jei agentūra prisiimtų visą riziką?`

### Task 4.4: After guarantee statement
- [ ] **Status:** TODO
- **Location:** After line ~527 ("Jei to nepadarome, mes grąžiname visus pinigus")
- **Add:** `Skamba per gerai, kad būtų tiesa? Žinau. Todėl atsakykime į klausimus, kurie jums dabar sukasi galvoje.`

### Task 4.5: Before content demo section
- [ ] **Status:** TODO
- **Location:** After FAQ section, before "Kaip realiai atrodo tekstas" (line ~562)
- **Add:** `Bet pakalbėkime apie tai, kas iš tikrųjų padeda parduoti.`

### Task 4.6: Between process stages (mid-section energy)
- [ ] **Status:** TODO
- **Location:** After Stage II (line ~645)
- **Add:** `Bet dar ne viskas.`
- **Location:** After Stage IV (line ~661)
- **Add:** `Ir štai kur prasideda tikrasis skirtumas.`

### Task 4.7: Before price reveal
- [ ] **Status:** TODO
- **Location:** Before "Kiek tai realiai kainuoja" h2 (line ~732)
- **Add:** New paragraph before the h2: `Dabar jau suprantate, ką mes darome ir kodėl tai veikia. Bet greičiausiai jau galvojate apie vieną dalyką.`

---

## PHASE 5: Structural Improvements

### Task 5.1: Process section reduction (50%)
- [ ] **Status:** TODO
- **Location:** 6-stage process (lines ~630-678)
- **Action:** Condense each stage description by ~50%. Keep:
  - Stage label
  - Title
  - 1-2 sentences max
  - Result line
- **Remove:** Long explanatory paragraphs that slow momentum
- **Rationale:** This section kills reading momentum. Too detailed.

### Task 5.2: Add one before/after example (if available)
- [ ] **Status:** TODO
- **Location:** After content demo section (around line ~600)
- **Action:** If brief before/after available, add:
```html
<div class="before-after">
  <p><strong>Prieš:</strong> [brief description]</p>
  <p><strong>Po 6 mėn.:</strong> [result]</p>
</div>
```
- **Note:** Only if authentic example exists. Don't fabricate.

### Task 5.3: Soft urgency reframe
- [ ] **Status:** TODO
- **Location:** CTA process section (line ~914) and final CTA
- **Current:** "Per mėnesį priimame tik 8 naujus projektus"
- **Reframe to:** Keep the 8 projects mention but don't add fake deadlines
- **Alternative urgency:** Focus on competitor advantage being gained each day, not artificial scarcity
- **Example:** "Kiekviena diena be veiksmų — dar viena diena, kai konkurentai stiprėja."

---

## PHASE 6: CSS Additions Needed

### Task 6.1: Mid-letter CTA styles
- [ ] **Status:** TODO
- **Add CSS:**
```css
/* Mid-letter CTA (after pricing) */
.mid-cta {
  text-align: center;
  padding: 48px 0;
  margin: 48px 0;
  border-top: 1px solid #E4E4E7;
  border-bottom: 1px solid #E4E4E7;
}
.mid-cta p {
  margin-bottom: 20px;
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

### Task 6.2: Soft CTA box styles
- [ ] **Status:** TODO
- **Add CSS:**
```css
/* Soft CTA box (after FAQ) */
.soft-cta-box {
  background: #FAFAFA;
  padding: 24px 28px;
  border-radius: 4px;
  margin: 48px 0;
}
.soft-cta-box p {
  margin: 0;
  font-size: 18px;
}
.soft-cta-box a {
  color: #18181B;
  font-weight: 500;
}
```

### Task 6.3: Whisper CTA styles
- [ ] **Status:** TODO
- **Add CSS:**
```css
/* Whisper CTA (emotional moments) */
.whisper-cta {
  font-size: 17px;
  color: #52525B;
  margin: 32px 0;
}
.whisper-cta a {
  color: #18181B;
}
```

### Task 6.4: Hero soft CTA styles
- [ ] **Status:** TODO
- **Add CSS:**
```css
/* Hero soft CTA */
.hero-soft-cta {
  font-size: 17px;
  color: #71717A;
  margin-top: 32px;
}
.hero-soft-cta a {
  color: #18181B;
  text-decoration: underline;
  text-underline-offset: 3px;
}
```

---

## Implementation Order

1. **Phase 1** — Typography fixes (quick wins, high impact)
2. **Phase 6** — CSS additions (needed for Phase 3)
3. **Phase 2** — CTA restructure (phone → Messenger)
4. **Phase 3** — Add strategic CTAs
5. **Phase 4** — Bucket brigades
6. **Phase 5** — Structural improvements

---

## Notes

- Each task should be implemented and marked [x] when complete
- After each phase, review in browser before proceeding
- Maintain the "slippery slope" feel — no walls, no cliffs
- Test on mobile responsive view after typography changes
