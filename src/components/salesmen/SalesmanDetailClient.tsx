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
  const salesman = initialSalesman;
  const invoices = useMemo(
    () => getInvoicesForSalesman(salesman.id),
    [salesman.id],
  );

  const [tab, setTab] = useState<DetailTab>("invoices");
  const [rangePreset, setRangePreset] = useState<TimeRangePreset>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(
    () => invoices[0] ?? null,
  );
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [editNoticeOpen, setEditNoticeOpen] = useState(false);
  const [addInvoiceOpen, setAddInvoiceOpen] = useState(false);

  const summary = useMemo(() => {
    const range = resolveDateRange(rangePreset, customFrom, customTo);
    return summarizePurchasesAndPayments(invoices, range);
  }, [invoices, rangePreset, customFrom, customTo]);

  const paidPct =
    summary.purchases > 0
      ? Math.min(100, (summary.payments / summary.purchases) * 100)
      : 0;

  function handleSelect(invoice: Invoice) {
    setSelectedInvoice(invoice);
    setMobilePreviewOpen(true);
  }

  function handleEdit() {
    setEditNoticeOpen(true);
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
        {/* Header + tabs */}
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
              <span className="text-muted">{salesman.category}</span>
            </p>
          </div>

          <div className="inline-flex w-full max-w-full overflow-x-auto rounded-lg border border-border bg-surface p-0.5 lg:w-auto lg:max-w-[min(100%,36rem)]">
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
        </div>

        {/* Purchase & Payments chart */}
        <section className="mb-6 rounded-xl border border-border bg-surface p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-mono text-[10px] tracking-wider text-muted uppercase">
              Purchase &amp; Payments
            </p>

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

          <div className="mt-4">
            <div
              className="relative h-4 overflow-hidden rounded-full bg-[#f5f0eb]"
              role="img"
              aria-label={`Purchases ${formatINR(summary.purchases)}, payments ${formatINR(summary.payments)}, pending ${formatINR(summary.pending)}`}
            >
              {/* Full track = purchases; payments fill from left; remainder reads as pending */}
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-[#f8d4b8]"
                style={{
                  width: summary.purchases > 0 ? "100%" : "0%",
                }}
              />
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-[#e86f2a] transition-all"
                style={{ width: `${paidPct}%` }}
              />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <MetricStat
                label="Purchases"
                amount={summary.purchases}
                swatch="bg-[#f8d4b8]"
              />
              <MetricStat
                label="Payments"
                amount={summary.payments}
                swatch="bg-[#e86f2a]"
              />
              <MetricStat
                label="Pending"
                amount={summary.pending}
                amountClass="text-[#c45c26]"
                swatch="bg-[#f8d4b8] ring-1 ring-inset ring-[#e86f2a]/30"
              />
            </div>
          </div>
        </section>

        {tab === "invoices" ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <InvoiceList
              invoices={invoices}
              selectedId={selectedInvoice?.id ?? null}
              onSelect={handleSelect}
            />

            {selectedInvoice ? (
              <div className="hidden print:hidden lg:block">
                <div className="sticky top-4">
                  <InvoicePreview
                    invoice={selectedInvoice}
                    salesman={salesman}
                    onClose={() => setSelectedInvoice(null)}
                    onEdit={handleEdit}
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
        ) : (
          <div className="rounded-xl border border-border bg-surface px-4 py-12 text-center text-sm text-muted">
            {tab === "payments" && "Payments tab coming soon"}
            {tab === "requests" && "Item requests coming soon"}
            {tab === "details" && "Personal details coming soon"}
          </div>
        )}
        </main>

        <div className="shrink-0 border-t border-border bg-background px-4 py-3 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setAddInvoiceOpen(true)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-3 text-sm font-medium text-surface hover:bg-foreground/90 sm:ml-auto sm:w-auto sm:min-w-[12rem]"
          >
            <span className="text-lg leading-none">+</span>
            Add Invoice
          </button>
        </div>
      </div>

      {/* Mobile preview overlay — only after explicit select */}
      {selectedInvoice && mobilePreviewOpen && (
        <div className="lg:hidden print:hidden">
          <InvoicePreview
            invoice={selectedInvoice}
            salesman={salesman}
            asOverlay
            onClose={() => setMobilePreviewOpen(false)}
            onEdit={handleEdit}
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

      <Modal
        open={addInvoiceOpen}
        onClose={() => setAddInvoiceOpen(false)}
        title="Add Invoice"
        footer={
          <button
            type="button"
            onClick={() => setAddInvoiceOpen(false)}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-sidebar"
          >
            Close
          </button>
        }
      >
        <p className="text-sm text-muted">
          Invoice creation for this salesman is coming soon. This will open the
          full create-invoice flow.
        </p>
      </Modal>
    </>
  );
}

function MetricStat({
  label,
  amount,
  swatch,
  amountClass,
}: {
  label: string;
  amount: number;
  swatch: string;
  amountClass?: string;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <span className={`inline-block h-2 w-2 rounded-full ${swatch}`} />
        {label}
      </p>
      <p
        className={`mt-1 text-base font-medium tabular-nums sm:text-lg ${amountClass ?? ""}`}
      >
        {formatINR(amount)}
      </p>
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
