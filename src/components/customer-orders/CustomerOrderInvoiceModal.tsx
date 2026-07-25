"use client";

import { useEffect, useMemo, useState } from "react";
import { InvoicePaymentsStep } from "@/components/salesmen/InvoicePaymentsStep";
import { InvoicePreview } from "@/components/salesmen/InvoicePreview";
import { Modal } from "@/components/ui/Modal";
import type { PriceListItem } from "@/lib/auth/types";
import type { BankAccount } from "@/lib/bank-accounts/types";
import {
  matchCustomerPriceRule,
  resolveCustomerUnitPrice,
} from "@/lib/customers/price-rules";
import type {
  CustomerOrder,
  DeliveryStaff,
} from "@/lib/customer-orders/types";
import { formatINR } from "@/lib/salesmen/mock-data";
import type {
  Invoice,
  InvoiceLineItem,
  InvoicePaymentEntry,
  Salesman,
} from "@/lib/salesmen/types";

type BuilderStep = 1 | 2;

type PricedLine = {
  orderLineId: string;
  key: string;
  priceListItemId: string | null;
  name: string;
  itemName: string;
  qty: string;
  unitPrice: number;
  amount: number;
  listPrice: number;
  ruleDescription: string | null;
  /** True when price came from a manual/unmatched line and can be edited */
  priceEditable: boolean;
};

type OrderDraft = {
  lines: PricedLine[];
  additionalDiscount: string;
  payments: InvoicePaymentEntry[];
};

export type CustomerOrderInvoiceSubmitPayload = {
  orderIds: string[];
  deliveryBy: string;
  invoicesByOrder: Record<
    string,
    {
      discountAmount: number;
      paymentEntries: InvoicePaymentEntry[];
      lineQtyOverrides: Record<string, number>;
      lineUnitPriceOverrides: Record<string, number>;
    }
  >;
};

function matchCatalogByName(
  priceList: PriceListItem[],
  itemName: string,
): PriceListItem | undefined {
  const needle = itemName.trim().toLowerCase();
  if (!needle) return undefined;
  const exact = priceList.find(
    (p) => p.item_name.trim().toLowerCase() === needle,
  );
  if (exact) return exact;
  return priceList.find((p) => {
    const name = p.item_name.trim().toLowerCase();
    return name.includes(needle) || needle.includes(name);
  });
}

type CustomerOrderInvoiceModalProps = {
  open: boolean;
  onClose: () => void;
  orders: CustomerOrder[];
  customers: Salesman[];
  priceList: PriceListItem[];
  deliveryStaff: DeliveryStaff[];
  bankAccounts: BankAccount[];
  busy?: boolean;
  error?: string;
  onSubmit: (payload: CustomerOrderInvoiceSubmitPayload) => void | Promise<void>;
};

function placeholderCustomer(name = "Customer"): Salesman {
  return {
    id: "preview-placeholder",
    name,
    phone: "",
    alternatePhone: "",
    entityType: "customer",
    isActive: true,
    openingBalance: 0,
    pendingBalance: 0,
    lastInvoiceAt: null,
    discountRules: [],
    marketDay: "",
    area: "",
    isDefaulter: false,
    tier: "",
    balanceThreshold: null,
    contactName: "",
    addressBuilding: "",
    addressArea: "",
    addressCity: "",
    addressState: "",
    addressPincode: "",
    mapLat: null,
    mapLng: null,
    tierRubric: {
      orderFrequency: null,
      orderAmount: null,
      paymentAmount: null,
      paymentSpeed: null,
    },
    priceRules: [],
  };
}

