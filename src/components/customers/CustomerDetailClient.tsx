"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import type { AppContext } from "@/app/(app)/layout";
import { CustomerPastOrdersTab } from "@/components/customers/CustomerPastOrdersTab";
import { CustomerPersonalDetailsForm } from "@/components/customers/CustomerPersonalDetailsForm";
import { TopBar } from "@/components/layout/AppShell";
import { Modal } from "@/components/ui/Modal";
import { PendingLink } from "@/components/ui/PendingLink";
import { InvoiceList } from "@/components/salesmen/InvoiceList";
import { InvoicePreview } from "@/components/salesmen/InvoicePreview";
import { PaymentsList } from "@/components/salesmen/PaymentsList";
import type { BankAccount } from "@/lib/bank-accounts/types";
import type { CustomerOrder } from "@/lib/customer-orders/types";
import {
  buildWhatsAppShareUrl,
  canEditInvoice,
  formatINR,
} from "@/lib/salesmen/mock-data";
import type { Invoice, Salesman } from "@/lib/salesmen/types";
import {
  CUSTOMER_TIER_LABELS,
  ENTITY_TYPE_LABELS,
  MARKET_DAY_LABELS,
} from "@/lib/salesmen/types";

type DetailTab =
  | "orders"
  | "invoices"
  | "payments"
  | "pending"
  | "details";

type CustomerDetailClientProps = {
  context: AppContext;
  initialCustomer: Salesman;
  initialOrders: CustomerOrder[];
  initialInvoices: Invoice[];
  bankAccounts: BankAccount[];
};

