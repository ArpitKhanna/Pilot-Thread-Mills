"use client";

import { useMemo, useState } from "react";
import { TopBar } from "@/components/layout/AppShell";
import { Modal } from "@/components/ui/Modal";
import type { AppContext } from "@/app/(app)/layout";
import { InvoiceList } from "@/components/salesmen/InvoiceList";
import { InvoicePreview } from "@/components/salesmen/InvoicePreview";
import {
  buildWhatsAppShareUrl,
  formatINR,
  getInvoicesForSalesman,
  resolveDateRange,
  summarizePurchasesAndPayments,
} from "@/lib/salesmen/mock-data";
import type {
  Invoice,
  Salesman,
  TimeRangePreset,
} from "@/lib/salesmen/types";

type DetailTab = "invoices" | "payments" | "requests" | "details";

type SalesmanDetailClientProps = {
  context: AppContext;
  initialSalesman: Salesman;
};

const RANGE_OPTIONS: { id: TimeRangePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "1W" },
  { id: "month", label: "1M" },
  { id: "6m", label: "6M" },
  { id: "1y", label: "1Y" },
  { id: "max", label: "Max" },
  { id: "custom", label: "Custom" },
];

export function SalesmanDetailClient({
  context,
  initialSalesman,
}: SalesmanDetailClientProps) {
  const [salesman, setSalesman] = useState(initialSalesman);
  const [tab, setTab] = useState<DetailTab>("invoices");
  const [rangePreset, setRangePreset] = useState<TimeRangePreset>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [editNoticeOpen, setEditNoticeOpen] = useState(false);

  const invoices = useMemo(
    () => getInvoicesForSalesman(salesman.id),
    [salesman.id],
  );

  const summary = useMemo(() => {
    const range = resolveDateRange(rangePreset, customFrom, customTo);
    return summarizePurchasesAndPayments(invoices, range);
  }, [invoices, rangePreset, customFrom, customTo]);

  const barMax = Math.max(summary.purchases, summary.payments, summary.pending, 1);

  function handleView(invoice: Invoice) {
    setSelectedInvoice(invoice);
  }

  function handleEdit() {
    setEditNoticeOpen(true);
  }

  function handlePrint(invoice: Invoice) {
    setSelectedInvoice(invoice);
    // Allow preview to mount before printing
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

  function toggleActive() {
    setSalesman((prev) => ({ ...prev, isActive: !prev.isActive }));
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

      <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8 print:hidden">
        {/* Header */}
        <div className="mb-5 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
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
              <span className="text-muted">{salesman.category}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={toggleActive}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5 text-sm font-medium hover:bg-sidebar sm:w-auto"
          >
            Set to {salesman.isActive ? "Inactive" : "Active"}
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-border">
              <ChevronDownIcon />
            </span>
          </button>
        </div>

        {/* Purchase & Payments chart */}
        <section className="mb-6 rounded-xl border border-border bg-surface p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-mono text-[10px] tracking-wider text-muted uppercase">
                Purchase &amp; Payments
              </p>
              <p className="mt-1 text-2xl font-medium tracking-tight sm:text-3xl">
                {formatINR(summary.purchases)}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                Total purchases in selected period
              </p>
            </div>

            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              <div className="inline-flex flex-wrap rounded-lg border border-border bg-background p-0.5">
                {RANGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setRangePreset(opt.id)}
                    className={`rounded-md px-2.5 py-1.5 text-xs sm:text-sm ${
                      rangePreset === opt.id
                        ? "bg-surface font-medium shadow-sm"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {rangePreset === "custom" && (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                    aria-label="From date"
                  />
                  <span className="text-xs text-muted">to</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                    aria-label="To date"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 border-t border-border pt-5 sm:grid-cols-3 sm:gap-0">
            <MetricColumn
              label="Purchases"
              amount={summary.purchases}
              pct={(summary.purchases / barMax) * 100}
              barClass="bg-[#e86f2a]"
            />
            <MetricColumn
              label="Payments"
              amount={summary.payments}
              pct={(summary.payments / barMax) * 100}
              barClass="bg-[#f0a06a]"
              bordered
            />
            <MetricColumn
              label="Pending"
              amount={summary.pending}
              pct={(summary.pending / barMax) * 100}
              barClass="bg-[#f8d4b8]"
              amountClass="text-[#c45c26]"
              bordered
            />
          </div>
        </section>

        {/* Tabs */}
        <div className="mb-4 inline-flex w-full max-w-full overflow-x-auto rounded-lg border border-border bg-surface p-0.5 sm:w-auto">
          <TabButton
            active={tab === "invoices"}
            onClick={() => setTab("invoices")}
            label={`Invoices (${invoices.length})`}
          />
          <TabButton
            active={tab === "payments"}
            onClick={() => setTab("payments")}
            label="Payments"
          />
          <TabButton
            active={tab === "requests"}
            onClick={() => setTab("requests")}
            label="Item Request(s)"
          />
          <TabButton
            active={tab === "details"}
            onClick={() => setTab("details")}
            label="Personal Details"
          />
        </div>

        {tab === "invoices" ? (
          <div
            className={`grid gap-4 ${
              selectedInvoice
                ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]"
                : ""
            }`}
          >
            <InvoiceList
              invoices={invoices}
              selectedId={selectedInvoice?.id ?? null}
              onView={handleView}
              onEdit={() => handleEdit()}
              onPrint={handlePrint}
              onWhatsApp={handleWhatsApp}
            />

            {selectedInvoice && (
              <div className="hidden print:hidden lg:block">
                <InvoicePreview
                  invoice={selectedInvoice}
                  salesman={salesman}
                  onClose={() => setSelectedInvoice(null)}
                  onEdit={handleEdit}
                  onPrint={() => handlePrint(selectedInvoice)}
                  onWhatsApp={() => handleWhatsApp(selectedInvoice)}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface px-4 py-12 text-center text-sm text-muted">
            {tab === "payments" && "Payments tab coming soon"}
            {tab === "requests" && "Item requests coming soon"}
            {tab === "details" && "Personal details coming soon"}
          </div>
        )}
      </main>

      {/* Mobile preview overlay */}
      {selectedInvoice && (
        <div className="lg:hidden print:hidden">
          <InvoicePreview
            invoice={selectedInvoice}
            salesman={salesman}
            asOverlay
            onClose={() => setSelectedInvoice(null)}
            onEdit={handleEdit}
            onPrint={() => handlePrint(selectedInvoice)}
            onWhatsApp={() => handleWhatsApp(selectedInvoice)}
          />
        </div>
      )}

      {/* Print-only document */}
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
        open={editNoticeOpen}
        onClose={() => setEditNoticeOpen(false)}
        title="Edit Invoice"
        footer={
          <button
            type="button"
            onClick={() => setEditNoticeOpen(false)}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-sidebar"
          >
            Close
          </button>
        }
      >
        <p className="text-sm text-muted">
          Invoice editing is coming soon. You&apos;ll be able to update line
          items and payments here.
        </p>
      </Modal>
    </>
  );
}

function MetricColumn({
  label,
  amount,
  pct,
  barClass,
  amountClass,
  bordered = false,
}: {
  label: string;
  amount: number;
  pct: number;
  barClass: string;
  amountClass?: string;
  bordered?: boolean;
}) {
  return (
    <div
      className={`sm:px-4 ${
        bordered ? "border-t border-border pt-4 sm:border-t-0 sm:border-l sm:pt-0" : "sm:pl-0 sm:pr-4"
      }`}
    >
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-lg font-medium tabular-nums ${amountClass ?? ""}`}>
        {formatINR(amount)}
      </p>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#f5f0eb]">
        <div
          className={`h-full rounded-full transition-all ${barClass}`}
          style={{ width: `${Math.max(pct, amount > 0 ? 4 : 0)}%` }}
        />
      </div>
    </div>
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

function ChevronDownIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
      <path
        d="M2.5 3.75L5 6.25L7.5 3.75"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