function buildPricedLines(
  order: CustomerOrder,
  customer: Salesman | null,
  priceList: PriceListItem[],
): PricedLine[] {
  const rules = customer?.priceRules ?? [];
  return order.lines
    .filter(
      (line) =>
        line.qty > 0 &&
        Boolean(
          line.itemName?.trim() ||
            line.priceListItemId ||
            line.shadeCode.trim(),
        ),
    )
    .map((line) => {
      const catalog =
        (line.priceListItemId
          ? priceList.find((p) => p.id === line.priceListItemId)
          : undefined) ??
        (line.itemName ? matchCatalogByName(priceList, line.itemName) : undefined);
      const itemName =
        (line.itemName?.trim() || catalog?.item_name || "Item").trim() || "Item";
      const listPrice = catalog ? Number(catalog.customer_price) : 0;
      const priceListItemId = catalog?.id ?? line.priceListItemId ?? null;
      const unitPrice = resolveCustomerUnitPrice(listPrice, rules, {
        priceListItemId,
        itemName,
        priceList,
      });
      const rule = matchCustomerPriceRule(rules, {
        priceListItemId,
        itemName,
        priceList,
      });
      const qty = line.qty > 0 ? line.qty : 0;
      const name = line.shadeCode
        ? `${itemName} — ${line.shadeCode}`
        : itemName;
      return {
        orderLineId: line.id,
        key: line.id,
        priceListItemId,
        name,
        itemName,
        qty: String(qty),
        unitPrice,
        amount: Math.round(unitPrice * qty * 100) / 100,
        listPrice,
        ruleDescription: rule?.description ?? null,
        priceEditable: !catalog || unitPrice <= 0,
      };
    });
}

function emptyDraft(
  order: CustomerOrder,
  customer: Salesman | null,
  priceList: PriceListItem[],
): OrderDraft {
  return {
    lines: buildPricedLines(order, customer, priceList),
    additionalDiscount: "",
    payments: [],
  };
}

