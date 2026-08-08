"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { AppContext } from "@/app/(app)/layout";
import { isCustomerDefaulter, withPendingBalance } from "@/lib/customers/defaulter";
import {
  CustomerOrderInvoiceModal,
  type CustomerOrderInvoiceCreated,
  type CustomerOrderInvoiceSubmitPayload,
} from "@/components/customer-orders/CustomerOrderInvoiceModal";
import { CustomerDirectInvoiceModal } from "@/components/customers/CustomerDirectInvoiceModal";
import { CustomerPastOrdersTab } from "@/components/customers/CustomerPastOrdersTab";
import { CustomerPendingPatchesTab } from "@/components/customers/CustomerPendingPatchesTab";
import { CustomerPersonalDetailsForm } from "@/components/customers/CustomerPersonalDetailsForm";
import { CustomerTimelineTab } from "@/components/customers/CustomerTimelineTab";
import { AppPage } from "@/components/layout/AppShell";
import { InvoiceList } from "@/components/salesmen/InvoiceList";
import { InvoicePreview } from "@/components/salesmen/InvoicePreview";
import { InvoicePrintChoiceModal } from "@/components/salesmen/InvoicePrintChoiceModal";
import { AddAdvancePaymentModal } from "@/components/salesmen/AddAdvancePaymentModal";
import { AddReturnModal } from "@/components/salesmen/AddReturnModal";
import { PaymentsList } from "@/components/salesmen/PaymentsList";
import { ReturnsList } from "@/components/salesmen/ReturnsList";
import { Modal } from "@/components/ui/Modal";
import type { PriceListItem } from "@/lib/auth/types";
import type { BankAccount } from "@/lib/bank-accounts/types";
import type {
  CustomerClothPatch,
  CustomerOrder,
  CustomerPendingItem,
} from "@/lib/customer-orders/types";
import { computeCustomerTierInsight } from "@/lib/customers/tier";
import {
  canEditInvoice,
  formatINR,
} from "@/lib/salesmen/mock-data";
import { shareInvoicePdfOnWhatsApp } from "@/lib/salesmen/share-invoice-pdf";
import type {
  Invoice,
  InvoiceLineItem,
  InvoicePaymentEntry,
  Salesman,
  SalesmanAdvance,
  SalesmanReturn,
} from "@/lib/salesmen/types";
import {
  CUSTOMER_TIER_LABELS,
  ENTITY_TYPE_LABELS,
  MARKET_DAY_LABELS,
} from "@/lib/salesmen/types";

type DetailTab =
  | "timeline"
  | "orders"
  | "invoices"
  | "payments"
  | "returns"
  | "pending"
  | "details";

