/**
 * TeveroSEO Design System v6 TypeScript Tokens
 *
 * TypeScript constants that mirror tokens.css for programmatic access.
 * Import from @tevero/ui for type-safe token usage.
 */

// ===== Color Tokens =====

export const colors = {
  // Canvas & Surface
  canvas: '#FAFAF7',
  canvasDim: '#F5F4EE',
  surface: '#FFFFFF',
  surface2: '#F8F8F3',
  surface3: '#F2F1EB',

  // Hairlines (borders)
  hairline: 'rgba(20, 20, 26, 0.06)',
  hairline2: 'rgba(20, 20, 26, 0.04)',
  hairline3: 'rgba(20, 20, 26, 0.025)',

  // Text ramp
  text1: '#14141A',
  text2: '#54545A',
  text3: '#93939A',
  text4: '#C4C3BB',

  // Accent (emerald)
  accent: '#0F4F3D',
  accent2: '#1A6E55',
  accentSoft: '#EAF1ED',
  accentInk: '#093528',
  accentLine: '#C8DDD4',
  accentTint: '#5F9181',

  // Semantic
  success: '#1B6E45',
  successSoft: '#EAF2EE',
  error: '#9B2C2C',
  errorSoft: '#F4E6E6',
  warning: '#A87F1A',
  warningSoft: '#F4EDDA',
  info: '#2D5A87',
  infoSoft: '#EFF4F9',
} as const;

// ===== Spacing Tokens =====

export const spacing = {
  space1: '4px',
  space2: '8px',
  space3: 'clamp(10px, 0.85vw, 13px)',
  space4: 'clamp(12px, 1.05vw, 16px)',
  space5: 'clamp(16px, 1.4vw, 22px)',
  space6: 'clamp(20px, 1.8vw, 28px)',
  space7: 'clamp(28px, 2.4vw, 38px)',
  space8: 'clamp(36px, 3.4vw, 52px)',
  space9: 'clamp(48px, 4.8vw, 72px)',
} as const;

// ===== Radius Tokens =====

export const radii = {
  input: '6px',
  button: '8px',
  card: '12px',
  modal: '14px',
  pill: '999px',
} as const;

// ===== Shadow Tokens =====

export const shadows = {
  card: `
    0 1px 2px rgba(20, 20, 26, 0.04),
    0 2px 4px rgba(20, 20, 26, 0.02),
    0 0 0 1px rgba(20, 20, 26, 0.025)
  `.trim(),
  lift: `
    0 2px 8px rgba(20, 20, 26, 0.08),
    0 4px 16px rgba(20, 20, 26, 0.04),
    0 0 0 1px rgba(20, 20, 26, 0.04)
  `.trim(),
  pop: `
    0 4px 12px rgba(20, 20, 26, 0.12),
    0 8px 24px rgba(20, 20, 26, 0.08)
  `.trim(),
  cta: `
    0 1px 2px rgba(15, 79, 61, 0.24),
    0 2px 4px rgba(15, 79, 61, 0.12)
  `.trim(),
  ctaHover: `
    0 2px 8px rgba(15, 79, 61, 0.32),
    0 4px 12px rgba(15, 79, 61, 0.16)
  `.trim(),
} as const;

// ===== Typography Tokens =====

export const typography = {
  // Font families
  fontSans: "'Geist', ui-sans-serif, system-ui, sans-serif",
  fontMono: "'Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace",
  fontDisplay: "'Newsreader', Georgia, 'Times New Roman', serif",

  // Type scale
  typeTiny: '12px',
  typeSmall: 'clamp(13px, 0.92vw, 13.5px)',
  typeBody: 'clamp(14px, 1vw, 14.5px)',
  typeH3: 'clamp(15px, 1.1vw, 16px)',
  typeH2: 'clamp(17px, 1.3vw, 18.5px)',
  typeH1: 'clamp(30px, 2.4vw, 40px)',

  // Numeral scale (Newsreader)
  numMega: 'clamp(58px, 4.8vw, 80px)',
  numHero: 'clamp(38px, 3.2vw, 46px)',
  numCard: 'clamp(36px, 3vw, 44px)',
  numRow: 'clamp(20px, 1.7vw, 26px)',
  numTiny: 'clamp(15px, 1.2vw, 18px)',
} as const;

// ===== Motion Tokens =====

export const motion = {
  easeSmooth: 'cubic-bezier(0.16, 1, 0.3, 1)',
  easeQuick: 'cubic-bezier(0.4, 0, 0.2, 1)',
  motionFast: '160ms cubic-bezier(0.4, 0, 0.2, 1)',
  motionHover: '280ms cubic-bezier(0.16, 1, 0.3, 1)',
  motionReveal: '240ms cubic-bezier(0.16, 1, 0.3, 1)',
} as const;

// ===== Shell Tokens =====

export const shell = {
  sidebar: 'clamp(232px, 16vw, 272px)',
  rail: 'clamp(320px, 22vw, 380px)',
  utilityHeight: '56px',
} as const;

// ===== Type Helpers =====

export type ColorToken = keyof typeof colors;
export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radii;
export type ShadowToken = keyof typeof shadows;
export type TypographyToken = keyof typeof typography;
export type MotionToken = keyof typeof motion;
export type ShellToken = keyof typeof shell;

// ===== Token Accessor =====

export const tokens = {
  colors,
  spacing,
  radii,
  shadows,
  typography,
  motion,
  shell,
} as const;

export type Tokens = typeof tokens;
