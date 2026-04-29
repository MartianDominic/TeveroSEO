"use client";

import * as React from "react";
import { cn } from "../lib/utils";

/**
 * Common props for typography primitives
 */
export interface TypographyProps {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}

/**
 * PageTitle - Newsreader serif, display heading size
 * Uses: --type-h1, letter-spacing -0.024em
 */
export function PageTitle({
  children,
  className,
  as: Component = "h1",
}: TypographyProps) {
  return (
    <Component
      className={cn(
        "font-display text-[length:var(--type-h1)]",
        "font-normal leading-[1.05]",
        "tracking-[-0.024em] text-text-1",
        className
      )}
    >
      {children}
    </Component>
  );
}

PageTitle.displayName = "PageTitle";

/**
 * SectionTitle - Geist sans, section heading size
 * Uses: --type-h2, font-weight 500
 */
export function SectionTitle({
  children,
  className,
  as: Component = "h2",
}: TypographyProps) {
  return (
    <Component
      className={cn(
        "font-sans text-[length:var(--type-h2)]",
        "font-medium leading-[1.3]",
        "tracking-[-0.005em] text-text-1",
        className
      )}
    >
      {children}
    </Component>
  );
}

SectionTitle.displayName = "SectionTitle";

/**
 * TypographyCardTitle - Geist sans, card heading size
 * Uses: --type-h3, font-weight 500
 * (Named TypographyCardTitle to avoid conflict with card.tsx CardTitle)
 */
export function TypographyCardTitle({
  children,
  className,
  as: Component = "h3",
}: TypographyProps) {
  return (
    <Component
      className={cn(
        "font-sans text-[length:var(--type-h3)]",
        "font-medium leading-[1.4]",
        "tracking-[-0.008em] text-text-1",
        className
      )}
    >
      {children}
    </Component>
  );
}

TypographyCardTitle.displayName = "TypographyCardTitle";

/**
 * Eyebrow - Small uppercase label
 * Uses: --type-tiny (12px), uppercase, letter-spacing 0.1em
 */
export function Eyebrow({
  children,
  className,
  as: Component = "span",
}: TypographyProps) {
  return (
    <Component
      className={cn(
        "font-sans text-[length:var(--type-tiny)]",
        "font-medium leading-[1.3]",
        "uppercase tracking-[0.1em] text-text-3",
        className
      )}
    >
      {children}
    </Component>
  );
}

Eyebrow.displayName = "Eyebrow";

/**
 * SmallCaps - Text using font-variant-caps: all-small-caps
 * Uses: --type-tiny (12px), letter-spacing 0.04-0.06em
 */
export function SmallCaps({
  children,
  className,
  as: Component = "span",
}: TypographyProps) {
  return (
    <Component
      className={cn(
        "font-sans text-[length:var(--type-tiny)]",
        "font-medium leading-[1.3]",
        "[font-variant-caps:all-small-caps]",
        "tracking-[0.06em] text-text-2",
        className
      )}
    >
      {children}
    </Component>
  );
}

SmallCaps.displayName = "SmallCaps";

/**
 * Mono - Monospace text for code, timestamps, tabular data
 * Uses: font-mono, tabular-nums lining-nums
 */
export function Mono({
  children,
  className,
  as: Component = "span",
}: TypographyProps) {
  return (
    <Component
      className={cn(
        "font-mono text-text-2",
        "[font-variant-numeric:tabular-nums_lining-nums]",
        className
      )}
    >
      {children}
    </Component>
  );
}

Mono.displayName = "Mono";

/**
 * Body - Standard body text
 * Uses: --type-body
 */
export function Body({
  children,
  className,
  as: Component = "p",
}: TypographyProps) {
  return (
    <Component
      className={cn(
        "font-sans text-[length:var(--type-body)]",
        "font-normal leading-[1.55]",
        "tracking-[-0.005em] text-text-2",
        className
      )}
    >
      {children}
    </Component>
  );
}

Body.displayName = "Body";

/**
 * Caption - Small helper text
 * Uses: --type-small
 */
export function Caption({
  children,
  className,
  as: Component = "span",
}: TypographyProps) {
  return (
    <Component
      className={cn(
        "font-sans text-[length:var(--type-small)]",
        "font-normal leading-[1.45]",
        "text-text-3",
        className
      )}
    >
      {children}
    </Component>
  );
}

Caption.displayName = "Caption";