type CustomerDetailClientProps = {
  context: AppContext;
  initialCustomer: Salesman;
  initialOrders: CustomerOrder[];
  initialInvoices: Invoice[];
  initialAdvances?: SalesmanAdvance[];
  initialReturns?: SalesmanReturn[];
  initialPending: CustomerPendingItem[];
  initialPatches: CustomerClothPatch[];
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
  initialAdvances = [],
  initialReturns = [],
  initialPending,
  initialPatches,
  bankAccounts,
  priceList,
}: CustomerDetailClientProps) {
  const router = useRouter();
  const [customer, setCustomer] = useState(initialCustomer);
  const [orders, setOrders] = useState(initialOrders);
  const [invoices, setInvoices] = useState(initialInvoices);
  const [advances, setAdvances] = useState<SalesmanAdvance[]>(initialAdvances);
  const [returns, setReturns] = useState<SalesmanReturn[]>(initialReturns);
  const [addPaymentOpen, setAddPaymentOpen] = useState(false);
  const [addReturnOpen, setAddReturnOpen] = useState(false);
  const [tab, setTab] = useState<DetailTab>("timeline");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceOrders, setInvoiceOrders] = useState<CustomerOrder[]>([]);
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [invoiceError, setInvoiceError] = useState("");
  const [directInvoiceModalOpen, setDirectInvoiceModalOpen] = useState(false);
  const [directInvoiceBusy, setDirectInvoiceBusy] = useState(false);
  const [directInvoiceError, setDirectInvoiceError] = useState("");
  const [editLockedOpen, setEditLockedOpen] = useState(false);
  const [deleteInvoiceOpen, setDeleteInvoiceOpen] = useState(false);
  const [deleteInvoiceBusy, setDeleteInvoiceBusy] = useState(false);
  const [deleteInvoiceError, setDeleteInvoiceError] = useState("");
  const [deleteLockedOpen, setDeleteLockedOpen] = useState(false);
  const [whatsAppPending, setWhatsAppPending] = useState(false);
  const [whatsAppError, setWhatsAppError] = useState("");
  const [editPending, startEditTransition] = useTransition();

  useEffect(() => {
    setCustomer(initialCustomer);
    setOrders(initialOrders);
    setInvoices(initialInvoices);
    setAdvances(initialAdvances);
    setReturns(initialReturns);
  }, [
    initialCustomer,
    initialOrders,
    initialInvoices,
    initialAdvances,
    initialReturns,
  ]);

  useEffect(() => {
    if (invoices.length === 0) {
      setSelectedInvoice(null);
      return;
    }
    setSelectedInvoice((current) => {
      if (current && invoices.some((inv) => inv.id === current.id)) {
        return current;
      }
      return invoices[0] ?? null;
    });
  }, [invoices]);

  const paymentCount = useMemo(
    () =>
      invoices.filter(
        (inv) =>
          inv.amountPaid > 0 ||
          (inv.paymentEntries != null && inv.paymentEntries.length > 0),
      ).length + advances.length,
    [invoices, advances],
  );

  const packedOrders = useMemo(
    () => orders.filter((o) => o.status === "packed"),
    [orders],
  );

  const openPendingCount = useMemo(
    () =>
      initialPending.filter(
        (p) =>
          p.status === "open" ||
          p.status === "in_dyeing" ||
          p.status === "ready",
      ).length,
    [initialPending],
  );

  const tierInsight = useMemo(
    () => computeCustomerTierInsight(orders, invoices),
    [orders, invoices],
  );

  const isDefaulter = isCustomerDefaulter(
    customer.pendingBalance,
    customer.balanceThreshold,
  );

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
          {MARKET_DAY_LABELS[customer.marketDay]}
        </span>
      ),
    });
  }

  const areaLabel =
    customer.area?.trim() ||
    customer.addressArea?.trim() ||
    "";
  if (areaLabel) {
    metaParts.push({
      key: "area",
      node: <span className="text-muted">{areaLabel}</span>,
    });
  }

  metaParts.push({
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
  });

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

  async function handleWhatsApp(invoice: Invoice) {
    if (whatsAppPending) return;
    setWhatsAppError("");
    setSelectedInvoice(invoice);
    setWhatsAppPending(true);
    try {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      await shareInvoicePdfOnWhatsApp({
        phone: customer.phone,
        invoice,
        partyName: customer.name,
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

  async function submitDirectInvoice(payload: {
    lineItems: InvoiceLineItem[];
    discountAmount: number;
    totalAmount: number;
    number: string;
    issuedAt: string;
  }): Promise<Invoice> {
    setDirectInvoiceBusy(true);
    setDirectInvoiceError("");
    try {
      const res = await fetch(`/api/customers/${customer.id}/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: payload.number,
          issuedAt: payload.issuedAt,
          lineItems: payload.lineItems,
          discountAmount: payload.discountAmount,
          paymentEntries: [],
          totalAmount: payload.totalAmount,
          amountPaid: 0,
        }),
      });
      const json = (await res.json()) as { invoice?: Invoice; error?: string };
      if (!res.ok || !json.invoice) {
        throw new Error(json.error ?? "Failed to generate invoice");
      }
      setInvoices((prev) => [json.invoice!, ...prev]);
      setSelectedInvoice(json.invoice);
      setDirectInvoiceModalOpen(false);
      router.refresh();
      return json.invoice;
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to generate invoice";
      setDirectInvoiceError(message);
      throw e instanceof Error ? e : new Error(message);
    } finally {
      setDirectInvoiceBusy(false);
    }
  }

  async function submitInvoices(
    payload: CustomerOrderInvoiceSubmitPayload,
  ): Promise<CustomerOrderInvoiceCreated[]> {
    if (payload.orderIds.length === 0) {
      throw new Error("No packed orders to invoice");
    }
    setInvoiceBusy(true);
    setInvoiceError("");
    try {
      const created: CustomerOrderInvoiceCreated[] = [];
      for (const orderId of payload.orderIds) {
        const options = payload.invoicesByOrder[orderId];
        const res = await fetch(
          `/api/customer-orders/${orderId}/convert-invoice`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              discountAmount: options?.discountAmount ?? 0,
              paymentEntries: options?.paymentEntries ?? [],
              lineQtyOverrides: options?.lineQtyOverrides,
              lineUnitPriceOverrides: options?.lineUnitPriceOverrides,
            }),
          },
        );
        const json = (await res.json()) as {
          invoice?: Invoice;
          order?: CustomerOrder;
          error?: string;
        };
        if (!res.ok || !json.invoice) {
          throw new Error(json.error ?? "Failed to generate invoice");
        }
        created.push({
          invoice: json.invoice,
          customerId: customer.id,
          orderId,
        });
        if (json.order) {
          setOrders((prev) =>
            prev.map((o) => (o.id === json.order!.id ? json.order! : o)),
          );
        } else {
          setOrders((prev) =>
            prev.map((o) =>
              o.id === orderId
                ? { ...o, status: "invoiced", invoiceId: json.invoice!.id }
                : o,
            ),
          );
        }
      }
      const invoicesOnly = created.map((c) => c.invoice);
      setInvoices((prev) => [...invoicesOnly, ...prev]);
      const first = invoicesOnly[0];
      if (first) {
        setSelectedInvoice(first);
        setTab("invoices");
      }
      router.refresh();
      return created;
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to generate invoice";
      setInvoiceError(message);
      throw e instanceof Error ? e : new Error(message);
    } finally {
      setInvoiceBusy(false);
    }
  }

  return (
    <>
      <AppPage
        context={context}
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Customers", href: "/entities/customers" },
          { label: customer.name },
        ]}
        className="flex min-h-0 flex-col print:hidden px-0 py-0"
        beforeMain={
          isDefaulter ? (
            <div
              role="alert"
              className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950 sm:px-6 lg:px-8 print:hidden"
            >
              <div className="mx-auto flex max-w-6xl items-start gap-3">
                <span
                  className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full bg-red-500"
                  aria-hidden
                />
                <div>
                  <p className="font-medium">Defaulter — collect payment ASAP</p>
                  <p className="mt-0.5 text-red-900/80">
                    This customer&apos;s pending balance of{" "}
                    {formatINR(customer.pendingBalance)} has crossed the threshold
                    of {formatINR(customer.balanceThreshold!)}. Collect payment as
                    soon as possible.
                  </p>
                </div>
              </div>
            </div>
          ) : undefined
        }
      >
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
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
                    ? "text-warning"
                    : "text-foreground"
                }`}
              >
                {formatINR(customer.pendingBalance)}
              </p>
            </div>
          </div>

          <div className="mb-5 inline-flex max-w-full overflow-x-auto rounded-lg border border-border bg-surface p-0.5 sm:mb-6">
            <TabButton
              active={tab === "timeline"}
              onClick={() => setTab("timeline")}
              label="Timeline"
            />
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
              active={tab === "returns"}
              onClick={() => setTab("returns")}
              label={`Returns (${returns.length})`}
            />
            <TabButton
              active={tab === "pending"}
              onClick={() => setTab("pending")}
              label={`Dyeing Requests (${openPendingCount})`}
            />
            <TabButton
              active={tab === "details"}
              onClick={() => setTab("details")}
              label="Personal Details"
            />
          </div>

          {tab === "timeline" ? (
            <CustomerTimelineTab orders={orders} invoices={invoices} />
          ) : tab === "orders" ? (
            <CustomerPastOrdersTab
              orders={orders}
              invoices={invoices}
              customer={customer}
              priceList={priceList}
              onOrderUpdated={(order) =>
                setOrders((prev) =>
                  prev.map((o) => (o.id === order.id ? order : o)),
                )
              }
              onOrderDeleted={(id) =>
                setOrders((prev) => prev.filter((o) => o.id !== id))
              }
              onRequestInvoice={(id) => {
                const order = orders.find((o) => o.id === id);
                if (!order || order.status !== "packed") return;
                setInvoiceError("");
                setInvoiceOrders([order]);
                setInvoiceModalOpen(true);
              }}
            />
          ) : tab === "invoices" ? (
            <div>
              <div className="sticky top-0 z-10 -mx-4 mb-4 flex flex-col gap-3 bg-background px-4 py-3 sm:-mx-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:-mx-8 lg:px-8">
                <h2 className="text-lg font-medium tracking-tight">
                  Invoices ({invoices.length})
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDirectInvoiceError("");
                      setDirectInvoiceModalOpen(true);
                    }}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-foreground px-3.5 py-2 text-sm font-medium text-surface hover:bg-foreground/90"
                  >
                    <span className="text-base leading-none">+</span>
                    Generate invoice
                  </button>
                  {packedOrders.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setInvoiceError("");
                        setInvoiceOrders(packedOrders);
                        setInvoiceModalOpen(true);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium hover:bg-sidebar"
                    >
                      From packed orders ({packedOrders.length})
                    </button>
                  ) : null}
                </div>
              </div>

              {invoices.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-16 text-center text-sm text-muted">
                  No invoices yet. Use Generate invoice above to create one
                  {packedOrders.length > 0 ? " or bill from packed orders." : "."}
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
                  <InvoiceList
                    invoices={invoices}
                    selectedId={selectedInvoice?.id ?? null}
                    onSelect={handleSelect}
                  />

                  {selectedInvoice ? (
                    <div className="hidden print:hidden lg:block">
                      <div className="sticky top-4 flex max-h-[calc(100dvh-6rem)] flex-col">
                        <InvoicePreview
                          invoice={selectedInvoice}
                          salesman={customer}
                          previousBalance={customer.pendingBalance}
                          onClose={() => setSelectedInvoice(null)}
                          onEdit={handleEdit}
                          editPending={editPending}
                          onDelete={handleDeleteClick}
                          onPrint={() => setPrintInvoice(selectedInvoice)}
                          onWhatsApp={() => handleWhatsApp(selectedInvoice)}
                          whatsAppPending={whatsAppPending}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="hidden items-center justify-center rounded-xl border border-dashed border-border bg-surface px-4 py-16 text-sm text-muted lg:flex">
                      Select an invoice to preview
                    </div>
                  )}
                </div>
              )}
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
          ) : tab === "pending" ? (
            <CustomerPendingPatchesTab
              customerId={customer.id}
              customerName={customer.name}
              phone={customer.phone}
              priceList={priceList}
              initialPending={initialPending}
              initialPatches={initialPatches}
            />
          ) : (
            <CustomerPersonalDetailsForm
              customer={customer}
              priceList={priceList}
              tierInsight={tierInsight}
              onSaved={setCustomer}
            />
          )}
        </div>
      </AppPage>

      {selectedInvoice && mobilePreviewOpen && tab === "invoices" && (
        <div className="lg:hidden print:hidden">
          <InvoicePreview
            invoice={selectedInvoice}
            salesman={customer}
            previousBalance={customer.pendingBalance}
            asOverlay
            onClose={() => setMobilePreviewOpen(false)}
            onEdit={handleEdit}
            editPending={editPending}
            onDelete={handleDeleteClick}
            onPrint={() => setPrintInvoice(selectedInvoice)}
            onWhatsApp={() => handleWhatsApp(selectedInvoice)}
            whatsAppPending={whatsAppPending}
          />
        </div>
      )}

      {selectedInvoice && (
        <div className="hidden print:block">
          <InvoicePreview
            invoice={selectedInvoice}
            salesman={customer}
            previousBalance={customer.pendingBalance}
            forPrint
            onClose={() => undefined}
            onEdit={() => undefined}
            onPrint={() => undefined}
            onWhatsApp={() => undefined}
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

      <CustomerDirectInvoiceModal
        open={directInvoiceModalOpen}
        onClose={() => {
          if (directInvoiceBusy) return;
          setDirectInvoiceModalOpen(false);
          setDirectInvoiceError("");
        }}
        customer={customer}
        priceList={priceList}
        busy={directInvoiceBusy}
        error={directInvoiceError}
        onSubmit={submitDirectInvoice}
      />

      <CustomerOrderInvoiceModal
        open={invoiceModalOpen}
        onClose={() => {
          if (invoiceBusy) return;
          setInvoiceModalOpen(false);
          setInvoiceOrders([]);
          setInvoiceError("");
        }}
        orders={invoiceOrders}
        customers={[customer]}
        priceList={priceList}
        busy={invoiceBusy}
        error={invoiceError}
        onSubmit={submitInvoices}
      />

      <InvoicePrintChoiceModal
        open={Boolean(printInvoice)}
        onClose={() => setPrintInvoice(null)}
        invoice={printInvoice}
        party={customer}
        previousBalance={customer.pendingBalance}
        title="Print invoice"
        description="Print a priced copy for records, or a delivery copy without prices."
      />

      <Modal
        open={editLockedOpen}
        onClose={() => setEditLockedOpen(false)}
        title="Edit window closed"
      >
        <p className="text-sm text-muted">
          Invoices can only be edited within 1 day of creation.
        </p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => setEditLockedOpen(false)}
            className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-surface"
          >
            OK
          </button>
        </div>
      </Modal>

      <Modal
        open={deleteLockedOpen}
        onClose={() => setDeleteLockedOpen(false)}
        title="Delete locked"
      >
        <p className="text-sm text-muted">
          Invoices can only be deleted within 1 day of creation (same window as
          edit).
        </p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => setDeleteLockedOpen(false)}
            className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-surface"
          >
            OK
          </button>
        </div>
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
          returns.
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
        salesmanId={customer.id}
        partyName={customer.name}
        bankAccounts={bankAccounts}
        onCreated={(advance) => {
          setAdvances((prev) => [advance, ...prev]);
          if (advance.verificationStatus === "verified") {
            setCustomer((prev) =>
              withPendingBalance(prev, prev.pendingBalance - advance.amount),
            );
          }
          router.refresh();
        }}
      />

      <AddReturnModal
        open={addReturnOpen}
        onClose={() => setAddReturnOpen(false)}
        salesmanId={customer.id}
        partyName={customer.name}
        priceList={priceList}
        onCreated={(returnRecord) => {
          setReturns((prev) => [returnRecord, ...prev]);
          if (returnRecord.verificationStatus === "verified") {
            setCustomer((prev) =>
              withPendingBalance(
                prev,
                prev.pendingBalance - returnRecord.totalAmount,
              ),
            );
          }
          router.refresh();
        }}
      />
    </>
  );
}
