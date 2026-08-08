"use client";

import {
  motion,
  type HTMLMotionProps,
  type Variants,
} from "framer-motion";
import { cn } from "@/lib/utils";

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

export const pageFade: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
  },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

export const tapScale = {
  whileTap: { scale: 0.98 },
  transition: { type: "spring" as const, stiffness: 400, damping: 28 },
};

const PAGE_MAIN_CLASS =
  "flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8";

type MotionCardProps = HTMLMotionProps<"div"> & {
  interactive?: boolean;
};

export function MotionCard({
  interactive = true,
  className,
  children,
  ...props
}: MotionCardProps) {
  return (
    <motion.div
      variants={fadeUp}
      {...(interactive ? tapScale : {})}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function MotionSection({
  className,
  children,
  ...props
}: HTMLMotionProps<"section">) {
  return (
    <motion.section
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className={className}
      {...props}
    >
      {children}
    </motion.section>
  );
}

type PageMainProps = {
  className?: string;
  children?: React.ReactNode;
  animate?: boolean;
};

/** Animated page content wrapper — use on every route's main area. */
export function PageMain({
  className,
  children,
  animate = true,
}: PageMainProps) {
  if (!animate) {
    return (
      <main className={cn(PAGE_MAIN_CLASS, className)}>{children}</main>
    );
  }

  return (
    <motion.main
      initial="hidden"
      animate="visible"
      variants={pageFade}
      className={cn(PAGE_MAIN_CLASS, className)}
    >
      {children}
    </motion.main>
  );
}

export { motion };
