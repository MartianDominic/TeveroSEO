import React from "react";
import { cn } from "@/lib/utils";

/**
 * TeveroMark — icon-only PNG, white marks on transparent bg.
 * - Dark mode:  white logo shows on dark bg (invert-0)
 * - Light mode: CSS invert flips it to dark marks on light bg (invert)
 *
 * Uses Tailwind: `invert dark:invert-0` on the img tag.
 */
export interface TeveroMarkProps {
  size?: number;
  className?: string;
}

export const TeveroMark: React.FC<TeveroMarkProps> = ({
  size = 28,
  className,
}) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src="/tevero-mark.png"
    alt="TeveroSEO"
    width={size}
    height={size}
    className={cn("invert dark:invert-0", className)}
    style={{ imageRendering: "crisp-edges" }}
    draggable={false}
  />
);

/**
 * TeveroLogo — icon + wordmark PNG, same invert trick.
 */
export interface TeveroLogoProps {
  height?: number;
  className?: string;
}

export const TeveroLogo: React.FC<TeveroLogoProps> = ({
  height = 28,
  className,
}) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src="/tevero-logo.png"
    alt="TeveroSEO"
    height={height}
    style={{ height, width: "auto", imageRendering: "crisp-edges" }}
    className={cn("invert dark:invert-0", className)}
    draggable={false}
  />
);
