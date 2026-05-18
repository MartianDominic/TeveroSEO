# World-Class Proposal Design Plan

> **Goal**: Transform the SEO agency proposal into a $100M-software-quality document that feels like Stripe × Linear × editorial magazine.

## Design Philosophy

### Core Principles
1. **One editorial moment per scroll** - Each section has ONE thing the eye goes to
2. **White space is the premium** - Generous margins separate us from "AI template"
3. **Type that breathes** - Large sizes, perfect line height, comfortable reading
4. **Mobile-first, 27" perfect** - Works on any screen without compromise
5. **Direct, not desperate** - Lithuanian skepticism respected, no hype

### Copy Philosophy (Kern + Kennedy + Hormozi)
- **Frank Kern**: Conversational, pattern-based, story-driven
- **Dan Kennedy**: Specificity, risk reversal, scarcity (but honest)
- **Alex Hormozi**: Value equation visible (Dream outcome × Likelihood ÷ Time × Effort)
- **Lithuanian overlay**: Direct, no fluff, prove everything

---

## Typography System

### Font Stack
```css
--font-display: 'Instrument Serif', Georgia, serif
--font-body: 'Outfit', system-ui, sans-serif
```

**Why Instrument Serif:**
- Editorial gravitas
- Google Fonts (free, fast CDN)
- Full Lithuanian character support (ą, č, ę, ė, į, š, ų, ū, ž)
- Optical sizing for headlines

**Why Outfit:**
- Modern geometric sans
- Clean, professional, European feel
- Excellent for Lithuanian text
- Variable weight support

### Type Scale (fluid)
```css
--text-xs:    clamp(12px, 0.8vw, 13px)     /* Kickers, labels */
--text-sm:    clamp(14px, 1vw, 15px)       /* Meta, captions */
--text-base:  clamp(16px, 1.15vw, 18px)    /* Body copy */
--text-lg:    clamp(18px, 1.4vw, 22px)     /* Lead paragraphs */
--text-xl:    clamp(22px, 2vw, 28px)       /* Card titles */
--text-2xl:   clamp(28px, 2.8vw, 38px)     /* Section headings */
--text-3xl:   clamp(36px, 4vw, 56px)       /* Hero headline */
--text-4xl:   clamp(48px, 5.5vw, 80px)     /* Mega display */
```

### Line Heights
```
Headlines (3xl+): 1.1
Section heads (2xl): 1.2
Card titles (xl): 1.25
Lead paragraphs (lg): 1.5
Body (base): 1.65
Small text: 1.4
```

### Letter Spacing
```
Display (3xl+): -0.025em
Headings: -0.015em
Body: -0.005em
Kickers (uppercase): +0.12em
```

---

## Color Palette

### Light Mode (Primary)
```css
/* Canvas */
--canvas:       #fafaf7    /* Warm white background */
--surface:      #ffffff    /* Cards, elevated */
--surface-2:    #f5f4ef    /* Hover, secondary surfaces */

/* Ink (text) */
--ink:          #18181b    /* Primary text */
--ink-2:        #52525b    /* Secondary text */
--ink-3:        #a1a1aa    /* Tertiary, disabled */

/* Accent - refined gold/bronze */
--accent:       #92713c    /* Primary accent */
--accent-dark:  #6d5429    /* Darker for hover */
--accent-light: #f5f0e6    /* Soft tint backgrounds */

/* Semantic */
--success:      #16a34a
--success-soft: #f0fdf4
--error:        #dc2626
--error-soft:   #fef2f2

/* Structure */
--line:         #e4e4e7    /* Borders */
--line-2:       #f0f0f0    /* Subtle dividers */
```

### The Guarantee Section (Dark)
```css
--dark-bg:      #18181b
--dark-surface: #27272a
--dark-text:    #fafafa
--dark-muted:   #a1a1aa
```

---

## Spacing System

```css
--space-1:  4px
--space-2:  8px
--space-3:  12px
--space-4:  16px
--space-5:  24px
--space-6:  32px
--space-7:  48px
--space-8:  64px
--space-9:  96px
--space-10: 128px
--space-11: 160px

/* Fluid versions */
--section-gap: clamp(80px, 10vw, 160px)    /* Between major sections */
--block-gap:   clamp(40px, 5vw, 64px)      /* Between related blocks */
--card-pad:    clamp(24px, 4vw, 48px)      /* Card internal padding */
--container:   clamp(320px, 90vw, 1200px)  /* Content max-width */
--text-col:    clamp(320px, 85vw, 720px)   /* Text column max-width */
```

