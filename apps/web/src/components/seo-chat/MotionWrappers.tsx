'use client';

/**
 * Motion Wrapper Components
 * Phase 98-10: Framer Motion animation wrappers for SEO Chat cards
 *
 * Provides:
 * - StaggeredContainer: Parent container with staggered children animations
 * - StaggeredItem: Individual item with slide-in animation
 * - FadeInCard: Card with fade-in animation
 * - SlideInCard: Card with slide-in-from-bottom animation
 */

import { motion, type Variants } from 'framer-motion';
import { type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Animation Variants
// ---------------------------------------------------------------------------

/**
 * Container variant for staggered children.
 */
export const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

/**
 * Item variant for staggered list items.
 * Slides in from left with fade.
 */
export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, x: -8 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
};

/**
 * Fade-in variant for cards.
 */
export const fadeInVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: 0.3, ease: 'easeOut' },
  },
};

/**
 * Slide-in-from-bottom variant for cards.
 */
export const slideInVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: 'easeOut' },
  },
};

// ---------------------------------------------------------------------------
// Component Props
// ---------------------------------------------------------------------------

interface StaggeredContainerProps {
  children: ReactNode;
  className?: string;
}

interface StaggeredItemProps {
  children: ReactNode;
  className?: string;
}

interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/**
 * Container that staggers children animations.
 * Use with StaggeredItem children.
 */
export function StaggeredContainer({ children, className }: StaggeredContainerProps) {
  return (
    <motion.div
      variants={staggerContainerVariants}
      initial="hidden"
      animate="show"
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Item within a StaggeredContainer.
 * Automatically inherits stagger timing from parent.
 */
export function StaggeredItem({ children, className }: StaggeredItemProps) {
  return (
    <motion.div variants={staggerItemVariants} className={className}>
      {children}
    </motion.div>
  );
}

/**
 * Card with fade-in animation.
 */
export function FadeInCard({ children, className, delay = 0 }: AnimatedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut', delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Card with slide-in-from-bottom animation.
 */
export function SlideInCard({ children, className, delay = 0 }: AnimatedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut', delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * List with staggered item animations.
 * Convenience component combining container + items.
 */
export function AnimatedList({
  items,
  renderItem,
  className,
  itemClassName,
}: {
  items: unknown[];
  renderItem: (item: unknown, index: number) => ReactNode;
  className?: string;
  itemClassName?: string;
}) {
  return (
    <StaggeredContainer className={className}>
      {items.map((item, index) => (
        <StaggeredItem key={index} className={itemClassName}>
          {renderItem(item, index)}
        </StaggeredItem>
      ))}
    </StaggeredContainer>
  );
}
