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

const DIVISION_ICONS: Record<DivisionMethod, string> = {
  cash: "₹",
  upi: "U",
  cheque: "Ch",
};

export function DivisionRail({ breakdown }: DivisionRailProps) {
  return (
    <div>
      <p className="mb-3 font-mono text-[10px] tracking-wider text-muted uppercase">
        By division
      </p>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {DIVISIONS.map((division, index) => {
          const amount = breakdown[division];
          const amountClass =
            amount > 0
              ? "text-emerald-700"
              : amount < 0
                ? "text-red-600"
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
              className="min-w-[140px] shrink-0 rounded-xl border border-border bg-surface p-4 sm:min-w-[160px]"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar font-mono text-xs font-medium text-muted">
                {DIVISION_ICONS[division]}
              </div>
              <p className="font-mono text-[10px] tracking-wider text-muted uppercase">
                {DIVISION_LABELS[division]}
              </p>
              <p className={`mt-1 text-lg font-medium tabular-nums ${amountClass}`}>
                {formatINR(amount)}
              </p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