---

## Responsive Breakpoints

```css
/* Mobile first base: 0-767px */
/* Everything single column, large touch targets */

/* Tablet: 768px+ */
@media (min-width: 768px) {
  /* 2-column grids where appropriate */
  /* Pricing cards in 2-col */
}

/* Laptop with Chrome UI: 1100px+ */
/* Account for ~100px browser chrome eating viewport */
@media (min-width: 1100px) {
  /* 3-column pricing */
  /* Full width hero */
}

/* Desktop: 1440px+ */
@media (min-width: 1440px) {
  /* Maximum comfortable reading */
  /* Generous margins */
}

/* Large: 2560px+ */
@media (min-width: 2560px) {
  /* Center container */
  /* Don't stretch content infinitely */
}
```

---

## Page Structure

### 1. HERO SECTION
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    TEVERO SEO PASLAUGOS                     │
│                         (kicker)                            │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                                                     │   │
│   │      Iškelsime Tavo Svetainę Į Google TOP 10.       │   │
│   │      Jei Nepavyks - Grąžinsime Pinigus.             │   │
│   │                                                     │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   Short subhead (2-3 sentences, not a wall of text)         │
│                                                             │
│   [Skambinti dabar]     [Peržiūrėti kainas]                │
│        (primary)            (secondary)                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Copy transformation:**
- Current: Long paragraph explaining everything
- New: 2-3 punchy sentences that create curiosity

### 2. THE DIFFERENCE (not "why we're different")
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   Čia nėra "individualaus požiūrio" ar "ilgametės patirties"│
│                                                             │
│   Sutartyje rašome: bent X raktažodžių į TOP 10 per 6 mėn.  │
│   Nepasiekiam? Grąžinam pinigus. Visus.                     │
│                                                             │
│   • Konkretūs skaičiai sutartyje                            │
│   • Realūs GSC duomenys ataskaitose                         │
│   • 100% pinigų grąžinimas jei neįvykdome                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3. KAM PADEDAME (3 cards)
```
┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐
│                   │  │                   │  │                   │
│   Paslaugų        │  │   El.              │  │   SEO             │
│   Verslams        │  │   Parduotuvėms     │  │   Gelbėjimas      │
│                   │  │                   │  │                   │
│   [icon/visual]   │  │   [icon/visual]   │  │   [icon/visual]   │
│                   │  │                   │  │                   │
│   3-4 short       │  │   3-4 short       │  │   3-4 short       │
│   sentences       │  │   sentences       │  │   sentences       │
│                   │  │                   │  │                   │
└───────────────────┘  └───────────────────┘  └───────────────────┘
```

### 4. KAM NEPADĖSIME (builds trust via disqualification)
```
Trumpas intro + bullet list

• Neįmanomi lūkesčiai (TOP 1 už "kreditas" per 3 mėn.)
• Google bausmė (Manual Penalty)
• Mikrovadybininkai
• Nekokybiškas produktas
```

### 5. KAINOS (3 tier cards)
```
┌───────────────────┐  ┌─────────────────────┐  ┌───────────────────┐
│                   │  │   POPULIARIAUSIAS   │  │                   │
│   STARTO SEO      │  │   ─────────────────  │  │   PREMIUM SEO     │
│                   │  │   AUGIMO SEO        │  │                   │
│   nuo 2,500 €     │  │                     │  │   nuo 7,500 €     │
│   per 6 mėn.      │  │   nuo 4,400 €       │  │   per 6 mėn.      │
│                   │  │   per 6 mėn.        │  │                   │
│   ✓ 40-50 raktaž. │  │                     │  │   ✓ 160-200 rakt. │
│   ✓ 10+ TOP 10    │  │   ✓ 80-100 raktaž.  │  │   ✓ 40+ TOP 10    │
│   ✓ 30 puslapių   │  │   ✓ 20+ TOP 10      │  │   ✓ 150 puslapių  │
│   ✓ 10 straipsnių │  │   ✓ 70 puslapių     │  │   ✓ 40 straipsnių │
│                   │  │   ✓ 20 straipsnių   │  │   ✓ Savaitinės    │
│   [Aptarti]       │  │                     │  │     konsultacijos │
│                   │  │   [Pasirinkti]      │  │                   │
│                   │  │                     │  │   [Aptarti]       │
└───────────────────┘  └─────────────────────┘  └───────────────────┘

Payment terms note below
```