const MONTH_OPTIONS = [
  { value: "0", label: "January" },
  { value: "1", label: "February" },
  { value: "2", label: "March" },
  { value: "3", label: "April" },
  { value: "4", label: "May" },
  { value: "5", label: "June" },
  { value: "6", label: "July" },
  { value: "7", label: "August" },
  { value: "8", label: "September" },
  { value: "9", label: "October" },
  { value: "10", label: "November" },
  { value: "11", label: "December" },
] as const;

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
}: CustomerDetailClientProps) {
  const router = useRouter();
  const [editPending, startEditTransition] = useTransition();
  const [customer, setCustomer] = useState(initialCustomer);
  const [orders] = useState(initialOrders);
  const [invoices, setInvoices] = useState(initialInvoices);
  const [tab, setTab] = useState<DetailTab>("orders");
  const [filterMonth, setFilterMonth] = useState("all");
  const [filterYear, setFilterYear] = useState("all");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(
    () => initialInvoices[0] ?? null,
  );
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [editLockedOpen, setEditLockedOpen] = useState(false);

  useEffect(() => {
    setCustomer(initialCustomer);
    setInvoices(initialInvoices);
  }, [initialCustomer, initialInvoices]);

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

  const balanceAlert =
    customer.balanceThreshold != null &&
    customer.balanceThreshold > 0 &&
    customer.pendingBalance >= customer.balanceThreshold;

  const availableYears = useMemo(() => {
    const years = new Set(
      invoices.map((inv) => new Date(inv.issuedAt).getFullYear()),
    );
    return Array.from(years).sort((a, b) => b - a);
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const d = new Date(inv.issuedAt);
      if (filterYear !== "all" && d.getFullYear() !== Number(filterYear)) {
        return false;
      }
      if (filterMonth !== "all" && d.getMonth() !== Number(filterMonth)) {
        return false;
      }
      return true;
    });
  }, [invoices, filterMonth, filterYear]);

  useEffect(() => {
    if (filteredInvoices.length === 0) {
      setSelectedInvoice(null);
      return;
    }
    setSelectedInvoice((current) => {
      if (current && filteredInvoices.some((inv) => inv.id === current.id)) {
        return current;
      }
      return filteredInvoices[0] ?? null;
    });
  }, [filteredInvoices]);

  function handleSelect(invoice: Invoice) {
    setSelectedInvoice(invoice);
    setMobilePreviewOpen(true);
  }

  function handleEdit() {
    if (!selectedInvoice || !canEditInvoice(selectedInvoice)) {
      setEditLockedOpen(true);
      return;
    }
    if (editPending) return;
    startEditTransition(() => {
      router.push(`/orders/salesmen/${selectedInvoice.id}/edit`);
    });
  }

  function handlePrint(invoice: Invoice) {
    setSelectedInvoice(invoice);
    requestAnimationFrame(() => {
      window.setTimeout(() => window.print(), 50);
    });
  }

  function handleWhatsApp(invoice: Invoice) {
    const url = buildWhatsAppShareUrl(
      customer.phone,
      invoice,
      customer.name,
    );
    window.open(url, "_blank", "noopener,noreferrer");
  }

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

  if (customer.tier) {
    metaParts.push({
      key: "tier",
      node: (
        <span className="text-muted">
          {CUSTOMER_TIER_LABELS[customer.tier]}
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

          <div className="mb-5 inline-flex w-full max-w-full overflow-x-auto rounded-lg border border-border bg-surface p-0.5 sm:mb-6">
            <TabButton
              active={tab === "orders"}
              onClick={() => setTab("orders")}
              label={`Past Orders (${orders.length})`}
            />
            <TabButton
              active={tab === "invoices"}
              onClick={() => setTab("invoices")}
              label={`Invoices (${invoices.length})`}
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
            <CustomerPastOrdersTab orders={orders} />
          ) : tab === "invoices" ? (
            <div>
              <div className="sticky top-0 z-10 -mx-4 mb-4 flex flex-col gap-3 bg-background px-4 py-3 sm:-mx-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:-mx-8 lg:px-8">
                <h2 className="text-lg font-medium tracking-tight">
                  Invoices ({filteredInvoices.length})
                </h2>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <select
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(e.target.value)}
                    className="rounded-lg border border-border bg-surface py-2 pr-9 pl-3 text-sm"
                    aria-label="Filter by month"
                  >
                    <option value="all">All months</option>
                    {MONTH_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={filterYear}
                    onChange={(e) => setFilterYear(e.target.value)}
                    className="rounded-lg border border-border bg-surface py-2 pr-9 pl-3 text-sm"
                    aria-label="Filter by year"
                  >
                    <option value="all">All years</option>
                    {availableYears.map((year) => (
                      <option key={year} value={String(year)}>
                        {year}
                      </option>
                    ))}
                  </select>
                  <PendingLink
                    href={`/orders/salesmen?salesmanId=${encodeURIComponent(customer.id)}`}
                    showPendingLabel
                    pendingLabel="Loading…"
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-foreground px-3.5 py-2 text-sm font-medium text-surface hover:bg-foreground/90"
                  >
                    <span className="text-base leading-none">+</span>
                    Add Invoice
                  </PendingLink>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
                <InvoiceList
                  invoices={filteredInvoices}
                  selectedId={selectedInvoice?.id ?? null}
                  onSelect={handleSelect}
                />
                {selectedInvoice ? (
                  <div className="hidden print:hidden lg:block">
                    <div className="sticky top-4 flex max-h-[calc(100dvh-6rem)] flex-col">
                      <InvoicePreview
                        invoice={selectedInvoice}
                        salesman={customer}
                        onClose={() => setSelectedInvoice(null)}
                        onEdit={handleEdit}
                        editPending={editPending}
                        onPrint={() => handlePrint(selectedInvoice)}
                        onWhatsApp={() => handleWhatsApp(selectedInvoice)}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="hidden items-center justify-center rounded-xl border border-dashed border-border bg-surface px-4 py-16 text-sm text-muted lg:flex">
                    Select an invoice to preview
                  </div>
                )}
              </div>
            </div>
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
              onSaved={setCustomer}
            />
          )}
        </main>
      </div>

      {selectedInvoice && mobilePreviewOpen && (
        <div className="lg:hidden print:hidden">
          <InvoicePreview
            invoice={selectedInvoice}
            salesman={customer}
            asOverlay
            onClose={() => setMobilePreviewOpen(false)}
            onEdit={handleEdit}
            editPending={editPending}
            onPrint={() => handlePrint(selectedInvoice)}
            onWhatsApp={() => handleWhatsApp(selectedInvoice)}
          />
        </div>
      )}

      {selectedInvoice && (
        <div className="hidden print:block">
          <InvoicePreview
            invoice={selectedInvoice}
            salesman={customer}
            forPrint
            onClose={() => undefined}
            onEdit={() => undefined}
            onPrint={() => undefined}
            onWhatsApp={() => undefined}
          />
        </div>
      )}

      <Modal
        open={editLockedOpen}
        onClose={() => setEditLockedOpen(false)}
        title="Edit window closed"
        footer={
          <button
            type="button"
            onClick={() => setEditLockedOpen(false)}
            className="rounded-lg bg-foreground px-5 py-2 text-sm font-medium text-surface"
          >
            OK
          </button>
        }
      >
        <p className="text-sm text-muted">
          This invoice can no longer be edited. The edit window has expired.
        </p>
      </Modal>
    </>
  );
}
