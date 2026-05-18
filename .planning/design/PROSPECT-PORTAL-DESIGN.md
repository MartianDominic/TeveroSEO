# TeveroSEO Prospect Portal Design Specification

> **Purpose:** World-class prospect experience for magic link proposal pages (`/p/[token]`)
> **Goal:** Convert prospects into paying clients with zero friction and maximum trust
> **Reference:** v6 Design System, v7 Master Architecture, Phase 98 Spec

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Landing Experience (First 3 Seconds)](#2-landing-experience-first-3-seconds)
3. [Value Communication](#3-value-communication)
4. [Pricing & Package Display](#4-pricing--package-display)
5. [Call-to-Action](#5-call-to-action)
6. [Mobile Experience](#6-mobile-experience)
7. [Post-Accept Flow](#7-post-accept-flow)
8. [Trust-Building Elements](#8-trust-building-elements)
9. [Component Specifications](#9-component-specifications)
10. [Implementation Checklist](#10-implementation-checklist)

---

## 1. Design Philosophy

### The Core Tension: Trust vs Speed

Prospects opening a magic link face two competing needs:

1. **"Is this legitimate?"** — They've never seen TeveroSEO, received link via DM
2. **"What do I get?"** — Want to see value before investing time to scroll

The design resolves this by:
- **Immediate personalization** (their domain, their data) = "this is real"
- **Agency branding first** (not platform branding) = "I know who sent this"
- **Big value number above fold** = "worth my attention"

### Trust Formula Applied (from v7)

```
User Trust = Visibility x Reversibility x Predictability

Visibility:    Show THEIR data (domain, keywords, traffic)
Reversibility: Clear guarantee, money-back messaging
Predictability: Exact deliverables, timeline, no surprises
```

### The Lithuanian Buyer Psychology (from Agency Value Stack)

Critical insights for this market:
- **Price skepticism** — Too cheap = suspicious, need to anchor against "full value"
- **Agency fatigue** — "Agentūros nuvylė" — trust must be earned, not assumed
- **Guarantee centrality** — Economic proof (guarantee) outweighs social proof

---

## 2. Landing Experience (First 3 Seconds)

### 2.1 Information Hierarchy

What prospect sees INSTANTLY (above fold):

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  [Agency Logo]                               [Expires: 12 dienu]        │
│                                                                         │
│  ──────────────────────────────────────────────────────────────────────│
│                                                                         │
│           Jūsų SEO galimybė                   ← Newsreader serif, h1   │
│                                                                         │
│           meistreliokampas.lt                 ← Prospect's domain       │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                                                                 │   │
│  │          €2,400                                                 │   │
│  │          /mėn. vertės galimybė                                  │   │
│  │                                                                 │   │
│  │    ┌─────────┐  ┌─────────┐  ┌─────────┐                       │   │
│  │    │   47    │  │  2,440  │  │   28    │                       │   │
│  │    │ rakta-  │  │ paieškų │  │ vidutinis│                       │   │
│  │    │ žodžių  │  │  /mėn   │  │   KD    │                       │   │
│  │    └─────────┘  └─────────┘  └─────────┘                       │   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│        [ Peržiūrėti galimybes  ↓ ]           ← Scroll CTA             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Agency Branding vs Platform Branding

**CRITICAL:** Agency brand takes priority. TeveroSEO is invisible unless agency has no branding.

| Element | Source | Fallback |
|---------|--------|----------|
| Logo | `brandConfig.logoUrl` | TeveroSEO logo |
| Primary color | `brandConfig.primaryColor` | `--accent` (#0F4F3D) |
| Agency name | `brandConfig.agencyName` | "TeveroSEO" |
| Contact email | `brandConfig.contactEmail` | support@tevero.lt |

**Implementation:**
```typescript
const primaryColor = proposal.brandConfig?.primaryColor || '#0F4F3D';
const agencyName = proposal.brandConfig?.agencyName || 'TeveroSEO';
```

### 2.3 Personalization Elements

Every proposal page MUST show:

1. **Prospect's domain** — Large, prominent, proves "this is YOUR analysis"
2. **Their current metrics** — Traffic, keywords ranking (from analysis)
3. **Their specific opportunities** — Keywords THEY can rank for

**Why this matters:** Generic proposals feel like spam. Personalized data = legitimate business proposal.

### 2.4 Trust Signals (Above Fold)

Three trust signals visible immediately:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  [ ✓ 100% Pinigų grąžinimo garantija ]  ← Green pill, left              │
│                                                                         │
│  [ 🔒 Saugus mokėjimas ]                ← Lock icon, center             │
│                                                                         │
│  [ 8 klientų limitas ]                  ← Scarcity, right               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Value Communication

### 3.1 Keyword Opportunities Display

**The Topical Map Visualization**

Show keyword clusters as an expandable tree/map. This is the "wow" moment — prospect sees their content gaps organized into topics.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  Jūsų topinis žemėlapis                                                 │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                                                                 │   │
│  │  ├─ Makita dalys (pillar)           KD 28 │ 850/mėn.          │   │
│  │  │   ├─ makita akumuliatorius       KD 18 │ 320/mėn.   ✓ Q1   │   │
│  │  │   ├─ makita angliniai šepetėliai KD 12 │ 90/mėn.    ✓ Q1   │   │
│  │  │   └─ makita reduktorius          KD 35 │ 70/mėn.    ○ Q2   │   │
│  │  │                                                             │   │
│  │  ├─ Dewalt dalys (pillar)           KD 22 │ 420/mėn.          │   │
│  │  │   ├─ dewalt baterija             KD 15 │ 180/mėn.   ✓ Q1   │   │
│  │  │   └─ [+3 more]                                              │   │
│  │  │                                                             │   │
│  │  └─ Įrankių remontas (pillar)       KD 32 │ 650/mėn.          │   │
│  │      └─ [+8 more]                                              │   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  [ Peržiūrėti visus 47 raktažodžius ]                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Visual encoding:**
- `✓` = Included in selected package (green)
- `○` = Available in higher package (muted)
- KD = Keyword Difficulty (color-coded: green <30, yellow 30-50, red >50)
- Timeline icons (Q1, Q2) show when we expect to rank

### 3.2 Competitor Comparison

Show prospect vs competitors WITHOUT naming competitors (privacy/legal):

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  Jūs vs Konkurentai                                                     │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                                                                 │   │
│  │                    Jūs        Konkurentas A    Konkurentas B    │   │
│  │  ──────────────────────────────────────────────────────────────│   │
│  │  Puslapiai             45              180              120     │   │
│  │  Raktažodžiai          12               85               62     │   │
│  │  DA                    15               22               18     │   │
│  │                                                                 │   │
│  │  [█████░░░░░░░░░]  [████████████░░░]  [████████░░░░░░]         │   │
│  │       25%                68%              45%                   │   │
│  │                                                                 │   │
│  │  "Konkurentai turi 3-4x daugiau turinio. Su mūsų planu         │   │
│  │   per 6 mėnesius pasieksite jų lygį."                          │   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Timeline & Expected Results

Visual timeline showing realistic expectations:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  Jūsų SEO kelionė                                                       │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│     1 mėn.         2-3 mėn.        4-5 mėn.         6 mėn.             │
│        │               │               │               │                │
│        ▼               ▼               ▼               ▼                │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐            │
│  │ Auditas  │──▶│ Pirmi    │──▶│ TOP 20   │──▶│ TOP 10   │            │
│  │ Turinys  │   │ rezultatai│  │ pasiekti │   │ garantija│            │
│  │ pradžia  │   │ matomi   │   │ tiksliniai│  │ įvykdyta │            │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘            │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                                                                 │   │
│  │  Po 6 mėn. tikimasi:                                           │   │
│  │                                                                 │   │
│  │  +1,200         20/47           €1,800                         │   │
│  │  lankytojų/mėn. raktažodžių     vertės/mėn.                    │   │
│  │                 TOP 10                                          │   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.4 Package Breakdown (What's Included)

Use expandable sections for detail:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  Ką gausite                                                             │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ ▼ Techninis SEO auditas                                          │  │
│  │   ────────────────────────────────────────────────────────────── │  │
│  │   ✓ 138 kriterijų vertinimas                                     │  │
│  │   ✓ Svetainės greičio optimizavimas                              │  │
│  │   ✓ Mobile-first patikra                                         │  │
│  │   ✓ Schema markup įdiegimas                                      │  │
│  │   ✓ Core Web Vitals optimizavimas                                │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ ▶ Turinio programa (100 straipsnių)                   [Expand]   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ ▶ Raktažodžių strategija (100 tikslinių)              [Expand]   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ ▶ Mėnesinės ataskaitos                                [Expand]   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Pricing & Package Display

### 4.1 Three-Tier Layout (Desktop)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  Pasirinkite planą                                                      │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐      │
│  │                  │  │  ⭐ POPULIARIAUSIAS │  │                  │      │
│  │     PAMATAS      │  │                  │  │    AUTORITETAS    │      │
│  │                  │  │     AUGIMAS      │  │                  │      │
│  │  ─────────────── │  │                  │  │  ─────────────── │      │
│  │                  │  │  ─────────────── │  │                  │      │
│  │    €2,500        │  │                  │  │    €7,100        │      │
│  │   /6 mėnesius    │  │    €3,500        │  │   /6 mėnesius    │      │
│  │                  │  │   /6 mėnesius    │  │                  │      │
│  │  ─────────────── │  │                  │  │  ─────────────── │      │
│  │                  │  │  ─────────────── │  │                  │      │
│  │  10 raktažodžių  │  │                  │  │  40 raktažodžių  │      │
│  │  100 straipsnių  │  │  20 raktažodžių  │  │  400 straipsnių  │      │
│  │  Mėn. ataskaitos │  │  200 straipsnių  │  │  Sav. strategija │      │
│  │                  │  │  Kas 2 sav. call │  │  Prioritetinis   │      │
│  │                  │  │                  │  │                  │      │
│  │  ─────────────── │  │  ─────────────── │  │  ─────────────── │      │
│  │                  │  │                  │  │                  │      │
│  │  [ Pasirinkti ]  │  │  [ Pasirinkti ]  │  │  [ Pasirinkti ]  │      │
│  │                  │  │   ▲ Lifts 2px    │  │                  │      │
│  └──────────────────┘  │   Primary btn    │  └──────────────────┘      │
│                        │                  │                             │
│                        └──────────────────┘                             │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                                                                 │   │
│  │  Visos kainos be PVM · Mokėjimo planas galimas (2-3 dalys)     │   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Package Card Styling (v6 Compliant)

**Default package card:**
```css
.package-card {
  background: var(--surface);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  padding: var(--space-6);
  transition: box-shadow var(--motion-hover), transform var(--motion-hover);
}
.package-card:hover {
  box-shadow: var(--shadow-lift);
  transform: translateY(-1px);
}
```

**Highlighted "Popular" card:**
```css
.package-card.popular {
  border: 2px solid var(--accent);
  box-shadow: 
    0 0 0 1px rgba(15, 79, 61, 0.15),
    0 8px 24px -4px rgba(15, 79, 61, 0.12);
}
.package-card.popular::before {
  content: "POPULIARIAUSIAS";
  position: absolute;
  top: -12px; left: 50%;
  transform: translateX(-50%);
  background: var(--accent);
  color: white;
  font-size: 12px;
  font-variant-caps: all-small-caps;
  letter-spacing: 0.06em;
  padding: 4px 12px;
  border-radius: var(--radius-pill);
}
```

### 4.3 Value Anchoring

CRITICAL: Show "full value" comparison to justify price:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  Pilna vertė                                          Jūsų kaina       │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  Techninis auditas                    €3,500          ✓ Įtraukta       │
│  Raktažodžių tyrimas                  €1,500          ✓ Įtraukta       │
│  100 SEO straipsnių                   €20,000         ✓ Įtraukta       │
│  Balso dokumentacija                  €2,500          ✓ Įtraukta       │
│  6 mėn. ataskaitos                    €1,200          ✓ Įtraukta       │
│  ─────────────────────────────────────────────────────────────────────  │
│  Pilna agentūros kaina:               €28,700                           │
│  Jūsų investicija:                                    €2,500           │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Sutaupote 91%  — tai ką daro 3-4 žmonių SEO komanda           │   │
│  │  per 6 mėnesius.                                                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.4 Monthly vs Annual Toggle (Optional)

If offering annual discount:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│        [ Kas mėnesį ]    [ Metinis (sutaupykite 15%) ]                  │
│             ▲                                                           │
│         Active tab                                                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.5 Guarantee Placement

The guarantee appears in THREE places for reinforcement:

1. **Trust strip** (above fold) — Small pill
2. **Below packages** — Full guarantee card
3. **Checkout modal** — Reminder before payment

**Full guarantee card:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                                                                   │ │
│  │  🛡️  100% Pinigų grąžinimo garantija                             │ │
│  │                                                                   │ │
│  │  Garantuojame 10/20/40 raktažodžių iškėlimą į pirmą Google       │ │
│  │  puslapį per 6 mėnesius arba grąžiname visus pinigus iki cento.  │ │
│  │                                                                   │ │
│  │  ──────────────────────────────────────────────────────────────── │ │
│  │                                                                   │ │
│  │  Mes taip pasitikime savo komandos gebėjimais, kad šį            │ │
│  │  įsipareigojimą įrašome į sutartį. Nulis rizikos jums.           │ │
│  │                                                                   │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Call-to-Action

### 5.1 Primary CTA (Package Selection)

Each package has a CTA button. Selected package gets primary styling:

```css
/* Not selected */
.package-btn {
  background: var(--surface);
  color: var(--text-1);
  border: 1px solid var(--hairline);
  box-shadow: var(--shadow-card);
}

/* Selected / Primary */
.package-btn.primary {
  background: linear-gradient(180deg, #1A6E55 0%, #0F4F3D 100%);
  color: white;
  box-shadow: var(--shadow-cta);
}
.package-btn.primary:hover {
  box-shadow: var(--shadow-cta-hover);
  transform: translateY(-1px);
}
```

### 5.2 Checkout Flow

After package selection, slide-up checkout panel:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  CHECKOUT PANEL (slide from bottom on mobile, modal on desktop)        │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                                                                   │ │
│  │  Augimas · €3,500 /6 mėnesius                                    │ │
│  │  20 raktažodžių · 200 straipsnių                                 │ │
│  │                                                                   │ │
│  │  ──────────────────────────────────────────────────────────────── │ │
│  │                                                                   │ │
│  │  Mokėjimo planas:                                                │ │
│  │                                                                   │ │
│  │  ○ Pilna suma (€3,500)                                           │ │
│  │  ● Dvi dalys (€1,750 × 2)                                        │ │
│  │  ○ Trys dalys (€1,167 × 3)                                       │ │
│  │                                                                   │ │
│  │  ──────────────────────────────────────────────────────────────── │ │
│  │                                                                   │ │
│  │  ☑ Sutinku su paslaugų teikimo sąlygomis                        │ │
│  │                                                                   │ │
│  │  ┌───────────────────────────────────────────────────────────┐   │ │
│  │  │                                                           │   │ │
│  │  │            [ Mokėti su Stripe ]                           │   │ │
│  │  │                                                           │   │ │
│  │  │            🔒 Saugus mokėjimas                             │   │ │
│  │  │                                                           │   │ │
│  │  └───────────────────────────────────────────────────────────┘   │ │
│  │                                                                   │ │
│  │  Arba: [ Susisiekti su mumis ]                                   │ │
│  │                                                                   │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.3 "Talk to Agency" Fallback

For prospects who want to discuss before paying:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  Turite klausimų?                                                       │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                                                                   │ │
│  │  [ Užsisakyti pokalbį ]    Arba rašykite: hello@agency.lt        │ │
│  │                                                                   │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

Clicking "Užsisakyti pokalbį" opens Calendly/Cal.com embed or link.

### 5.4 Expiration Urgency

Subtle but clear:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  ⏰ Šis pasiūlymas galioja dar 12 dienų                                 │
│     Iki: 2026 m. gegužės 24 d.                                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Visual treatment:**
- Amber warning color when < 7 days
- Red when < 3 days
- No fake countdown timers (trust issue)

---

## 6. Mobile Experience

### 6.1 Mobile Layout Principles

**Prospects often open from Facebook DMs on phone.** Design mobile-first:

1. **Single column** — No side-by-side content
2. **Thumb-friendly** — All CTAs in thumb zone (bottom 40% of screen)
3. **Collapsible sections** — Long content hidden behind expandable headers
4. **Sticky CTA** — Package selection sticks to bottom of viewport

### 6.2 Mobile Wireframe

```
┌─────────────────────┐
│ [Logo]     [12d] ⏰ │  ← Header
├─────────────────────┤
│                     │
│  Jūsų SEO galimybė  │
│  meistreliokampas.lt│
│                     │
│  ┌───────────────┐  │
│  │   €2,400      │  │  ← Value hero
│  │  /mėn. vertė  │  │
│  └───────────────┘  │
│                     │
│  ┌───────────────┐  │
│  │ ✓ Garantija   │  │  ← Trust strip
│  │ 🔒 Saugus     │  │
│  └───────────────┘  │
│                     │
├─────────────────────┤
│                     │
│  ▼ Topinis žemėlapis│  ← Collapsed sections
│  ▼ Konkurentų analizė│
│  ▼ Ką gausite       │
│                     │
├─────────────────────┤
│                     │
│  ┌───────────────┐  │
│  │   PAMATAS     │  │
│  │   €2,500      │  │  ← Stacked packages
│  │  [Pasirinkti] │  │     (horizontal scroll
│  └───────────────┘  │      or cards stack)
│                     │
│  ┌───────────────┐  │
│  │   AUGIMAS ⭐  │  │
│  │   €3,500      │  │
│  │  [Pasirinkti] │  │
│  └───────────────┘  │
│                     │
├─────────────────────┤
│ ┌─────────────────┐ │
│ │ [Tęsti mokėjimą]│ │  ← Sticky CTA
│ └─────────────────┘ │
└─────────────────────┘
```

### 6.3 Mobile-Specific Patterns

**Collapsible sections:**
```typescript
<Collapsible>
  <CollapsibleTrigger>
    ▼ Topinis žemėlapis (47 raktažodžiai)
  </CollapsibleTrigger>
  <CollapsibleContent>
    {/* Full topical map */}
  </CollapsibleContent>
</Collapsible>
```

**Sticky bottom CTA:**
```css
.sticky-cta {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px;
  background: rgba(250, 250, 247, 0.95);
  backdrop-filter: saturate(140%) blur(10px);
  border-top: 1px solid var(--hairline);
  z-index: 50;
}
```

**Horizontal package scroll (alternative to stacked):**
```css
.packages-mobile {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  padding: 16px;
  gap: 16px;
}
.package-card-mobile {
  flex: 0 0 280px;
  scroll-snap-align: center;
}
```

### 6.4 Touch Targets

WCAG minimum: 44x44px touch targets.

```css
.btn-mobile {
  min-height: 48px;
  min-width: 48px;
  padding: 12px 24px;
}
```

---

## 7. Post-Accept Flow

### 7.1 Payment Success Screen

Immediately after Stripe payment:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                              ✓                                          │
│                                                                         │
│                   Mokėjimas sėkmingas!                                  │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  Sveikiname, meistreliokampas.lt! Jūs esate mūsų klientas.             │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                                                                   │ │
│  │  Kas vyksta toliau:                                              │ │
│  │                                                                   │ │
│  │  1. ✓ Gavote patvirtinimo el. laišką                             │ │
│  │  2. → Per 24 val. gausite prieigą prie kliento portalo           │ │
│  │  3. → Per 48 val. susisieksime dėl įvadinio pokalbio             │ │
│  │                                                                   │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                                                                   │ │
│  │            [ Užsisakyti įvadinį pokalbį dabar ]                   │ │
│  │                                                                   │ │
│  │            Arba laukite mūsų žinutės per 48 val.                 │ │
│  │                                                                   │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  Turite klausimų? hello@agency.lt · +370 600 00000                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Onboarding Steps Preview

Show what to expect (reduces post-purchase anxiety):

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  Jūsų onboarding'o kelias                                               │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│     Šiandien          1 savaitė          2 savaitės         1 mėnuo    │
│        │                  │                  │                  │       │
│        ▼                  ▼                  ▼                  ▼       │
│  ┌──────────┐       ┌──────────┐       ┌──────────┐       ┌──────────┐│
│  │ Įvadinis │       │ Balso    │       │ Raktaž.  │       │ Pirma    ││
│  │ pokalbis │──────▶│ workshop │──────▶│ tvirtinimas──────▶│ ataskaita││
│  │ 60 min   │       │ 60 min   │       │ 30 min   │       │          ││
│  └──────────┘       └──────────┘       └──────────┘       └──────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Calendar Booking Integration

Embed Cal.com or Calendly for immediate booking:

```typescript
// Option A: Cal.com embed
<Cal
  calLink="tevero/intro-call"
  config={{
    name: prospect.name,
    email: prospect.email,
    notes: `Domain: ${prospect.domain}`,
  }}
/>

// Option B: Link to Calendly
<a href={`https://calendly.com/tevero/intro?name=${encodeURIComponent(prospect.name)}`}>
  Užsisakyti įvadinį pokalbį
</a>
```

---

## 8. Trust-Building Elements

### 8.1 "This is YOUR Data" Visualization

Make it crystal clear this isn't a generic template:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ 🔍 Šie duomenys surinkti iš meistreliokampas.lt                  │ │
│  │    Analizuota: 2026-05-10 14:23                                  │ │
│  │    Puslapiai nuskaityti: 2,400                                   │ │
│  │    Raktažodžiai rasti: 47                                        │ │
│  │    Konkurentai identifikuoti: 3                                  │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Privacy/GDPR Assurance

Small but visible:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  🔒 Jūsų duomenys saugūs                                                │
│     Naudojame tik viešai prieinamus duomenis. Niekada nesidalinsime    │
│     su trečiosiomis šalimis. Duomenų apsaugos politika →               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.3 Money-Back Guarantee Display

Three-layer reinforcement:

**Layer 1 (Trust strip):**
```
[ ✓ 100% Pinigų grąžinimo garantija ]
```

**Layer 2 (Full card):**
```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  🛡️  Nulis rizikos jums                                                 │
│                                                                         │
│  Garantuojame rezultatus RAŠTU:                                         │
│                                                                         │
│  • Pamatas: 10 raktažodžių TOP 10 per 6 mėn.                           │
│  • Augimas: 20 raktažodžių TOP 10 per 6 mėn.                           │
│  • Autoritetas: 40 raktažodžių TOP 10 per 6 mėn.                       │
│                                                                         │
│  Nepasiektėme? Grąžiname 100% be klausimų.                             │
│                                                                         │
│  ──────────────────────────────────────────────────────────────────────│
│                                                                         │
│  "Mūsų verslo modelis veikia tik jei tu sėkmingas."                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Layer 3 (Checkout reminder):**
```
☑ Sutinku su sąlygomis (įskaitant pinigų grąžinimo garantiją)
```

### 8.4 Case Study / Testimonial Placement

**CRITICAL:** Lithuanian market lacks case studies. Acknowledge this honestly:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  Kodėl garantija, ne case studies?                                      │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  "Sąžiningai — dar neturime Lietuviškų case studies. Bet turime        │
│   kažką svarbesnio: garantiją raštu.                                   │
│                                                                         │
│   Kitos agentūros turi case studies, bet garantijų nedavė.             │
│   Mes turime garantiją, nes pasitikime savo metodais.                  │
│                                                                         │
│   Kas tau svarbiau — praeities pavyzdžiai ar ateities užtikrinimas?"   │
│                                                                         │
│                                                  — Dominic, TeveroSEO  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.5 The "8-Client Limit" Scarcity

Real scarcity (not fake countdown):

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  ⚠️ Ribota vieta                                                        │
│                                                                         │
│  Dirbame su maksimum 8 klientais vienu metu.                           │
│  Vienas klientas vienai nišai vienam regionui.                         │
│                                                                         │
│  Šiuo metu laisvos: 3 vietos                                           │
│                                                                         │
│  [ Rezervuoti vietą → ]                                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Component Specifications

### 9.1 New Components Required

| Component | Purpose | Priority |
|-----------|---------|----------|
| `ProposalHero` | Above-fold hero with value, domain, trust | P0 |
| `TopicalMapViewer` | Interactive keyword cluster visualization | P0 |
| `PackageSelector` | Three-tier package selection cards | P0 |
| `CheckoutPanel` | Slide-up checkout with Stripe | P0 |
| `GuaranteeCard` | Full money-back guarantee display | P1 |
| `CompetitorComparison` | Anonymized competitor bars | P1 |
| `TimelineVisualization` | 6-month journey timeline | P1 |
| `ValueAnchorTable` | Full value vs your price | P1 |
| `MobileCollapser` | Collapsible sections for mobile | P1 |
| `StickyMobileCTA` | Fixed bottom CTA bar | P1 |
| `PostPaymentSuccess` | Success screen with onboarding | P2 |
| `CalendarBooking` | Cal.com/Calendly embed | P2 |

### 9.2 Existing Components to Reuse

From current codebase:
- `ProposalView` — Extend with new sections
- `ServicesSection` — Package display (needs redesign)
- `AcceptRejectButtons` — Payment CTAs (needs redesign)

### 9.3 v6 Token Usage

All new components MUST use v6 design tokens:

```css
/* Typography */
font-family: var(--font-display);  /* Newsreader for headlines */
font-family: var(--font-sans);     /* Geist for body */
font-size: var(--num-mega);        /* Hero value number */

/* Spacing */
padding: var(--space-6);           /* Card interior */
gap: var(--space-4);               /* Grid gaps */

/* Colors */
background: var(--surface);        /* Card backgrounds */
color: var(--text-1);              /* Primary text */
color: var(--accent);              /* CTAs, highlights */

/* Shadows */
box-shadow: var(--shadow-card);    /* Cards at rest */
box-shadow: var(--shadow-lift);    /* Cards on hover */
box-shadow: var(--shadow-cta);     /* Primary buttons */

/* Motion */
transition: var(--motion-hover);   /* Card interactions */
```

---

## 10. Implementation Checklist

### Phase 1: Core Structure (Week 1)

- [ ] Create `ProposalHero` component with personalization
- [ ] Implement agency branding system (`brandConfig`)
- [ ] Add trust strip (guarantee, secure payment, client limit)
- [ ] Build `PackageSelector` with three-tier layout
- [ ] Implement v6 card styling for packages
- [ ] Add "Popular" highlight treatment

### Phase 2: Value Communication (Week 2)

- [ ] Build `TopicalMapViewer` with expandable clusters
- [ ] Create `CompetitorComparison` (anonymized)
- [ ] Add `TimelineVisualization` for 6-month journey
- [ ] Build `ValueAnchorTable` for price justification
- [ ] Implement expandable "What's included" sections

### Phase 3: Mobile Optimization (Week 3)

- [ ] Create `MobileCollapser` for sections
- [ ] Build `StickyMobileCTA` component
- [ ] Implement horizontal package scroll
- [ ] Test touch targets (44x44px minimum)
- [ ] Verify thumb-zone CTA placement

### Phase 4: Checkout & Post-Accept (Week 4)

- [ ] Build `CheckoutPanel` slide-up modal
- [ ] Integrate Stripe payment
- [ ] Add payment plan selection (2-3 installments)
- [ ] Create `PostPaymentSuccess` screen
- [ ] Integrate Cal.com/Calendly booking

### Phase 5: Trust Elements (Week 5)

- [ ] Build `GuaranteeCard` with full messaging
- [ ] Add "This is YOUR data" provenance display
- [ ] Implement GDPR/privacy assurance
- [ ] Add "8-client limit" scarcity message
- [ ] Create "Why guarantee not case studies" section

### Phase 6: Polish & Testing (Week 6)

- [ ] E2E test full conversion flow
- [ ] Test on iPhone (Safari), Android (Chrome)
- [ ] Verify Stripe test payments
- [ ] Check expiration handling
- [ ] Add view tracking analytics
- [ ] Document all components

---

## Appendix: ASCII Wireframe — Full Desktop View

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ [Agency Logo]                                                        [Galioja: 12 d.] │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│                              Jūsų SEO galimybė                                          │
│                              meistreliokampas.lt                                        │
│                                                                                         │
│              ┌─────────────────────────────────────────────────────────┐                │
│              │                                                         │                │
│              │                    €2,400                               │                │
│              │                  /mėn. vertės galimybė                  │                │
│              │                                                         │                │
│              │      ┌────────┐   ┌────────┐   ┌────────┐              │                │
│              │      │   47   │   │ 2,440  │   │   28   │              │                │
│              │      │rakta-  │   │paieškų │   │vidutinis│              │                │
│              │      │žodžių  │   │ /mėn   │   │  KD    │              │                │
│              │      └────────┘   └────────┘   └────────┘              │                │
│              │                                                         │                │
│              └─────────────────────────────────────────────────────────┘                │
│                                                                                         │
│          [ ✓ Garantija ]   [ 🔒 Saugus ]   [ 8 klientų limitas ]                       │
│                                                                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  JŪSŲ TOPINIS ŽEMĖLAPIS                                                                │
│  ────────────────────────────────────────────────────────────────────────────────────  │
│  ├─ Makita dalys (pillar)                    KD 28 │ 850/mėn.                          │
│  │   ├─ makita akumuliatorius                KD 18 │ 320/mėn.   ✓ Q1                  │
│  │   └─ [+12 more]                                                                      │
│  ├─ Dewalt dalys (pillar)                    KD 22 │ 420/mėn.                          │
│  └─ Įrankių remontas (pillar)                KD 32 │ 650/mėn.                          │
│                                                                                         │
│  [ Peržiūrėti visus 47 raktažodžius ]                                                  │
│                                                                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  JŪS VS KONKURENTAI                                                                    │
│  ────────────────────────────────────────────────────────────────────────────────────  │
│                              Jūs       Konk. A      Konk. B                            │
│  Puslapiai                    45          180          120                              │
│  Raktažodžiai                 12           85           62                              │
│  [█████░░░░░░░]           [██████████░░]  [████████░░░░]                               │
│                                                                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  PASIRINKITE PLANĄ                                                                     │
│  ────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                         │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐                │
│  │                    │  │ ⭐ POPULIARIAUSIAS │  │                    │                │
│  │     PAMATAS        │  │                    │  │    AUTORITETAS     │                │
│  │                    │  │     AUGIMAS        │  │                    │                │
│  │    €2,500          │  │                    │  │    €7,100          │                │
│  │   /6 mėnesius      │  │    €3,500          │  │   /6 mėnesius      │                │
│  │                    │  │   /6 mėnesius      │  │                    │                │
│  │  10 raktažodžių    │  │                    │  │  40 raktažodžių    │                │
│  │  100 straipsnių    │  │  20 raktažodžių    │  │  400 straipsnių    │                │
│  │                    │  │  200 straipsnių    │  │                    │                │
│  │  [ Pasirinkti ]    │  │                    │  │  [ Pasirinkti ]    │                │
│  │                    │  │  [ Pasirinkti ]    │  │                    │                │
│  └────────────────────┘  │                    │  └────────────────────┘                │
│                          └────────────────────┘                                        │
│                                                                                         │
│  Visos kainos be PVM · Mokėjimo planas galimas (2-3 dalys, be pabrangimo)             │
│                                                                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  🛡️ 100% PINIGŲ GRĄŽINIMO GARANTIJA                                                    │
│  ────────────────────────────────────────────────────────────────────────────────────  │
│  Garantuojame 10/20/40 raktažodžių iškėlimą į pirmą Google puslapį per 6 mėnesius     │
│  arba grąžiname visus pinigus iki cento. Nulis rizikos jums.                          │
│                                                                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  Turite klausimų? [ Užsisakyti pokalbį ] · hello@agency.lt                             │
│                                                                                         │
│  ────────────────────────────────────────────────────────────────────────────────────  │
│  ⏰ Galioja iki: 2026 m. gegužės 24 d.                                                  │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Appendix: ASCII Wireframe — Mobile View

```
┌─────────────────────┐
│ [Logo]     [12d] ⏰ │
├─────────────────────┤
│                     │
│  Jūsų SEO galimybė  │
│  meistreliokampas.lt│
│                     │
│  ┌───────────────┐  │
│  │   €2,400      │  │
│  │  /mėn. vertė  │  │
│  └───────────────┘  │
│                     │
│  47 raktažodžių     │
│  2,440 paieškų/mėn. │
│                     │
│  ┌───────────────┐  │
│  │ ✓ Garantija   │  │
│  │ 🔒 Saugus     │  │
│  │ 8 klientų max │  │
│  └───────────────┘  │
│                     │
├─────────────────────┤
│                     │
│  ▼ Topinis žemėlapis│
│  ▼ Konkurentų analizė│
│  ▼ Ką gausite       │
│                     │
├─────────────────────┤
│                     │
│  PASIRINKITE PLANĄ  │
│                     │
│  ┌───────────────┐  │
│  │   PAMATAS     │  │
│  │   €2,500      │  │
│  │  10 raktaž.   │  │
│  │  [Pasirinkti] │  │
│  └───────────────┘  │
│                     │
│  ┌───────────────┐  │
│  │ ⭐ AUGIMAS    │  │
│  │   €3,500      │  │
│  │  20 raktaž.   │  │
│  │  [Pasirinkti] │  │
│  └───────────────┘  │
│                     │
│  ┌───────────────┐  │
│  │  AUTORITETAS  │  │
│  │   €7,100      │  │
│  │  40 raktaž.   │  │
│  │  [Pasirinkti] │  │
│  └───────────────┘  │
│                     │
├─────────────────────┤
│  ▼ Garantija        │
├─────────────────────┤
│                     │
│  Turite klausimų?   │
│  [ Pokalbis ]       │
│  hello@agency.lt    │
│                     │
├─────────────────────┤
│ ⏰ Iki: gegužės 24d │
└─────────────────────┘
     ↑
┌─────────────────────┐
│ ┌─────────────────┐ │
│ │ [Tęsti mokėjimą]│ │  ← Sticky CTA
│ └─────────────────┘ │
└─────────────────────┘
```

---

*End of Prospect Portal Design Specification*