export function CustomerOrderInvoiceModal({
  open,
  onClose,
  orders,
  customers,
  priceList,
  deliveryStaff,
  bankAccounts,
  busy = false,
  error,
  onSubmit,
}: CustomerOrderInvoiceModalProps) {
  const [step, setStep] = useState<BuilderStep>(1);
  const [activeOrderId, setActiveOrderId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, OrderDraft>>({});
  const [deliveryBy, setDeliveryBy] = useState("");
  const [localError, setLocalError] = useState("");
  const [paymentFieldErrors, setPaymentFieldErrors] = useState<
    Record<
      string,
      {
        amount?: string;
        chequeNumber?: string;
        depositAccountId?: string;
      }
    >
  >({});
  const [draftNumber] = useState(() => `INV-CU-${Date.now()}`);
  const [issuedAt] = useState(() => new Date().toISOString());

  useEffect(() => {
    if (!open || orders.length === 0) return;
    const nextDrafts: Record<string, OrderDraft> = {};
    for (const order of orders) {
      const customer =
        customers.find((c) => c.id === order.customerId) ?? null;
      nextDrafts[order.id] = emptyDraft(order, customer, priceList);
    }
    setDrafts(nextDrafts);
    setActiveOrderId(orders[0]!.id);
    setDeliveryBy("");
    setStep(1);
    setLocalError("");
    setPaymentFieldErrors({});
  }, [open, orders, customers, priceList]);

  const activeOrder =
    orders.find((o) => o.id === activeOrderId) ?? orders[0] ?? null;
  const customer = activeOrder
    ? (customers.find((c) => c.id === activeOrder.customerId) ?? null)
    : null;
  const customerName =
    customer?.name ?? activeOrder?.customerName ?? "Customer";
  const draft = activeOrder ? drafts[activeOrder.id] : undefined;

  const filledLines = useMemo(
    () =>
      (draft?.lines ?? []).filter(
        (l) => l.name.trim() && Number(l.qty) > 0 && l.unitPrice > 0,
      ),
    [draft?.lines],
  );

  const subtotal = useMemo(
    () => filledLines.reduce((sum, l) => sum + l.amount, 0),
    [filledLines],
  );

  const additionalNum = Number(draft?.additionalDiscount ?? "");
  const discountAmount =
    Number.isFinite(additionalNum) && additionalNum > 0 ? additionalNum : 0;
  const invoiceTotal = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);
  const amountPaid = useMemo(
    () => (draft?.payments ?? []).reduce((sum, p) => sum + (p.amount || 0), 0),
    [draft?.payments],
  );
  const previousBalance = customer?.pendingBalance ?? 0;

  const appliedRules = useMemo(() => {
    const seen = new Set<string>();
    const rules: string[] = [];
    for (const line of draft?.lines ?? []) {
      if (!line.ruleDescription || seen.has(line.ruleDescription)) continue;
      seen.add(line.ruleDescription);
      rules.push(line.ruleDescription);
    }
    return rules;
  }, [draft?.lines]);

  const liveInvoice: Invoice = useMemo(() => {
    const lineItems: InvoiceLineItem[] = filledLines.map((l) => ({
      id: l.key,
      name: l.name,
      qty: Number(l.qty),
      unitPrice: l.unitPrice,
      amount: l.amount,
      priceListItemId: l.priceListItemId ?? undefined,
    }));
    return {
      id: activeOrder?.id ?? "draft",
      number: draftNumber,
      salesmanId: activeOrder?.customerId ?? customer?.id ?? "",
      issuedAt,
      itemCount: lineItems.length,
      totalAmount: invoiceTotal,
      amountPaid,
      lineItems,
      discountAmount: discountAmount > 0 ? discountAmount : undefined,
      paymentEntries:
        (draft?.payments.length ?? 0) > 0 ? draft?.payments : undefined,
    };
  }, [
    filledLines,
    activeOrder?.id,
    activeOrder?.customerId,
    draftNumber,
    customer?.id,
    issuedAt,
    invoiceTotal,
    amountPaid,
    discountAmount,
    draft?.payments,
  ]);

  const previewCustomer: Salesman = customer
    ? customer
    : {
        ...placeholderCustomer(customerName),
        id: activeOrder?.customerId ?? "preview-placeholder",
      };

  function updateActiveDraft(patch: Partial<OrderDraft>) {
    if (!activeOrder) return;
    setDrafts((prev) => ({
      ...prev,
      [activeOrder.id]: {
        ...(prev[activeOrder.id] ?? emptyDraft(activeOrder, customer, priceList)),
        ...patch,
      },
    }));
  }

  function updateLineQty(key: string, qty: string) {
    if (!activeOrder || !draft) return;
    const lines = draft.lines.map((line) => {
      if (line.key !== key) return line;
      const qtyNum = Number(qty);
      const q = Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : 0;
      return {
        ...line,
        qty,
        amount: Math.round(line.unitPrice * q * 100) / 100,
      };
    });
    updateActiveDraft({ lines });
  }

  function updateLineUnitPrice(key: string, raw: string) {
    if (!activeOrder || !draft) return;
    const priceNum = Number(raw);
    const unitPrice =
      Number.isFinite(priceNum) && priceNum >= 0
        ? Math.round(priceNum * 100) / 100
        : 0;
    const lines = draft.lines.map((line) => {
      if (line.key !== key) return line;
      const qtyNum = Number(line.qty);
      const q = Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : 0;
      return {
        ...line,
        unitPrice,
        amount: Math.round(unitPrice * q * 100) / 100,
      };
    });
    updateActiveDraft({ lines });
  }

  function validateOrderDraft(order: CustomerOrder, orderDraft: OrderDraft): string | null {
    if (!order.customerId) {
      return "Order is missing a customer.";
    }
    const filled = orderDraft.lines.filter(
      (l) => l.name.trim() && Number(l.qty) > 0 && l.unitPrice > 0,
    );
    if (filled.length === 0) {
      return `Add quantities and prices for ${order.customerName ?? "this order"}.`;
    }
    const missingPrice = orderDraft.lines.some(
      (l) => Number(l.qty) > 0 && (!(l.name.trim()) || l.unitPrice <= 0),
    );
    if (missingPrice) {
      return `Every line for ${order.customerName ?? "this order"} needs a name and customer price.`;
    }
    return null;
  }

  function validatePayments(payments: InvoicePaymentEntry[]): boolean {
    const next: typeof paymentFieldErrors = {};
    for (const payment of payments) {
      const field: (typeof next)[string] = {};
      if (!(payment.amount > 0)) {
        field.amount = "Enter an amount greater than zero.";
      }
      if (payment.method === "cheque") {
        if (!payment.chequeNumber?.trim()) {
          field.chequeNumber = "Cheque number is required.";
        }
        if (!payment.depositAccountId) {
          field.depositAccountId = "Select a deposit account.";
        }
      }
      if (payment.method === "upi" || payment.method === "imps") {
        if (!payment.depositAccountId) {
          field.depositAccountId = "Select a deposit account.";
        }
      }
      if (Object.keys(field).length > 0) {
        next[payment.id] = field;
      }
    }
    setPaymentFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  function goToPayments() {
    if (!activeOrder || !draft) return;
    const err = validateOrderDraft(activeOrder, draft);
    if (err) {
      setLocalError(err);
      return;
    }
    setLocalError("");
    setStep(2);
  }

  async function handleSubmit() {
    if (orders.length === 0) return;
    if (!deliveryBy) {
      setLocalError("Select a delivery person.");
      return;
    }

    for (const order of orders) {
      const orderDraft = drafts[order.id];
      if (!orderDraft) {
        setLocalError("Invoice draft missing. Close and reopen the modal.");
        setActiveOrderId(order.id);
        setStep(1);
        return;
      }
      const err = validateOrderDraft(order, orderDraft);
      if (err) {
        setLocalError(err);
        setActiveOrderId(order.id);
        setStep(1);
        return;
      }
      if (!validatePayments(orderDraft.payments)) {
        setLocalError("Fix payment details before invoicing.");
        setActiveOrderId(order.id);
        setStep(2);
        return;
      }
    }

    setLocalError("");
    const invoicesByOrder: CustomerOrderInvoiceSubmitPayload["invoicesByOrder"] =
      {};
    for (const order of orders) {
      const orderDraft = drafts[order.id]!;
      const discountNum = Number(orderDraft.additionalDiscount);
      const discount =
        Number.isFinite(discountNum) && discountNum > 0 ? discountNum : 0;
      const lineQtyOverrides: Record<string, number> = {};
      const lineUnitPriceOverrides: Record<string, number> = {};
      for (const line of orderDraft.lines) {
        const qty = Number(line.qty);
        if (Number.isFinite(qty) && qty > 0) {
          lineQtyOverrides[line.orderLineId] = qty;
        }
        if (line.unitPrice > 0) {
          lineUnitPriceOverrides[line.orderLineId] = line.unitPrice;
        }
      }
      invoicesByOrder[order.id] = {
        discountAmount: discount,
        paymentEntries: orderDraft.payments.filter((p) => p.amount > 0),
        lineQtyOverrides,
        lineUnitPriceOverrides,
      };
    }

    await onSubmit({
      orderIds: orders.map((o) => o.id),
      deliveryBy,
      invoicesByOrder,
    });
  }

  const displayError = localError || error || "";

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Generate invoices"
      size="2xl"
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
    >
      <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-2">
        <div className="min-h-0 overflow-y-auto border-b border-border px-4 py-4 sm:px-5 lg:border-b-0 lg:border-r lg:py-5">
          <div className="mx-auto max-w-xl space-y-5">
            {orders.length > 1 ? (
              <div className="flex flex-wrap gap-1.5">
                {orders.map((order, index) => {
                  const active = order.id === activeOrder?.id;
                  return (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => {
                        setActiveOrderId(order.id);
                        setLocalError("");
                        setPaymentFieldErrors({});
                      }}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                        active
                          ? "border-foreground bg-foreground text-surface"
                          : "border-border hover:bg-sidebar"
                      }`}
                    >
                      {index + 1}. {order.customerName ?? "Order"}
                      {order.isUrgent ? " · Urgent" : ""}
                    </button>
                  );
                })}
              </div>
            ) : null}

            <div className="flex gap-2 rounded-lg border border-border p-1">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setLocalError("");
                }}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
                  step === 1
                    ? "bg-sidebar text-foreground"
                    : "text-muted hover:text-foreground"
                }`}
              >
                1. Items
              </button>
              <button
                type="button"
                onClick={goToPayments}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
                  step === 2
                    ? "bg-sidebar text-foreground"
                    : "text-muted hover:text-foreground"
                }`}
              >
                2. Payments
              </button>
            </div>

            {step === 1 && draft && activeOrder ? (
              <>
                <section className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block min-w-0 sm:col-span-2">
                      <span className="mb-1.5 block text-xs font-medium text-muted">
                        Customer
                      </span>
                      <input
                        type="text"
                        value={
                          activeOrder.isUrgent
                            ? `${customerName} · Urgent`
                            : customerName
                        }
                        disabled
                        className="w-full rounded-lg border border-border bg-sidebar/40 px-3 py-2.5 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-90"
                      />
                    </label>
                    <div>
                      <span className="mb-1.5 block text-xs font-medium text-muted">
                        Pending balance
                      </span>
                      <p className="py-2.5 text-sm tabular-nums">
                        {formatINR(previousBalance)}
                      </p>
                    </div>
                    <div>
                      <span className="mb-1.5 block text-xs font-medium text-muted">
                        Invoice total
                      </span>
                      <p className="py-2.5 text-sm tabular-nums font-medium">
                        {formatINR(invoiceTotal)}
                      </p>
                    </div>
                  </div>

                  {appliedRules.length > 0 ? (
                    <div className="rounded-lg border border-border bg-sidebar/40 px-3 py-2.5">
                      <p className="text-xs font-medium text-muted">
                        Customer price rules
                      </p>
                      <ul className="mt-1.5 space-y-0.5 text-sm">
                        {appliedRules.map((rule) => (
                          <li key={rule}>{rule}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-xs text-muted">
                      Using list customer prices (no rules on this customer).
                    </p>
                  )}

                  <div className="space-y-2">
                    <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_5rem_5.5rem] gap-2 px-0.5 text-[11px] font-medium uppercase tracking-wide text-muted">
                      <span>Item</span>
                      <span className="text-right">Qty</span>
                      <span className="text-right">Rate</span>
                      <span className="text-right">Amount</span>
                    </div>
                    {draft.lines.length === 0 ? (
                      <p className="text-sm text-muted">
                        No order lines to invoice. Add manual items on the
                        order first.
                      </p>
                    ) : null}
                    {draft.lines.map((line) => (
                      <div
                        key={line.key}
                        className="grid grid-cols-[minmax(0,1fr)_4.5rem_5rem_5.5rem] items-start gap-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {line.name}
                          </p>
                          <p className="text-xs text-muted">
                            {line.ruleDescription
                              ? line.ruleDescription
                              : line.priceEditable
                                ? "Manual entry — set rate"
                                : line.listPrice !== line.unitPrice
                                  ? `List ${formatINR(line.listPrice)}`
                                  : "Customer list price"}
                          </p>
                        </div>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          inputMode="decimal"
                          value={line.qty}
                          onChange={(e) =>
                            updateLineQty(line.key, e.target.value)
                          }
                          className="w-full rounded-md border border-border bg-surface px-2 py-2 text-right text-sm tabular-nums outline-none focus:border-foreground/40"
                        />
                        {line.priceEditable ? (
                          <input
                            type="number"
                            min={0}
                            step="any"
                            inputMode="decimal"
                            value={line.unitPrice || ""}
                            onChange={(e) =>
                              updateLineUnitPrice(line.key, e.target.value)
                            }
                            className="w-full rounded-md border border-border bg-surface px-2 py-2 text-right text-sm tabular-nums outline-none focus:border-foreground/40"
                          />
                        ) : (
                          <span className="py-2 text-right text-sm tabular-nums text-muted">
                            {formatINR(line.unitPrice)}
                          </span>
                        )}
                        <span className="py-2 text-right text-sm tabular-nums">
                          {line.amount > 0 ? formatINR(line.amount) : "—"}
                        </span>
                      </div>
                    ))}
                  </div>

                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-muted">
                      Additional discount
                    </span>
                    <div className="flex overflow-hidden rounded-lg border border-border bg-surface focus-within:border-foreground/40 focus-within:ring-1 focus-within:ring-foreground/20">
                      <span className="flex items-center border-r border-border bg-sidebar px-3 text-sm text-muted">
                        ₹
                      </span>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        inputMode="decimal"
                        value={draft.additionalDiscount}
                        placeholder="0"
                        className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm tabular-nums outline-none"
                        onChange={(e) =>
                          updateActiveDraft({
                            additionalDiscount: e.target.value,
                          })
                        }
                      />
                    </div>
                  </label>
                </section>

                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">Delivery by</span>
                  <select
                    value={deliveryBy}
                    onChange={(e) => setDeliveryBy(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none"
                  >
                    <option value="">Select person…</option>
                    {deliveryStaff.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.fullName}
                      </option>
                    ))}
                  </select>
                  {orders.length > 1 ? (
                    <span className="block text-xs text-muted">
                      Same delivery person for all {orders.length} invoices.
                    </span>
                  ) : null}
                </label>

                {displayError ? (
                  <p
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                    role="alert"
                  >
                    {displayError}
                  </p>
                ) : null}

                <div className="flex justify-end gap-2 pb-1">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onClose}
                    className="rounded-lg border border-border px-3 py-2.5 text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={goToPayments}
                    className="rounded-lg bg-foreground px-3 py-2.5 text-sm font-medium text-surface disabled:opacity-50"
                  >
                    Continue to payments
                  </button>
                </div>
              </>
            ) : null}

            {step === 2 && draft ? (
              <>
                <InvoicePaymentsStep
                  payments={draft.payments}
                  onChange={(next) => {
                    updateActiveDraft({ payments: next });
                    setPaymentFieldErrors({});
                  }}
                  invoiceTotal={invoiceTotal}
                  previousBalance={previousBalance}
                  bankAccounts={bankAccounts}
                  disabled={busy}
                  fieldErrors={paymentFieldErrors}
                />

                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">Delivery by</span>
                  <select
                    value={deliveryBy}
                    onChange={(e) => setDeliveryBy(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none"
                  >
                    <option value="">Select person…</option>
                    {deliveryStaff.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.fullName}
                      </option>
                    ))}
                  </select>
                </label>

                {displayError ? (
                  <p
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                    role="alert"
                  >
                    {displayError}
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setStep(1);
                      setLocalError("");
                      setPaymentFieldErrors({});
                    }}
                    className="rounded-lg border border-border px-3 py-2.5 text-sm font-medium"
                  >
                    Back to items
                  </button>
                  <button
                    type="button"
                    disabled={busy || !deliveryBy || orders.length === 0}
                    onClick={() => void handleSubmit()}
                    className="rounded-lg bg-foreground px-3 py-2.5 text-sm font-medium text-surface disabled:opacity-50"
                  >
                    {busy
                      ? "Invoicing…"
                      : orders.length > 1
                        ? `Invoice ${orders.length} & assign`
                        : "Invoice & assign"}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>

        <div className="hidden min-h-0 overflow-y-auto bg-sidebar/30 p-4 lg:block">
          <InvoicePreview
            invoice={liveInvoice}
            salesman={previewCustomer}
            hideToolbar
            previousBalance={previousBalance}
          />
        </div>
      </div>
    </Modal>
  );
}