### 6. GARANTIJA (dark section)
```
┌─────────────────────────────────────────────────────────────┐
│█████████████████████████████████████████████████████████████│
│                                                             │
│          GARANTIJA RAŠTU. JOKIŲ ŽVAIGŽDUČIŲ.                │
│                                                             │
│   Per 6 mėnesius:                                           │
│   • Starto: bent 10 raktažodžių TOP 10                      │
│   • Augimo: bent 20 raktažodžių TOP 10                      │
│   • Premium: bent 40 raktažodžių TOP 10                     │
│                                                             │
│   Nepasiekėm? +90 dienų nemokamai.                          │
│   Vis dar ne? 100% pinigų grąžinimas per 30 dienų.          │
│                                                             │
│█████████████████████████████████████████████████████████████│
└─────────────────────────────────────────────────────────────┘
```

### 7. PROCESAS (6 phase timeline)
```
Visual timeline: vertical on mobile, horizontal on desktop

I ─────── II ─────── III ─────── IV ─────── V ─────── VI
Auditas   Raktaž.    Techninė    Turinys    Nuorodos  Ataskaitos
```

Each phase: title + 2-3 sentences max

### 8. FINAL CTA
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                     Pasišnekam?                             │
│                                                             │
│   30 minučių. Nemokamas pokalbis. Jokio spaudimo.           │
│                                                             │
│   +370 683 64665                                            │
│   pijus@tevero.lt                                           │
│                                                             │
│   [Skambinti dabar]                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Footer: Company info, address, registry
```

---

## Visual Elements

### Cards
- No hard borders (use subtle shadow)
- Generous padding (48px desktop, 24px mobile)
- Subtle hover lift (transform + shadow expansion)
- Border-radius: 16px

### Shadows
```css
--shadow-card: 
  0 1px 2px rgba(0,0,0,0.04),
  0 4px 12px rgba(0,0,0,0.03);

--shadow-lift:
  0 4px 8px rgba(0,0,0,0.04),
  0 12px 32px rgba(0,0,0,0.06);
```

### Buttons
```css
/* Primary */
background: var(--ink);
color: white;
padding: 16px 32px;
border-radius: 8px;
font-weight: 500;

/* Secondary */
background: transparent;
border: 1.5px solid var(--line);
color: var(--ink);
```

### Timeline Visual
- Vertical line connecting phases
- Numbered circles (or icons)
- Color accent on current/hover

---

## Copy Transformation Rules

### Remove Em Dashes
```
Before: "Tai yra X — Y ir Z — todėl..."
After:  "Tai yra X. Y ir Z. Todėl..."
```

### Break Paragraphs
```
Before: Long 8-line paragraph
After:  3 separate 2-3 line paragraphs
```

### Add Specifics
```
Before: "Daugiau turinio"
After:  "10 SEO straipsnių į pigiausią planą"
```

### Lithuanian Directness
```
Keep: "Jei manai, kad tai per gerai - esi teisus, kad abejoji."
Keep: "Jei atpažinai save - neskambink."
```

---

## Implementation Order

1. **Base HTML structure** with semantic sections
2. **CSS custom properties** (colors, typography, spacing)
3. **Mobile base styles** (375px+)
4. **Hero section** perfected
5. **Cards component** (used in multiple places)
6. **Pricing grid** 
7. **Dark guarantee section**
8. **Process timeline**
9. **Responsive breakpoints** (768, 1100, 1440, 2560)
10. **Micro-interactions** (hover states, transitions)
11. **Copy refinement** pass
12. **Final polish** (print styles, accessibility)

---

## Success Criteria

- [ ] Page loads in <1.5s on 4G
- [ ] Perfect lighthouse accessibility score
- [ ] Looks premium on 375px mobile
- [ ] Looks premium on 27" 4K display
- [ ] No em dashes in copy
- [ ] Every paragraph is 1-3 sentences
- [ ] Clear visual hierarchy at every section
- [ ] CTAs stand out without screaming
- [ ] Feels like Stripe/Linear, not "agency template"
