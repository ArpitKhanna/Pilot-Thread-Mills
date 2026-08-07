"use client";

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
        <NetBalanceCard
          date={date}
          netTotal={ledger.netTotal}
          receiptsTotal={ledger.receiptsTotal}
          expensesTotal={ledger.expensesTotal}
          loading={loading}
          pendingVerificationCount={ledger.pendingVerificationCount}
          onDateChange={(next) => void handleDateChange(next)}
          onAddReceipt={canAddReceipt ? () => setReceiptOpen(true) : undefined}
          onAddExpense={canAddExpense ? () => setExpenseOpen(true) : undefined}
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
