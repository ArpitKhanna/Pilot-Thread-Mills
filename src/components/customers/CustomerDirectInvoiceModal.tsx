"use client";

import { useEffect, useMemo, useState } from "react";
import { ItemNameCombobox } from "@/components/salesmen/ItemNameCombobox";
import { InvoicePaymentsStep } from "@/components/salesmen/InvoicePaymentsStep";
import { InvoicePreview } from "@/components/salesmen/InvoicePreview";
import { Modal } from "@/components/ui/Modal";
import type { PriceListItem } from "@/lib/auth/types";
import type { BankAccount } from "@/lib/bank-accounts/types";
import {
  matchCustomerPriceRule,
  resolveCustomerUnitPrice,
} from "@/lib/customers/price-rules";
import { formatINR } from "@/lib/salesmen/mock-data";
import type {
  Invoice,
  InvoiceLineItem,
  InvoicePaymentEntry,
  Salesman,
} from "@/lib/salesmen/types";

type PricedLine = {
  key: string;
  priceListItemId: string | null;
  itemName: string;
  shadeCode: string;
  qty: string;
  unitPrice: number;
  amount: number;
  listPrice: number;
  ruleDescription: string | null;
};

type BuilderStep = 1 | 2;

const BLANK_ROWS = 5;

function emptyLine(): PricedLine {
  return {
    key: crypto.randomUUID(),
    priceListItemId: null,
    itemName: "",
    shadeCode: "",
    qty: "",
    unitPrice: 0,
    amount: 0,
    listPrice: 0,
    ruleDescription: null,
  };
}

function isBlankLine(line: PricedLine): boolean {
  return (
    !line.itemName.trim() &&
    !line.shadeCode.trim() &&
    !line.qty &&
    line.priceListItemId == null &&
    line.unitPrice <= 0
  );
}

function withTrailingBlanks(lines: PricedLine[]): PricedLine[] {
  const filled = lines.filter((l) => !isBlankLine(l));
  const blanks = Array.from({ length: BLANK_ROWS }, () => emptyLine());
  return [...filled, ...blanks];
}

function lineDisplayName(line: PricedLine): string {
  const base = line.itemName.trim() || "Item";
  return line.shadeCode.trim() ? `${base} — ${line.shadeCode.trim()}` : base;
}

type CustomerDirectInvoiceModalProps = {
  open: boolean;
  onClose: () => void;
  customer: Salesman;
  priceList: PriceListItem[];
  bankAccounts: BankAccount[];
  busy?: boolean;
  error?: string;
  onSubmit: (payload: {
    lineItems: InvoiceLineItem[];
    discountAmount: number;
    paymentEntries: InvoicePaymentEntry[];
    totalAmount: number;
    amountPaid: number;
    number: string;
    issuedAt: string;
  }) => Promise<Invoice>;
};

