"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { TopBar } from "@/components/layout/AppShell";
import { Modal } from "@/components/ui/Modal";
import { PendingLink } from "@/components/ui/PendingLink";
import type { AppContext } from "@/app/(app)/layout";
import { InvoiceList } from "@/components/salesmen/InvoiceList";
import { InvoicePreview } from "@/components/salesmen/InvoicePreview";
import { ItemRequestsList } from "@/components/salesmen/ItemRequestsList";
import { PaymentsList } from "@/components/salesmen/PaymentsList";
import { PersonalDetailsForm } from "@/components/salesmen/PersonalDetailsForm";
import { SalesmanOverview } from "@/components/salesmen/SalesmanOverview";
import type { BankAccount } from "@/lib/bank-accounts/types";
import type { PriceListItem } from "@/lib/auth/types";
import {
  buildWhatsAppShareUrl,
  canEditInvoice,
  formatINR,
} from "@/lib/salesmen/mock-data";
import type {
  Invoice,
  ItemRequest,
  Salesman,
} from "@/lib/salesmen/types";
import { ENTITY_TYPE_LABELS } from "@/lib/salesmen/types";

type DetailTab =
  | "overview"
  | "invoices"
  | "payments"
  | "requests"
  | "details";

type SalesmanDetailClientProps = {
  context: AppContext;
  initialSalesman: Salesman;
  initialInvoices: Invoice[];
  initialItemRequests: ItemRequest[];
  priceList: PriceListItem[];
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

export function SalesmanDetailClient({
  context,
  initialSalesman,
  initialInvoices,
  initialItemRequests,
  priceList,
  bankAccounts,
}: SalesmanDetailClientProps) {
  const router = useRouter();
  const [editPending, startEditTransition] = useTransition();
  const [salesman, setSalesman] = useState(initialSalesman);
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [itemRequests, setItemRequests] = useState(initialItemRequests);

  const paymentCount = useMemo(
    () =>
      invoices.filter(
        (inv) =>
          inv.amountPaid > 0 ||
          (inv.paymentEntries != null && inv.paymentEntries.length > 0),
      ).length,
    [invoices],
  );

  const openRequestCount = useMemo(
    () => itemRequests.filter((r) => r.status === "open").length,
    [itemRequests],
  );

  const [tab, setTab] = useState<DetailTab>("overview");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(
    () => initialInvoices[0] ?? null,
  );
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [editLockedOpen, setEditLockedOpen] = useState(false);

  useEffect(() => {
    setSalesman(initialSalesman);
    setInvoices(initialInvoices);
    setItemRequests(initialItemRequests);
  }, [initialSalesman, initialInvoices, initialItemRequests]);

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
      salesman.phone,
      invoice,
      salesman.name,
    );
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <TopBar
        context={context}
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Salesmen", href: "/entities/salesmen" },
          { label: salesman.name },
        ]}
      />

      <div className="flex min-h-0 flex-1 flex-col print:hidden">
        <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-4 sm:mb-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-medium tracking-tight sm:text-2xl">
              {salesman.name}
            </h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
              <span
                className={
                  salesman.isActive
                    ? "font-medium text-emerald-700"
                    : "font-medium text-muted"
                }
              >
                {salesman.isActive ? "Active" : "Inactive"}
              </span>
              <span className="text-border" aria-hidden>
                |
              </span>
              <span className="text-muted">
                {ENTITY_TYPE_LABELS[salesman.entityType]}
              </span>
              <span className="text-border" aria-hidden>
                |
              </span>
              <span
                className={
                  salesman.pendingBalance > 0
                    ? "font-medium text-[#c45c26]"
                    : "text-muted"
                }
              >
                Balance {formatINR(salesman.pendingBalance)}
              </span>
            </p>
          </div>

          <div className="inline-flex w-full max-w-full overflow-x-auto rounded-lg border border-border bg-surface p-0.5 lg:w-auto lg:max-w-[min(100%,42rem)]">
            <TabButton
              active={tab === "overview"}
              onClick={() => setTab("overview")}
              label="Overview"
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
              active={tab === "requests"}
              onClick={() => setTab("requests")}
              label={`Item Request(s) (${openRequestCount})`}
            />
            <TabButton
              active={tab === "details"}
              onClick={() => setTab("details")}
              label="Personal Details"
            />
          </div>
        </div>

        {tab === "overview" ? (
          <SalesmanOverview invoices={invoices} />
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
                  href={`/orders/salesmen?salesmanId=${encodeURIComponent(salesman.id)}`}
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
                      salesman={salesman}
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
        ) : tab === "requests" ? (
          <ItemRequestsList
            salesmanId={salesman.id}
            priceList={priceList}
            requests={itemRequests}
            onRequestsChange={setItemRequests}
          />
        ) : (
          <PersonalDetailsForm
            key={`${salesman.id}-${salesman.phone}-${salesman.discountRules.length}`}
            salesman={salesman}
            priceList={priceList}
            onSaved={setSalesman}
          />
        )}
        </main>
      </div>

      {selectedInvoice && mobilePreviewOpen && (
        <div className="lg:hidden print:hidden">
          <InvoicePreview
            invoice={selectedInvoice}
            salesman={salesman}
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
            salesman={salesman}
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
        title="Editing locked"
        footer={
          <button
            type="button"
            onClick={() => setEditLockedOpen(false)}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-sidebar"
          >
            Close
          </button>
        }
      >
        <p className="text-sm text-muted">
          This invoice can no longer be edited. Changes are only allowed within
          5 minutes of generation so prices stay consistent.
        </p>
      </Modal>
    </>
  );
}

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
