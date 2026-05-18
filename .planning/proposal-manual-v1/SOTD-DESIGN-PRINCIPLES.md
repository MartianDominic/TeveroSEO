# SOTD Design Principles

A reusable reference for building Site of the Day-level web experiences. Distilled from Linear, Stripe, Superhuman, and Vercel patterns.

---

## 1. Seven Universal Principles

| # | Principle | What It Means |
|---|-----------|---------------|
| 1 | **Ruthless Restraint** | What's missing matters as much as what's present |
| 2 | **Typography as Architecture** | Type does the heavy lifting, not boxes or colors |
| 3 | **Monochromatic + Single Accent** | 4-5 gray shades + ONE accent color used sparingly but boldly |
| 4 | **Optical Spacing** | Calibrated by eye, not rigid 8px grids |
| 5 | **Depth Through Subtlety** | Shadows almost invisible but create layering |
| 6 | **High Info, Low Visual Density** | Lots of content that feels spacious |
| 7 | **Confidence Through Stillness** | Minimal animation; what moves, matters |

---

## 2. Typography Scale

### CSS Custom Properties

```css
:root {
  /* ===== FONTS ===== */
  --font-display: 'Instrument Serif', Georgia, serif;
  --font-sans: 'Outfit', system-ui, sans-serif;

  /* ===== DISPLAY TYPE (Instrument Serif) ===== */
  --type-display-xl: clamp(48px, 4vw + 32px, 148px);   /* Hero */
  --type-display-lg: clamp(40px, 3vw + 20px, 96px);    /* Section */
  --type-display-md: clamp(36px, 2.2vw + 18px, 72px);  /* Card hero */
  --type-display-sm: clamp(28px, 1.4vw + 14px, 48px);  /* Quotes */

  /* ===== UI TYPE (Outfit) ===== */
  --type-section:    clamp(20px, 0.6vw + 12px, 28px);
  --type-card-title: clamp(17px, 0.35vw + 12px, 22px);
  --type-lead:       clamp(17px, 0.35vw + 12px, 22px);
  --type-body:       clamp(16px, 0.15vw + 14px, 18px);
  --type-small:      clamp(14px, 0.08vw + 12.5px, 15px);
  --type-kicker:     clamp(12px, 0.12vw + 10px, 14px);

  /* ===== DISPLAY NUMERALS ===== */
  --num-mega:  clamp(56px, 5.5vw + 40px, 180px);  /* Hero stat */
  --num-hero:  clamp(44px, 3vw + 24px, 96px);     /* Secondary stat */
  --num-index: clamp(80px, 8vw + 40px, 240px);    /* Section anchors (01, 02) */

  /* ===== LINE HEIGHTS ===== */
  --leading-display-xl: 0.9;
  --leading-display-lg: 0.92;
  --leading-display-md: 0.95;
  --leading-body: 1.6;
  --leading-index: 0.75;

  /* ===== LETTER SPACING ===== */
  --tracking-display-xl: -0.03em;
  --tracking-display-lg: -0.025em;
  --tracking-kicker: 0.12em;
  --tracking-index: -0.04em;
}
```

### At 2560px (27" 4K) - Target Values

| Element | Template Default | SOTD Target |
|---------|-----------------|-------------|
| Hero headline | 72px | **148px** |
| Section headline | 56px | **96px** |
| Mega number | N/A | **180px** |
| Index number (01, 02) | N/A | **240px at 8% opacity** |
| Lead text | 16px | **22px** |
| Container width | 1200px | **1400px** |

### Typography Rules

1. **Headlines should feel "almost too big"** - then they're right
2. **Letter-spacing tightens as size increases** (-0.02em to -0.04em)
3. **Line-height compresses for display** (0.9-1.0, not 1.5)
4. **Uppercase kickers need loose tracking** (0.12em minimum)
5. **12px is the floor** - never go smaller for WCAG

---

## 3. Visual Anchor Patterns

Every scroll-stop needs ONE dominant element the eye locks onto.

| Section Type | Anchor Strategy |
|--------------|-----------------|
| Hero | Massive headline OR oversized number |
| Cards | Large display numbers (01, 02, 03) |
| Lists | Oversized bullets or edge-aligned numbers |
| Pricing | Featured card with glow/gradient |
| Guarantee | Massive "100%" or centered statement |
| Process | Timeline with substantial nodes |

### Section Index Numbers

```css
.section-index {
  font-family: var(--font-display);
  font-size: var(--num-index);
  line-height: 0.75;
  letter-spacing: -0.04em;
  font-weight: 300;
  opacity: 0.08;
  position: absolute;
  top: -20px;
  left: -10px;
  pointer-events: none;
  z-index: 0;
}
```

### Hero Background Accent

```css
.hero-accent {
  position: absolute;
  width: clamp(300px, 40vw, 600px);
  height: clamp(300px, 40vw, 600px);
  background: radial-gradient(circle, rgba(146, 113, 60, 0.1) 0%, transparent 70%);
  border-radius: 50%;
  filter: blur(80px);
  top: -20%;
  right: -10%;
  pointer-events: none;
}
```

---

## 4. Shadow System

Multi-layer shadows create depth without looking heavy.

