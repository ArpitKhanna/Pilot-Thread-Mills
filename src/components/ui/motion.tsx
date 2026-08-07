"use client";

import {
  motion,
  type HTMLMotionProps,
  type Variants,
} from "framer-motion";

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
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

export { motion };
