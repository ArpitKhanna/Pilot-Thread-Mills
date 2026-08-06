"use client";

import Link from "next/link";
import type { BankAccount } from "@/lib/bank-accounts/types";
import type { DailyLedgerSummary } from "@/lib/ledger/types";
import { AddExpenseModal } from "./AddExpenseModal";
import { AddLedgerReceiptModal } from "./AddLedgerReceiptModal";
import { LedgerColumn, LedgerLineItem } from "./LedgerColumn";
import { computeBucketBreakdown } from "./ledger-utils";
import { useDailyLedger } from "./useDailyLedger";

type DashboardLedgerBoardProps = {
  initialLedger: DailyLedgerSummary;
  bankAccounts: BankAccount[];
  canAddReceipt: boolean;
  canAddExpense: boolean;
  operationsColumn: React.ReactNode;
  header?: React.ReactNode;
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

export function DashboardLedgerBoard({
  initialLedger,
  bankAccounts,
  canAddReceipt,
  canAddExpense,
  operationsColumn,
  header,
}: DashboardLedgerBoardProps) {
  const {
    ledger,
    date,
    loading,
    receiptOpen,
    setReceiptOpen,
    expenseOpen,
    setExpenseOpen,
    handleDateChange,
    onEntryCreated,
  } = useDailyLedger(initialLedger);

  const receiptsBreakdown = computeBucketBreakdown(ledger.receipts, {
    positiveOnly: true,
  });
  const paymentsBreakdown = computeBucketBreakdown(ledger.expenses);

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          Ledger for{" "}
          <span className="font-medium text-foreground">{ledger.date}</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={date}
            max={new Date().toISOString().slice(0, 10)}
            disabled={loading}
            onChange={(e) => void handleDateChange(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm"
          />
          {canAddReceipt && (
            <button
              type="button"
              onClick={() => setReceiptOpen(true)}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:bg-sidebar"
            >
              + Receipt
            </button>
          )}
          {canAddExpense && (
            <button
              type="button"
              onClick={() => setExpenseOpen(true)}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:bg-sidebar"
            >
              + Expense
            </button>
          )}
          <Link
            href="/payments"
            className="text-sm font-medium underline underline-offset-2"
          >
            History
          </Link>
        </div>
      </div>

      {header}

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
        <LedgerColumn
          title="Receipts"
          total={ledger.receiptsTotal}
          breakdown={receiptsBreakdown}
          action={
            canAddReceipt ? (
              <button
                type="button"
                onClick={() => setReceiptOpen(true)}
                className="text-sm font-medium underline underline-offset-2"
              >
                Add
              </button>
            ) : undefined
          }
          footer={
            ledger.pendingVerificationCount > 0 ? (
              <p className="border-b border-border px-4 py-2 text-sm text-amber-800 sm:px-5">
                {ledger.pendingVerificationCount} receipt
                {ledger.pendingVerificationCount === 1 ? "" : "s"} pending
                verification
              </p>
            ) : undefined
          }
        >
          {ledger.receipts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              No receipts for this day.
            </p>
          ) : (
            ledger.receipts.map((line) => (
              <LedgerLineItem
                key={`${line.kind}-${line.id}`}
                title={`${line.partyName ?? line.sourceCategory.replace("_", " ")}${line.invoiceNumber ? ` · ${line.invoiceNumber}` : ""}`}
                subtitle={`${kindLabel(line.kind)} · ${METHOD_LABELS[line.method]}${line.verificationStatus === "pending_verification" ? " · pending verification" : ""}`}
                amount={line.amount}
                amountClass={line.amount < 0 ? "text-[#c45c26]" : undefined}
              />
            ))
          )}
        </LedgerColumn>

        <LedgerColumn
          title="Payments"
          total={ledger.expensesTotal}
          breakdown={paymentsBreakdown}
          action={
            canAddExpense ? (
              <button
                type="button"
                onClick={() => setExpenseOpen(true)}
                className="text-sm font-medium underline underline-offset-2"
              >
                Add
              </button>
            ) : undefined
          }
        >
          {ledger.expenses.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              No payments for this day.
            </p>
          ) : (
            ledger.expenses.map((line) => (
              <LedgerLineItem
                key={line.id}
                title={`${line.category.replace("_", " ")}${line.payee ? ` · ${line.payee}` : ""}`}
                subtitle={`Expense · ${METHOD_LABELS[line.method]}`}
                amount={-line.amount}
                amountClass="text-[#c45c26]"
                variant="expense"
              />
            ))
          )}
        </LedgerColumn>

        <div className="flex min-h-[420px] flex-col gap-4 lg:min-h-[calc(100dvh-10rem)] lg:gap-5">
          {operationsColumn}
        </div>
      </div>

      {canAddReceipt && (
        <AddLedgerReceiptModal
          open={receiptOpen}
          onClose={() => setReceiptOpen(false)}
          bankAccounts={bankAccounts}
          onCreated={onEntryCreated}
        />
      )}
      {canAddExpense && (
        <AddExpenseModal
          open={expenseOpen}
          onClose={() => setExpenseOpen(false)}
          onCreated={onEntryCreated}
        />
      )}
    </>
  );
}
