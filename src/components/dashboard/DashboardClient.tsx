"use client";

import type { AppContext } from "@/app/(app)/layout";
import type { PriceListItem } from "@/lib/auth/types";
import type { BankAccount } from "@/lib/bank-accounts/types";
import type { DailyLedgerSummary, DyeingStats, OrderStats } from "@/lib/ledger/types";
import {
  ApprovalsWidget,
  type PendingInvoiceApprovalSummary,
} from "./ApprovalsWidget";
import { DailyLedgerWidget } from "./DailyLedgerWidget";
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
    <div className="space-y-5 sm:space-y-6">
      <div className="mb-2">
        <h1 className="text-xl font-medium tracking-tight sm:text-2xl">
          Welcome, {context.profile.full_name}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Your day-to-day operations hub
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
        <div className="lg:col-span-2">
          <DailyLedgerWidget
            initialLedger={ledger}
            bankAccounts={bankAccounts}
            canAddReceipt={canAddReceipt}
            canAddExpense={canAddExpense}
          />
        </div>

        <OrderStatusWidget initialStats={orderStats} />
        <DyeingStatusWidget initialStats={dyeingStats} />

        {isAdmin && (
          <div className="lg:col-span-2">
            <ApprovalsWidget
              pendingInvoices={pendingInvoices}
              pendingPriceItems={pendingPriceItems}
            />
          </div>
        )}
      </div>
    </div>
  );
}
