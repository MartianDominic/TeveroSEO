/**
 * AnimatedCounter component
 * Phase 30: Interactive Proposal Page
 *
 * Animated count-up number that triggers when scrolled into view.
 * Uses framer-motion for smooth animations.
 */

import { useEffect, useRef, useState } from "react";
import { useInView, motion } from "framer-motion";

interface AnimatedCounterProps {
  /** Target value to count up to */
  value: number;
  /** Prefix before the number (e.g., "$" or "EUR ") */
  prefix?: string;
  /** Suffix after the number (e.g., "%" or "/mėn.") */
  suffix?: string;
  /** Animation duration in milliseconds */
  duration?: number;
  /** Number of decimal places to show */
  decimals?: number;
  /** Additional CSS class */
  className?: string;
  /** Format number with thousand separators */
  formatNumber?: boolean;
  /** Locale for number formatting */
  locale?: string;
}

/**
 * Easing function: easeOutCubic
 * Starts fast and slows down toward the end.
 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Renders an animated counter that counts up from 0 to the target value.
 * Animation triggers when the element scrolls into view.
 */
export function AnimatedCounter({
  value,
  prefix = "",
  suffix = "",
  duration = 2000,
  decimals = 0,
  className = "",
  formatNumber = true,
  locale = "lt-LT",
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [displayValue, setDisplayValue] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (!isInView || hasAnimated) return;

    setHasAnimated(true);
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);

      const currentValue = value * easedProgress;
      setDisplayValue(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Ensure we end exactly on the target value
        setDisplayValue(value);
      }
    };

    requestAnimationFrame(animate);
  }, [isInView, value, duration, hasAnimated]);

  // Format the display value
  const formattedValue = formatNumber
    ? displayValue.toLocaleString(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : decimals > 0
      ? displayValue.toFixed(decimals)
      : Math.floor(displayValue).toString();

  return (
    <motion.span
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {prefix}
      {formattedValue}
      {suffix}
    </motion.span>
  );
}
