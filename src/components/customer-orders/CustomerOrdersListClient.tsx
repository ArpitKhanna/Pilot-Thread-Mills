"use client";

import { useMemo, useState } from "react";
import type { AppContext } from "@/app/(app)/layout";
import { TopBar } from "@/components/layout/AppShell";
import { NewCustomerOrderModal } from "@/components/customer-orders/NewCustomerOrderModal";
import { PendingLink } from "@/components/ui/PendingLink";
import {
  CUSTOMER_ORDER_STATUS_LABELS,
  type CustomerOrder,
  type CustomerOrderStatus,
} from "@/lib/customer-orders/types";
import { formatShortDate } from "@/lib/salesmen/mock-data";
import type { Salesman } from "@/lib/salesmen/types";

type CustomerOrdersListClientProps = {
  context: AppContext;
  initialOrders: CustomerOrder[];
  customers: Salesman[];
};

const STATUS_FILTERS: Array<CustomerOrderStatus | "all"> = [
  "all",
  "draft",
  "confirmed",
  "picking",
  "invoiced",
  "cancelled",
];

function statusTone(status: CustomerOrderStatus): string {
  switch (status) {
    case "draft":
      return "bg-sidebar text-muted";
    case "confirmed":
      return "bg-amber-50 text-amber-900";
    case "picking":
      return "bg-sky-50 text-sky-900";
    case "invoiced":
      return "bg-emerald-50 text-emerald-900";
    case "cancelled":
      return "bg-red-50 text-red-800";
    default:
      return "bg-sidebar text-muted";
  }
}

export function CustomerOrdersListClient({
  context,
  initialOrders,
  customers,
}: CustomerOrdersListClientProps) {
  const [orders] = useState(initialOrders);
  const [status, setStatus] = useState<CustomerOrderStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);

  const displayed = useMemo(() => {
    return orders.filter((order) => {
      if (status !== "all" && order.status !== status) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase().trim();
      return (
        (order.customerName ?? "").toLowerCase().includes(q) ||
        order.id.toLowerCase().includes(q)
      );
    });
  }, [orders, status, search]);

  return (
    <>
      <TopBar
        context={context}
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Customer Orders" },
        ]}
      />

      <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-medium tracking-tight sm:text-2xl">
              Customer Orders
            </h1>
            <p className="mt-1 text-sm text-muted">
              Upload order slips, match swatches, enter shades, then invoice
            </p>
          </div>
          <button
            type="button"
            onClick={() => setNewOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-surface hover:bg-foreground/90"
          >
            <span className="text-lg leading-none">+</span>
            New Order
          </button>
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex w-full gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-0.5 sm:w-auto">
            {STATUS_FILTERS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatus(value)}
                className={`shrink-0 rounded-md px-3 py-2 text-sm sm:py-1.5 ${
                  status === value
                    ? "bg-sidebar font-medium"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {value === "all"
                  ? "All"
                  : CUSTOMER_ORDER_STATUS_LABELS[value]}
              </button>
            ))}
          </div>

          <div className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 sm:ml-auto sm:max-w-xs sm:py-2">
            <input
              type="search"
              placeholder="Search customer"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
            />
          </div>
        </div>

        {displayed.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface px-4 py-12 text-center text-sm text-muted">
            No customer orders yet. Create one and upload the order slip as proof.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-sidebar/50 text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">
                    Date
                  </th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">
                    Lines
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-border last:border-0 hover:bg-sidebar/40"
                  >
                    <td className="px-4 py-3">
                      <PendingLink
                        href={`/orders/customers/${order.id}`}
                        className="font-medium hover:underline"
                      >
                        {order.customerName ?? "Customer"}
                      </PendingLink>
                      <div className="mt-0.5 text-xs text-muted sm:hidden">
                        {formatShortDate(order.orderDate)}
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-muted sm:table-cell">
                      {formatShortDate(order.orderDate)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${statusTone(order.status)}`}
                      >
                        {CUSTOMER_ORDER_STATUS_LABELS[order.status]}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-muted md:table-cell">
                      {order.lineCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <NewCustomerOrderModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        customers={customers}
      />
    </>
  );
}
