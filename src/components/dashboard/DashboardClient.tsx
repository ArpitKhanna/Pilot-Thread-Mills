"use client";

import type { AppContext } from "@/app/(app)/layout";
import type { PriceListItem } from "@/lib/auth/types";
import type { BankAccount } from "@/lib/bank-accounts/types";
import type { DailyLedgerSummary, DyeingStats, OrderStats } from "@/lib/ledger/types";
import {
  ApprovalsWidget,
  type PendingInvoiceApprovalSummary,
} from "./ApprovalsWidget";
import { DashboardLedgerBoard } from "./DashboardLedgerBoard";
import { DyeingStatusWidget } from "./DyeingStatusWidget";
import { OrderStatusWidget } from "./OrderStatusWidget";

type DashboardClientProps = {
  context: AppContext;
  ledger: DailyLedgerSummary;
  orderStats: OrderStats;
  dyeingStats: DyeingStats;
  bankAccounts: BankAccount[];
  pendingInvoices: PendingInvoiceApprovalSummary[];
  pendingPriceItems: PriceListItem[];
  canAddReceipt: boolean;
  canAddExpense: boolean;
};

export function DashboardClient({
  context,
  ledger,
  orderStats,
  dyeingStats,
  bankAccounts,
  pendingInvoices,
  pendingPriceItems,
  canAddReceipt,
  canAddExpense,
}: DashboardClientProps) {
  const isAdmin = context.profile.role === "admin";

  return (
    <DashboardLedgerBoard
      initialLedger={ledger}
      bankAccounts={bankAccounts}
      canAddReceipt={canAddReceipt}
      canAddExpense={canAddExpense}
      operationsColumn={
        <>
          <OrderStatusWidget initialStats={orderStats} compact />
          <DyeingStatusWidget initialStats={dyeingStats} compact />
        </>
      }
      footer={
        isAdmin ? (
          <div className="mt-5 sm:mt-6">
            <ApprovalsWidget
              pendingInvoices={pendingInvoices}
              pendingPriceItems={pendingPriceItems}
            />
          </div>
        ) : undefined
      }
    />
  );
}
