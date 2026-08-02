"use client";

import Link from "next/link";
import type { PriceListItem } from "@/lib/auth/types";
import type { PendingInvoiceApproval } from "@/lib/salesmen/queries";
import { formatINR } from "@/lib/salesmen/mock-data";
import { WidgetSection } from "./WidgetKpi";

type ApprovalsWidgetProps = {
  pendingInvoices: PendingInvoiceApproval[];
  pendingPriceItems: PriceListItem[];
};

export function ApprovalsWidget({
  pendingInvoices,
  pendingPriceItems,
}: ApprovalsWidgetProps) {
  if (pendingInvoices.length === 0 && pendingPriceItems.length === 0) {
    return null;
  }

  return (
    <WidgetSection
      title="Pending approvals"
      description="Items needing admin attention"
      action={
        pendingInvoices.length > 0 ? (
          <Link
            href="/approvals"
            className="text-sm font-medium underline underline-offset-2"
          >
            View all
          </Link>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {pendingInvoices.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">
              Invoices ({pendingInvoices.length})
            </p>
            <ul className="space-y-1.5">
              {pendingInvoices.slice(0, 5).map(({ invoice, salesmanName, chargedTotal }) => (
                <li
                  key={invoice.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{invoice.number}</p>
                    <p className="truncate text-xs text-muted">{salesmanName}</p>
                  </div>
                  <span className="shrink-0 tabular-nums text-muted">
                    {formatINR(chargedTotal)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {pendingPriceItems.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">
              Price list ({pendingPriceItems.length})
            </p>
            <ul className="space-y-1.5">
              {pendingPriceItems.slice(0, 5).map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm"
                >
                  <span className="truncate font-medium">{item.item_name}</span>
                  <Link
                    href="/entities/price-list"
                    className="shrink-0 text-xs underline underline-offset-2"
                  >
                    Review
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </WidgetSection>
  );
}
