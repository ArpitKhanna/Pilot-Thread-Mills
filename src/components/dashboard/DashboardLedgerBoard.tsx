"use client";

import Link from "next/link";
import type { BankAccount } from "@/lib/bank-accounts/types";
import type { DailyLedgerSummary } from "@/lib/ledger/types";
import { MotionSection } from "@/components/ui/motion";
import { AddExpenseModal } from "./AddExpenseModal";
import { AddLedgerReceiptModal } from "./AddLedgerReceiptModal";
import { DivisionRail } from "./DivisionRail";
import { NetBalanceCard } from "./NetBalanceCard";
import { PaymentRemindersSection } from "./PaymentRemindersSection";
import { ReceiptPaymentRow } from "./ReceiptPaymentRow";
import { TransactionList } from "./TransactionList";
import { computeDivisionBreakdown } from "./ledger-utils";
import { useDailyLedger } from "./useDailyLedger";

type DashboardLedgerBoardProps = {
  initialLedger: DailyLedgerSummary;
  bankAccounts: BankAccount[];
  canAddReceipt: boolean;
  canAddExpense: boolean;
  operationsColumn?: React.ReactNode;
  header?: React.ReactNode;
};

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

  const divisionBreakdown = computeDivisionBreakdown(
    ledger.receipts,
    ledger.expenses,
  );

  return (
    <>
      {header}

      <MotionSection className="flex flex-col gap-5 sm:gap-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <input
            type="date"
            value={date}
            max={new Date().toISOString().slice(0, 10)}
            disabled={loading}
            onChange={(e) => void handleDateChange(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
          />
          <Link
            href="/payments"
            className="text-sm font-medium underline underline-offset-2"
          >
            History
          </Link>
        </div>

        <NetBalanceCard
          netTotal={ledger.netTotal}
          pendingVerificationCount={ledger.pendingVerificationCount}
        />

        <ReceiptPaymentRow
          receiptsTotal={ledger.receiptsTotal}
          expensesTotal={ledger.expensesTotal}
          onAddReceipt={canAddReceipt ? () => setReceiptOpen(true) : undefined}
          onAddExpense={canAddExpense ? () => setExpenseOpen(true) : undefined}
        />

        <DivisionRail breakdown={divisionBreakdown} />

        <PaymentRemindersSection />

        <TransactionList
          receipts={ledger.receipts}
          expenses={ledger.expenses}
        />

        {operationsColumn && (
          <div className="grid gap-4 sm:grid-cols-2 lg:gap-5">
            {operationsColumn}
          </div>
        )}
      </MotionSection>

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
