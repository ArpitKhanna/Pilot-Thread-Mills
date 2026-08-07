"use client";

import type {
  LedgerExpenseLine,
  LedgerReceiptLine,
} from "@/lib/ledger/types";
import { formatINR } from "@/lib/salesmen/mock-data";
import { motion } from "@/components/ui/motion";

type Transaction = {
  id: string;
  title: string;
  subtitle: string;
  amount: number;
  timestamp: string;
};

const METHOD_LABELS = {
  cash: "Cash",
  cheque: "Cheque",
  upi: "UPI",
  imps: "IMPS",
} as const;

function kindLabel(kind: string): string {
  switch (kind) {
    case "advance":
      return "Advance";
    case "invoice_payment":
      return "Invoice";
    case "return":
      return "Return";
    default:
      return kind;
  }
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function buildTransactions(
  receipts: LedgerReceiptLine[],
  expenses: LedgerExpenseLine[],
): Transaction[] {
  const receiptItems: Transaction[] = receipts.map((line) => ({
    id: `receipt-${line.kind}-${line.id}`,
    title:
      line.partyName ??
      line.sourceCategory.replace("_", " ") ??
      "Receipt",
    subtitle: `${kindLabel(line.kind)} · ${METHOD_LABELS[line.method]} · ${formatTime(line.receivedAt)}${line.verificationStatus === "pending_verification" ? " · pending" : ""}`,
    amount: line.amount,
    timestamp: line.receivedAt,
  }));

  const expenseItems: Transaction[] = expenses.map((line) => ({
    id: `expense-${line.id}`,
    title: `${line.category.replace("_", " ")}${line.payee ? ` · ${line.payee}` : ""}`,
    subtitle: `Payment · ${METHOD_LABELS[line.method]} · ${formatTime(line.paidAt)}`,
    amount: -line.amount,
    timestamp: line.paidAt,
  }));

  return [...receiptItems, ...expenseItems].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

type TransactionListProps = {
  receipts: LedgerReceiptLine[];
  expenses: LedgerExpenseLine[];
};

export function TransactionList({ receipts, expenses }: TransactionListProps) {
  const transactions = buildTransactions(receipts, expenses);

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-medium">Recent transactions</h2>

      {transactions.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-4 py-10 text-center text-sm text-muted">
          No transactions for this day.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {transactions.map((tx, index) => {
            const isCredit = tx.amount >= 0;
            const amountClass = isCredit ? "text-credit" : "text-debit";
            const prefix = isCredit && tx.amount > 0 ? "+" : "";

            return (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: Math.min(index * 0.04, 0.4),
                  type: "spring",
                  stiffness: 360,
                  damping: 30,
                }}
                whileTap={{ scale: 0.99 }}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{tx.title}</p>
                  <p className="truncate text-xs text-muted">{tx.subtitle}</p>
                </div>
                <p
                  className={`shrink-0 text-sm font-medium tabular-nums ${amountClass}`}
                >
                  {prefix}
                  {formatINR(tx.amount)}
                </p>
              </motion.div>
            );
          })}
        </div>
      )}
    </section>
  );
}
