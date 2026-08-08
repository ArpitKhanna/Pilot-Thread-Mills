"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { AppPage } from "@/components/layout/AppShell";
import { Modal } from "@/components/ui/Modal";
import { PendingLink } from "@/components/ui/PendingLink";
import type { AppContext } from "@/app/(app)/layout";
import { InvoiceList } from "@/components/salesmen/InvoiceList";
import { InvoicePreview } from "@/components/salesmen/InvoicePreview";
import { ItemRequestsList } from "@/components/salesmen/ItemRequestsList";
import { AddAdvancePaymentModal } from "@/components/salesmen/AddAdvancePaymentModal";
import { AddReturnModal } from "@/components/salesmen/AddReturnModal";
import { PaymentsList } from "@/components/salesmen/PaymentsList";
import { ReturnsList } from "@/components/salesmen/ReturnsList";
import { PersonalDetailsForm } from "@/components/salesmen/PersonalDetailsForm";
import type { BankAccount } from "@/lib/bank-accounts/types";
import type { PriceListItem } from "@/lib/auth/types";
import {
  canEditInvoice,
  formatINR,
} from "@/lib/salesmen/mock-data";
import { shareInvoicePdfOnWhatsApp } from "@/lib/salesmen/share-invoice-pdf";
import type {
  Invoice,
  ItemRequest,
  Salesman,
  SalesmanAdvance,
  SalesmanReturn,
} from "@/lib/salesmen/types";
import { ENTITY_TYPE_LABELS } from "@/lib/salesmen/types";

type DetailTab =
  | "invoices"
  | "payments"
  | "returns"
  | "requests"
  | "details";

