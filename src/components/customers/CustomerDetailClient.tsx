"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { AppContext } from "@/app/(app)/layout";
import { CustomerPastOrdersTab } from "@/components/customers/CustomerPastOrdersTab";
import { CustomerPersonalDetailsForm } from "@/components/customers/CustomerPersonalDetailsForm";
import { TopBar } from "@/components/layout/AppShell";
import { PaymentsList } from "@/components/salesmen/PaymentsList";
import type { PriceListItem } from "@/lib/auth/types";
import type { BankAccount } from "@/lib/bank-accounts/types";
import type { CustomerOrder } from "@/lib/customer-orders/types";
import { computeCustomerTierInsight } from "@/lib/customers/tier";
import { formatINR } from "@/lib/salesmen/mock-data";
import type { Invoice, Salesman } from "@/lib/salesmen/types";
import {
  CUSTOMER_TIER_LABELS,
  ENTITY_TYPE_LABELS,
  MARKET_DAY_LABELS,
} from "@/lib/salesmen/types";

type DetailTab = "orders" | "payments" | "pending" | "details";

type CustomerDetailClientProps = {
  context: AppContext;
  initialCustomer: Salesman;
  initialOrders: CustomerOrder[];
  initialInvoices: Invoice[];
  bankAccounts: BankAccount[];
  priceList: PriceListItem[];
};

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-md px-3 py-2 text-sm whitespace-nowrap sm:px-4 sm:py-1.5 ${
        active
          ? "bg-sidebar font-medium"
          : "text-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

export function CustomerDetailClient({
  context,
  initialCustomer,
  initialOrders,
  initialInvoices,
  bankAccounts,
  priceList,
}: CustomerDetailClientProps) {
  const [customer, setCustomer] = useState(initialCustomer);
  const [orders, setOrders] = useState(initialOrders);
  const [invoices, setInvoices] = useState(initialInvoices);
  const [tab, setTab] = useState<DetailTab>("orders");

  useEffect(() => {
    setCustomer(initialCustomer);
    setOrders(initialOrders);
    setInvoices(initialInvoices);
  }, [initialCustomer, initialOrders, initialInvoices]);

  const paymentCount = useMemo(
    () =>
      invoices.filter(
        (inv) =>
          inv.amountPaid > 0 ||
          (inv.paymentEntries != null && inv.paymentEntries.length > 0),
      ).length,
    [invoices],
  );

  const pendingOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status === "confirmed" ||
          o.status === "picking" ||
          o.status === "draft",
      ),
    [orders],
  );

  const tierInsight = useMemo(
    () => computeCustomerTierInsight(orders, invoices),
    [orders, invoices],
  );

  const balanceAlert =
    customer.balanceThreshold != null &&
    customer.balanceThreshold > 0 &&
    customer.pendingBalance >= customer.balanceThreshold;

  const metaParts: { key: string; node: ReactNode }[] = [
    {
      key: "status",
      node: (
        <span
          className={
            customer.isActive
              ? "font-medium text-emerald-700"
              : "font-medium text-muted"
          }
        >
          {customer.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "category",
      node: (
        <span className="text-muted">
          {ENTITY_TYPE_LABELS[customer.entityType]}
        </span>
      ),
    },
    {
      key: "tier",
      node: (
        <span
          className={
            tierInsight.tier ? "font-medium text-foreground" : "text-muted"
          }
        >
          {tierInsight.tier
            ? CUSTOMER_TIER_LABELS[tierInsight.tier]
            : "Tier —"}
        </span>
      ),
    },
  ];

  if (customer.marketDay) {
    metaParts.push({
      key: "market",
      node: (
        <span className="text-muted">
          Market: {MARKET_DAY_LABELS[customer.marketDay]}
        </span>
      ),
    });
  }

  return (
    <>
      <TopBar
        context={context}
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Customers", href: "/entities/customers" },
          { label: customer.name },
        ]}
      />

      <div className="flex min-h-0 flex-1 flex-col print:hidden">
        <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          {balanceAlert && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            >
              <span
                className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full bg-amber-500"
                aria-hidden
              />
              <div>
                <p className="font-medium">Pending balance alert</p>
                <p className="mt-0.5 text-amber-900/80">
                  Pending balance of {formatINR(customer.pendingBalance)} has
                  reached the alert threshold of{" "}
                  {formatINR(customer.balanceThreshold!)}.
                </p>
              </div>
            </div>
          )}

          <div className="mb-5 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl font-medium tracking-tight sm:text-2xl">
                {customer.name}
              </h1>
              <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                {metaParts.map((part, index) => (
                  <span key={part.key} className="contents">
                    {index > 0 && (
                      <span className="text-border" aria-hidden>
                        |
                      </span>
                    )}
                    {part.node}
                  </span>
                ))}
              </p>
            </div>
            <div className="shrink-0 text-left sm:text-right">
              <p className="font-mono text-[10px] tracking-wider text-muted uppercase">
                Pending Balance
              </p>
              <p
                className={`mt-0.5 text-xl font-medium tracking-tight sm:text-2xl ${
                  customer.pendingBalance > 0
                    ? "text-[#c45c26]"
                    : "text-foreground"
                }`}
              >
                {formatINR(customer.pendingBalance)}
              </p>
            </div>
          </div>

          <div className="mb-5 inline-flex max-w-full overflow-x-auto rounded-lg border border-border bg-surface p-0.5 sm:mb-6">
            <TabButton
              active={tab === "orders"}
              onClick={() => setTab("orders")}
              label={`Past Orders (${orders.length})`}
            />
            <TabButton
              active={tab === "payments"}
              onClick={() => setTab("payments")}
              label={`Payments (${paymentCount})`}
            />
            <TabButton
              active={tab === "pending"}
              onClick={() => setTab("pending")}
              label={`Pending Items (${pendingOrders.length})`}
            />
            <TabButton
              active={tab === "details"}
              onClick={() => setTab("details")}
              label="Personal Details"
            />
          </div>

          {tab === "orders" ? (
            <CustomerPastOrdersTab
              orders={orders}
              invoices={invoices}
              onOrderUpdated={(order) =>
                setOrders((prev) =>
                  prev.map((o) => (o.id === order.id ? order : o)),
                )
              }
            />
          ) : tab === "payments" ? (
            <PaymentsList invoices={invoices} bankAccounts={bankAccounts} />
          ) : tab === "pending" ? (
            <CustomerPastOrdersTab
              orders={pendingOrders}
              title="Pending Items"
            />
          ) : (
            <CustomerPersonalDetailsForm
              customer={customer}
              priceList={priceList}
              tierInsight={tierInsight}
              onSaved={setCustomer}
            />
          )}
        </main>
      </div>
    </>
  );
}