```css
:root {
  /* Subtle - cards at rest */
  --shadow-sm: 
    0 1px 2px rgba(0, 0, 0, 0.05),
    0 1px 3px rgba(0, 0, 0, 0.05);
  
  /* Medium - cards, dropdowns */
  --shadow-md: 
    0 2px 4px rgba(0, 0, 0, 0.04),
    0 4px 16px rgba(0, 0, 0, 0.06);
  
  /* Large - modals, elevated panels */
  --shadow-lg: 
    0 4px 6px rgba(0, 0, 0, 0.04),
    0 10px 40px rgba(0, 0, 0, 0.08);
  
  /* XL - hero cards, featured content */
  --shadow-xl: 
    0 8px 16px rgba(0, 0, 0, 0.04),
    0 20px 60px rgba(0, 0, 0, 0.1);

  /* Inner highlight - "lit from above" */
  --inner-highlight: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}
```

---

## 5. Motion Guidelines

### Easing Functions

```css
:root {
  --ease-out-expo: cubic-bezier(0.19, 1, 0.22, 1);
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}
```

### Scroll Reveal

```css
.reveal {
  opacity: 0;
  transform: translateY(30px);
  transition: opacity 0.6s var(--ease-out-expo),
              transform 0.6s var(--ease-out-expo);
}

.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}

/* Stagger children */
.reveal-stagger.visible > *:nth-child(1) { transition-delay: 0ms; }
.reveal-stagger.visible > *:nth-child(2) { transition-delay: 60ms; }
.reveal-stagger.visible > *:nth-child(3) { transition-delay: 120ms; }
```

### Card Hover

```css
.card-hover {
  transition: transform 0.3s var(--ease-out-expo), 
              box-shadow 0.3s var(--ease-out);
}

.card-hover:hover {
  transform: translateY(-6px);
  box-shadow: var(--shadow-xl);
}
```

### IntersectionObserver Setup

```javascript
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
```

### Motion Rules

- All transitions: 280-400ms
- No bounce, no shake, no attention-seeking
- Reveals should feel like unveiling, not performing

---

## 6. Button Treatment (Stripe-Inspired)

```css
.btn-primary {
  padding: 16px 32px;
  font-size: var(--type-small);
  font-weight: 500;
  color: white;
  background: var(--ink);
  border: none;
  border-radius: 8px;
  box-shadow: 
    0 1px 2px rgba(0, 0, 0, 0.1),
    0 1px 3px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  transition: all 0.15s ease;
}

.btn-primary:hover {
  background: var(--black);
  transform: translateY(-2px);
  box-shadow: 
    0 4px 8px rgba(0, 0, 0, 0.12),
    0 8px 24px rgba(0, 0, 0, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}
```

---

## 7. Large Screen Strategy

On 2560px displays:

- Container can expand to 1400-1600px (not capped at 1200)
- OR: Text stays narrow (800px) but visuals use full width
- Section padding scales: 160-200px between major sections
- Typography continues scaling via vw units

### Container Classes

```css
.hero-container {
  max-width: 1400px;
  padding-inline: clamp(24px, 4vw, 120px);
}

.content-container {
  max-width: 75ch; /* Body text readability */
  padding-inline: clamp(20px, 3vw, 80px);
}

.stat-container {
  max-width: none; /* Big numbers need breathing room */
  padding-inline: clamp(32px, 5vw, 160px);
}
```

---

## 8. Anti-Patterns to Avoid

| Template Behavior | SOTD Fix |
|-------------------|----------|
| Hero text maxes at 72px | Scale to 148px on 4K |
| Consistent letter-spacing | Tighter (-0.03em) for display |
| line-height 1.5 on headings | Use 0.9-1.1 for display |
| Bold (700) for emphasis | Use medium (500) + size contrast |
| Same size at 1440px and 2560px | Continue vw-based scaling |
| Perfectly centered everything | Intentional asymmetry |
| Content never touches edges | Allow bleeds and overlaps |
| Single-layer box-shadow | Multi-layer with inner highlight |
| Flat backgrounds | Subtle radial gradients |
| Everything same-weight text | ONE visual anchor per section |

---

## 9. Color as Punctuation

- 90% neutral (black, white, grays)
- One accent color used sparingly but boldly
- Dark sections as rhythm breaks (2-3 per page)
- Gradients: subtle on backgrounds, bold on CTAs

---

## 10. Rich Details (Zoom-In Quality)

- **Cards**: Inner highlight `inset 0 1px 0 rgba(255,255,255,0.06)`
- **Buttons**: Gradient fill with inner glow
- **Type**: Enable ligatures, optical kerning
- **Shadows**: Layered (multiple box-shadows)
- **Backgrounds**: Subtle radial gradients or grain (not flat)

---

## Font Loading

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

---

## Verification Checklist

- [ ] **Typography**: Headlines feel "almost too big"
- [ ] **Anchors**: Each section has ONE dominant element
- [ ] **Breakpoints**: Test at 375px, 768px, 1100px, 1440px, 2560px
- [ ] **Motion**: Smooth scroll reveals, no jank
- [ ] **Details**: Zoom in - shadows/gradients look intentional
- [ ] **Comparison**: Side-by-side with Linear.app or Stripe.com
