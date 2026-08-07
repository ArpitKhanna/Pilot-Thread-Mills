"use client";

import { formatINR } from "@/lib/salesmen/mock-data";
import { motion } from "@/components/ui/motion";

type NetBalanceCardProps = {
  netTotal: number;
  pendingVerificationCount: number;
};

export function NetBalanceCard({
  netTotal,
  pendingVerificationCount,
}: NetBalanceCardProps) {
  const netClass =
    netTotal > 0
      ? "text-credit"
      : netTotal < 0
        ? "text-debit"
        : "text-foreground";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 360, damping: 30 }}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1">
        <p className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
          Net balance
        </p>
        <p
          className={`text-3xl font-medium tabular-nums tracking-[-0.02em] ${netClass}`}
        >
          {formatINR(netTotal)}
        </p>
      </div>

      {pendingVerificationCount > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {pendingVerificationCount} receipt
          {pendingVerificationCount === 1 ? "" : "s"} pending verification
        </p>
      )}
    </motion.div>
  );
}
