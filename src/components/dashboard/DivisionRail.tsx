"use client";

import { formatINR } from "@/lib/salesmen/mock-data";
import { motion } from "@/components/ui/motion";
import {
  DIVISION_LABELS,
  type DivisionMethod,
} from "./ledger-utils";

type DivisionRailProps = {
  breakdown: Record<DivisionMethod, number>;
};

const DIVISIONS: DivisionMethod[] = ["cash", "upi", "cheque"];

export function DivisionRail({ breakdown }: DivisionRailProps) {
  return (
    <section className="flex flex-col gap-3">
      <p className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
        By division
      </p>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {DIVISIONS.map((division, index) => {
          const amount = breakdown[division];
          const amountClass =
            amount > 0
              ? "text-credit"
              : amount < 0
                ? "text-debit"
                : "text-foreground";

          return (
            <motion.div
              key={division}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                delay: index * 0.08,
                type: "spring",
                stiffness: 320,
                damping: 28,
              }}
              whileTap={{ scale: 0.97 }}
              className="flex min-w-[140px] shrink-0 flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:min-w-[160px]"
            >
              <p className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
                {DIVISION_LABELS[division]}
              </p>
              <p className={`text-lg font-medium tabular-nums ${amountClass}`}>
                {formatINR(amount)}
              </p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