type SalesmanDetailClientProps = {
  context: AppContext;
  initialSalesman: Salesman;
  initialInvoices: Invoice[];
  initialItemRequests: ItemRequest[];
  initialAdvances?: SalesmanAdvance[];
  initialReturns?: SalesmanReturn[];
  priceList: PriceListItem[];
  bankAccounts: BankAccount[];
  initialTab?: DetailTab;
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
  initialAdvances = [],
  initialReturns = [],
  priceList,
  bankAccounts,
  initialTab = "invoices",
}: SalesmanDetailClientProps) {
  const router = useRouter();
  const [editPending, startEditTransition] = useTransition();
  const [salesman, setSalesman] = useState(initialSalesman);
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [itemRequests, setItemRequests] = useState(initialItemRequests);
  const [advances, setAdvances] = useState<SalesmanAdvance[]>(initialAdvances);
  const [returns, setReturns] = useState<SalesmanReturn[]>(initialReturns);
  const [addPaymentOpen, setAddPaymentOpen] = useState(false);
  const [addReturnOpen, setAddReturnOpen] = useState(false);
  const [deleteInvoiceOpen, setDeleteInvoiceOpen] = useState(false);
  const [deleteInvoiceBusy, setDeleteInvoiceBusy] = useState(false);
  const [deleteInvoiceError, setDeleteInvoiceError] = useState("");
  const [deleteLockedOpen, setDeleteLockedOpen] = useState(false);

  const paymentCount = useMemo(
    () =>
      invoices.filter(
        (inv) =>
          inv.amountPaid > 0 ||
          (inv.paymentEntries != null && inv.paymentEntries.length > 0),
      ).length + advances.length,
    [invoices, advances],
  );

  const openRequestCount = useMemo(
    () => itemRequests.filter((r) => r.status === "open").length,
    [itemRequests],
  );

  const [tab, setTab] = useState<DetailTab>(initialTab);
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(
    () => initialInvoices[0] ?? null,
  );
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [editLockedOpen, setEditLockedOpen] = useState(false);
  const [whatsAppPending, setWhatsAppPending] = useState(false);
  const [whatsAppError, setWhatsAppError] = useState("");

  useEffect(() => {
    setSalesman(initialSalesman);
    setInvoices(initialInvoices);
    setItemRequests(initialItemRequests);
    setAdvances(initialAdvances);
    setReturns(initialReturns);
  }, [initialSalesman, initialInvoices, initialItemRequests, initialAdvances, initialReturns]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

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

  function handleDeleteClick() {
    if (!selectedInvoice) return;
    if (!canEditInvoice(selectedInvoice)) {
      setDeleteLockedOpen(true);
      return;
    }
    setDeleteInvoiceError("");
    setDeleteInvoiceOpen(true);
  }

  async function confirmDeleteInvoice() {
    if (!selectedInvoice || deleteInvoiceBusy) return;
    setDeleteInvoiceBusy(true);
    setDeleteInvoiceError("");
    try {
      const res = await fetch(`/api/salesmen-invoices/${selectedInvoice.id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Could not delete invoice.");
      }
      const deletedId = selectedInvoice.id;
      setInvoices((prev) => prev.filter((inv) => inv.id !== deletedId));
      setSelectedInvoice(null);
      setDeleteInvoiceOpen(false);
      setMobilePreviewOpen(false);
      router.refresh();
    } catch (err) {
      setDeleteInvoiceError(
        err instanceof Error ? err.message : "Could not delete invoice.",
      );
    } finally {
      setDeleteInvoiceBusy(false);
    }
  }

  function handlePrint(invoice: Invoice) {
    setSelectedInvoice(invoice);
    requestAnimationFrame(() => {
      window.setTimeout(() => window.print(), 50);
    });
  }

  async function handleWhatsApp(invoice: Invoice) {
    if (whatsAppPending) return;
    setWhatsAppError("");
    setSelectedInvoice(invoice);
    setWhatsAppPending(true);
    try {
      // Ensure #invoice-print-root is mounted with this invoice before capture.
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      await shareInvoicePdfOnWhatsApp({
        phone: salesman.phone,
        invoice,
        partyName: salesman.name,
      });
    } catch (err) {
      setWhatsAppError(
        err instanceof Error
          ? err.message
          : "Could not generate the PDF. WhatsApp opened with invoice details.",
      );
    } finally {
      setWhatsAppPending(false);
    }
  }

  const invoiceBalances = useMemo(() => {
    const sorted = [...invoices].sort((a, b) => {
      const byDate =
        new Date(a.issuedAt).getTime() - new Date(b.issuedAt).getTime();
      if (byDate !== 0) return byDate;
      return a.number.localeCompare(b.number);
    });
    const previousById = new Map<string, number>();
    const chargedById = new Map<string, number>();
    const closingById = new Map<string, number>();
    let running = salesman.openingBalance;
    for (const inv of sorted) {
      const previous = Math.round(running * 100) / 100;
      previousById.set(inv.id, previous);
      const charged = Math.round((previous + inv.totalAmount) * 100) / 100;
      chargedById.set(inv.id, charged);
      running =
        Math.round((previous + inv.totalAmount - inv.amountPaid) * 100) / 100;
      closingById.set(inv.id, running);
    }
    return { previousById, chargedById, closingById };
  }, [invoices, salesman.openingBalance]);

  function previousBalanceForInvoice(invoice: Invoice): number {
    return (
      invoiceBalances.previousById.get(invoice.id) ??
      Math.round(
        (salesman.pendingBalance -
          (invoice.totalAmount - invoice.amountPaid)) *
          100,
      ) / 100
    );
  }

  return (
    <>
      <AppPage
        context={context}
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Salesmen", href: "/entities/salesmen" },
          { label: salesman.name },
        ]}
        className="flex min-h-0 flex-col print:hidden px-0 py-0"
      >
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
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
              <span className="text-muted">
                {ENTITY_TYPE_LABELS[salesman.entityType]}
              </span>
            </p>
          </div>
          <div className="shrink-0 text-left sm:text-right">
            <p className="font-mono text-[10px] tracking-wider text-muted uppercase">
              Pending Balance
            </p>
            <p
              className={`mt-0.5 text-xl font-medium tracking-tight sm:text-2xl ${
                salesman.pendingBalance > 0
                  ? "text-[#c45c26]"
                  : salesman.pendingBalance < 0
                    ? "text-credit"
                    : "text-foreground"
              }`}
            >
              {formatINR(salesman.pendingBalance)}
              {salesman.pendingBalance < 0 ? (
                <span className="ml-2 text-sm font-normal text-muted">
                  credit
                </span>
              ) : null}
            </p>
          </div>
        </div>

        <div className="mb-5 inline-flex max-w-full overflow-x-auto rounded-lg border border-border bg-surface p-0.5 sm:mb-6">
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
              active={tab === "returns"}
              onClick={() => setTab("returns")}
              label={`Returns (${returns.length})`}
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

        {tab === "invoices" ? (
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
                chargedTotalById={invoiceBalances.chargedById}
                closingDueById={invoiceBalances.closingById}
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
                      onDelete={handleDeleteClick}
                      onPrint={() => handlePrint(selectedInvoice)}
                      onWhatsApp={() => handleWhatsApp(selectedInvoice)}
                      whatsAppPending={whatsAppPending}
                      previousBalance={previousBalanceForInvoice(
                        selectedInvoice,
                      )}
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
          <PaymentsList
            invoices={invoices}
            advances={advances}
            bankAccounts={bankAccounts}
            onAdvancesChange={setAdvances}
            onInvoicesChange={setInvoices}
            onAddPayment={() => setAddPaymentOpen(true)}
            onLedgerChanged={() => router.refresh()}
          />
        ) : tab === "returns" ? (
          <ReturnsList
            returns={returns}
            onReturnsChange={setReturns}
            onAddReturn={() => setAddReturnOpen(true)}
            onLedgerChanged={() => router.refresh()}
          />
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
        </div>
      </AppPage>

      {selectedInvoice && mobilePreviewOpen && (
        <div className="lg:hidden print:hidden">
          <InvoicePreview
            invoice={selectedInvoice}
            salesman={salesman}
            asOverlay
            onClose={() => setMobilePreviewOpen(false)}
            onEdit={handleEdit}
            editPending={editPending}
            onDelete={handleDeleteClick}
            onPrint={() => handlePrint(selectedInvoice)}
            onWhatsApp={() => handleWhatsApp(selectedInvoice)}
            whatsAppPending={whatsAppPending}
            previousBalance={previousBalanceForInvoice(selectedInvoice)}
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
            previousBalance={previousBalanceForInvoice(selectedInvoice)}
          />
        </div>
      )}

      {whatsAppError ? (
        <p
          role="alert"
          className="fixed bottom-4 left-1/2 z-50 max-w-md -translate-x-1/2 rounded-lg border border-border bg-surface px-4 py-2 text-center text-sm text-red-600 shadow-lg print:hidden"
        >
          {whatsAppError}
        </p>
      ) : null}

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
          1 day of generation so prices stay consistent.
        </p>
      </Modal>

      <Modal
        open={deleteLockedOpen}
        onClose={() => setDeleteLockedOpen(false)}
        title="Delete locked"
        footer={
          <button
            type="button"
            onClick={() => setDeleteLockedOpen(false)}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-sidebar"
          >
            Close
          </button>
        }
      >
        <p className="text-sm text-muted">
          This invoice can no longer be deleted. Deletion is only allowed within
          1 day of generation (same window as edit).
        </p>
      </Modal>

      <Modal
        open={deleteInvoiceOpen}
        onClose={() => {
          if (deleteInvoiceBusy) return;
          setDeleteInvoiceOpen(false);
          setDeleteInvoiceError("");
        }}
        title="Delete invoice"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={deleteInvoiceBusy}
              onClick={() => {
                setDeleteInvoiceOpen(false);
                setDeleteInvoiceError("");
              }}
              className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-sidebar disabled:opacity-40"
            >
              Keep
            </button>
            <button
              type="button"
              disabled={deleteInvoiceBusy}
              onClick={() => void confirmDeleteInvoice()}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
            >
              {deleteInvoiceBusy ? "Deleting…" : "Delete"}
            </button>
          </div>
        }
      >
        <p className="text-sm text-muted">
          Permanently delete this invoice and restore any applied advances or
          returns. This cannot be undone.
        </p>
        {deleteInvoiceError && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {deleteInvoiceError}
          </div>
        )}
      </Modal>

      <AddAdvancePaymentModal
        open={addPaymentOpen}
        onClose={() => setAddPaymentOpen(false)}
        salesmanId={salesman.id}
        partyName={salesman.name}
        bankAccounts={bankAccounts}
        onCreated={(advance) => {
          setAdvances((prev) => [advance, ...prev]);
          if (advance.verificationStatus === "verified") {
            setSalesman((prev) => ({
              ...prev,
              pendingBalance: Math.max(
                0,
                Math.round((prev.pendingBalance - advance.amount) * 100) / 100,
              ),
            }));
          }
          router.refresh();
        }}
      />

      <AddReturnModal
        open={addReturnOpen}
        onClose={() => setAddReturnOpen(false)}
        salesmanId={salesman.id}
        partyName={salesman.name}
        priceList={priceList}
        onCreated={(returnRecord) => {
          setReturns((prev) => [returnRecord, ...prev]);
          if (returnRecord.verificationStatus === "verified") {
            setSalesman((prev) => ({
              ...prev,
              pendingBalance: Math.max(
                0,
                Math.round(
                  (prev.pendingBalance - returnRecord.totalAmount) * 100,
                ) / 100,
              ),
            }));
          }
          router.refresh();
        }}
      />
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