export function CustomerDirectInvoiceModal({
  open,
  onClose,
  customer,
  priceList,
  bankAccounts,
  busy = false,
  error,
  onSubmit,
}: CustomerDirectInvoiceModalProps) {
  const [step, setStep] = useState<BuilderStep>(1);
  const [lines, setLines] = useState<PricedLine[]>(() =>
    withTrailingBlanks([]),
  );
  const [additionalDiscount, setAdditionalDiscount] = useState("");
  const [payments, setPayments] = useState<InvoicePaymentEntry[]>([]);
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

  const priceRules = customer.priceRules ?? [];

  useEffect(() => {
    if (!open) {
      setStep(1);
      setLines(withTrailingBlanks([]));
      setAdditionalDiscount("");
      setPayments([]);
      setLocalError("");
      setPaymentFieldErrors({});
    }
  }, [open]);

  const filledLines = useMemo(
    () =>
      lines.filter(
        (l) =>
          l.itemName.trim() && Number(l.qty) > 0 && l.unitPrice > 0,
      ),
    [lines],
  );

  const subtotal = useMemo(
    () => filledLines.reduce((sum, l) => sum + l.amount, 0),
    [filledLines],
  );

  const additionalNum = Number(additionalDiscount);
  const discountAmount =
    Number.isFinite(additionalNum) && additionalNum > 0 ? additionalNum : 0;
  const invoiceTotal = Math.max(
    0,
    Math.round((subtotal - discountAmount) * 100) / 100,
  );

  const amountPaid = useMemo(
    () =>
      payments
        .filter((p) => p.status !== "cancelled")
        .reduce((sum, p) => sum + (p.amount || 0), 0),
    [payments],
  );

  const liveInvoice: Invoice = useMemo(() => {
    const lineItems: InvoiceLineItem[] = filledLines.map((l) => ({
      id: l.key,
      name: lineDisplayName(l),
      qty: Number(l.qty),
      unitPrice: l.unitPrice,
      amount: l.amount,
      priceListItemId: l.priceListItemId ?? undefined,
    }));
    return {
      id: "draft",
      number: draftNumber,
      salesmanId: customer.id,
      issuedAt,
      itemCount: lineItems.length,
      totalAmount: invoiceTotal,
      amountPaid,
      lineItems,
      paymentEntries: payments,
      discountAmount: discountAmount > 0 ? discountAmount : undefined,
      verificationStatus: "pending_verification",
    };
  }, [
    filledLines,
    draftNumber,
    customer.id,
    issuedAt,
    invoiceTotal,
    amountPaid,
    payments,
    discountAmount,
  ]);

  function updateLine(key: string, patch: Partial<PricedLine>) {
    setLines((prev) =>
      withTrailingBlanks(
        prev.map((line) => {
          if (line.key !== key) return line;
          const merged = { ...line, ...patch };
          const qtyNum = Number(merged.qty);
          const q = Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : 0;
          merged.amount = Math.round(merged.unitPrice * q * 100) / 100;
          return merged;
        }),
      ),
    );
  }

  function removeLine(key: string) {
    setLines((prev) =>
      withTrailingBlanks(prev.filter((l) => l.key !== key)),
    );
  }

  function selectCatalogItem(key: string, item: PriceListItem) {
    const unitPrice = resolveCustomerUnitPrice(
      item.customer_price,
      priceRules,
      {
        priceListItemId: item.id,
        itemName: item.item_name,
        priceList,
      },
    );
    const rule = matchCustomerPriceRule(priceRules, {
      priceListItemId: item.id,
      itemName: item.item_name,
      priceList,
    });
    updateLine(key, {
      itemName: item.item_name,
      priceListItemId: item.id,
      unitPrice,
      listPrice: Number(item.customer_price),
      ruleDescription: rule?.description ?? null,
    });
  }

  function validateStep1(): boolean {
    if (filledLines.length === 0) {
      setLocalError("Add at least one line item.");
      return false;
    }
    setLocalError("");
    return true;
  }

  function validatePayments(): boolean {
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
    if (!validateStep1()) return;
    setStep(2);
  }

  async function handleSubmit() {
    if (!validateStep1()) {
      setStep(1);
      return;
    }
    if (!validatePayments()) {
      setStep(2);
      return;
    }

    setLocalError("");
    try {
      await onSubmit({
        lineItems: liveInvoice.lineItems,
        discountAmount,
        paymentEntries: payments,
        totalAmount: invoiceTotal,
        amountPaid,
        number: draftNumber,
        issuedAt,
      });
    } catch (e) {
      setLocalError(
        e instanceof Error ? e.message : "Failed to generate invoice",
      );
    }
  }

  const displayError = localError || error || "";

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Generate invoice"
      size="2xl"
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
    >
      <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-h-0 overflow-y-auto border-b border-border px-4 py-5 lg:border-b-0 lg:border-r lg:px-6">
          <div className="mx-auto max-w-xl space-y-5">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setLocalError("");
                  setStep(1);
                }}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  step === 1
                    ? "bg-sidebar font-medium"
                    : "text-muted hover:text-foreground"
                }`}
              >
                1. Items
              </button>
              <button
                type="button"
                onClick={goToPayments}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  step === 2
                    ? "bg-sidebar font-medium"
                    : "text-muted hover:text-foreground"
                }`}
              >
                2. Payments
              </button>
            </div>

            {step === 1 ? (
              <section className="space-y-3">
                <label className="block min-w-0">
                  <span className="mb-1.5 block text-xs font-medium text-muted">
                    Customer
                  </span>
                  <input
                    type="text"
                    value={customer.name}
                    disabled
                    className="w-full rounded-lg border border-border bg-sidebar/40 px-3 py-2.5 text-sm outline-none disabled:cursor-not-allowed"
                  />
                </label>

                <div className="space-y-2">
                  <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_5rem_5.5rem_1.5rem] gap-2 px-0.5 text-[11px] font-medium tracking-wide text-muted uppercase">
                    <span>Item</span>
                    <span className="text-right">Qty</span>
                    <span className="text-right">Rate</span>
                    <span className="text-right">Amount</span>
                    <span />
                  </div>
                  {lines.map((line) => {
                    const blank = isBlankLine(line);
                    return (
                      <div
                        key={line.key}
                        className="grid grid-cols-[minmax(0,1fr)_4.5rem_5rem_5.5rem_1.5rem] items-start gap-2"
                      >
                        <div className="min-w-0 space-y-1">
                          <ItemNameCombobox
                            items={priceList}
                            value={line.itemName}
                            disabled={busy}
                            showPrice={false}
                            placeholder="Item"
                            onChange={(value) =>
                              updateLine(line.key, {
                                itemName: value,
                                priceListItemId: null,
                                unitPrice: 0,
                                listPrice: 0,
                                ruleDescription: null,
                              })
                            }
                            onSelect={(item) =>
                              selectCatalogItem(line.key, item)
                            }
                            onTabToQty={() => undefined}
                          />
                          <input
                            type="text"
                            value={line.shadeCode}
                            disabled={busy}
                            placeholder="Shade (optional)"
                            onChange={(e) =>
                              updateLine(line.key, {
                                shadeCode: e.target.value,
                              })
                            }
                            className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-xs outline-none focus:border-foreground/40 disabled:opacity-50"
                          />
                          {line.ruleDescription ? (
                            <p className="truncate text-xs text-muted">
                              {line.ruleDescription}
                            </p>
                          ) : null}
                        </div>
                        <input
                          type="number"
                          min={0}
                          step="any"
                          inputMode="decimal"
                          disabled={busy}
                          value={line.qty}
                          placeholder="0"
                          onChange={(e) =>
                            updateLine(line.key, { qty: e.target.value })
                          }
                          className="w-full rounded-md border border-border bg-surface px-2 py-2 text-right text-sm tabular-nums outline-none focus:border-foreground/40 disabled:opacity-50"
                        />
                        <span className="py-2 text-right text-sm tabular-nums text-muted">
                          {line.unitPrice > 0
                            ? formatINR(line.unitPrice)
                            : "—"}
                        </span>
                        <span className="py-2 text-right text-sm tabular-nums">
                          {line.amount > 0 ? formatINR(line.amount) : "—"}
                        </span>
                        <div className="flex justify-center pt-2">
                          {!blank ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => removeLine(line.key)}
                              className="text-sm text-muted hover:text-foreground disabled:opacity-50"
                              aria-label="Remove line"
                            >
                              ×
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
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
                      disabled={busy}
                      value={additionalDiscount}
                      placeholder="0"
                      className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm tabular-nums outline-none disabled:opacity-50"
                      onChange={(e) => setAdditionalDiscount(e.target.value)}
                    />
                  </div>
                </label>
              </section>
            ) : (
              <InvoicePaymentsStep
                payments={payments}
                onChange={setPayments}
                invoiceTotal={invoiceTotal}
                previousBalance={customer.pendingBalance}
                bankAccounts={bankAccounts}
                disabled={busy}
                fieldErrors={paymentFieldErrors}
              />
            )}

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
              {step === 1 ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={goToPayments}
                  className="rounded-lg bg-foreground px-3 py-2.5 text-sm font-medium text-surface disabled:opacity-50"
                >
                  Continue to payments
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setLocalError("");
                      setStep(1);
                    }}
                    className="rounded-lg border border-border px-3 py-2.5 text-sm font-medium"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleSubmit()}
                    className="rounded-lg bg-foreground px-3 py-2.5 text-sm font-medium text-surface disabled:opacity-50"
                  >
                    {busy ? "Saving…" : "Generate invoice"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="hidden min-h-0 overflow-y-auto bg-sidebar/20 p-4 lg:block lg:p-6">
          <InvoicePreview
            invoice={liveInvoice}
            salesman={customer}
            previousBalance={customer.pendingBalance}
          />
        </div>
      </div>
    </Modal>
  );
}
