"use client";

import { useEffect, useMemo, useState } from "react";
import {
  computeCustomerRuleDiscount,
  createInitialCustomerDraftLines,
  CustomerInvoiceLineEntry,
  type CustomerDraftLine,
} from "@/components/customers/CustomerInvoiceLineEntry";
import { InvoicePreview } from "@/components/salesmen/InvoicePreview";
import { Modal } from "@/components/ui/Modal";
import type { PriceListItem } from "@/lib/auth/types";
import { formatINR } from "@/lib/salesmen/mock-data";
import type { Invoice, InvoiceLineItem, Salesman } from "@/lib/salesmen/types";

type CustomerDirectInvoiceModalProps = {
  open: boolean;
  onClose: () => void;
  customer: Salesman;
  priceList: PriceListItem[];
  busy?: boolean;
  error?: string;
  onSubmit: (payload: {
    lineItems: InvoiceLineItem[];
    discountAmount: number;
    totalAmount: number;
    number: string;
    issuedAt: string;
  }) => Promise<Invoice>;
};

export function CustomerDirectInvoiceModal({
  open,
  onClose,
  customer,
  priceList,
  busy = false,
  error,
  onSubmit,
}: CustomerDirectInvoiceModalProps) {
  const [lines, setLines] = useState<CustomerDraftLine[]>(() =>
    createInitialCustomerDraftLines(),
  );
  const [additionalDiscount, setAdditionalDiscount] = useState("");
  const [localError, setLocalError] = useState("");
  const [draftNumber] = useState(() => `INV-CU-${Date.now()}`);
  const [issuedAt] = useState(() => new Date().toISOString());

  const priceRules = customer.priceRules ?? [];

  useEffect(() => {
    if (!open) {
      setLines(createInitialCustomerDraftLines());
      setAdditionalDiscount("");
      setLocalError("");
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

  const ruleDiscount = useMemo(
    () => computeCustomerRuleDiscount(filledLines),
    [filledLines],
  );

  const activeRuleDescriptions = useMemo(() => {
    const seen = new Set<string>();
    const descriptions: string[] = [];
    for (const line of filledLines) {
      const text = line.ruleDescription?.trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);
      descriptions.push(text);
    }
    return descriptions;
  }, [filledLines]);

  const additionalNum = Number(additionalDiscount);
  const additionalDiscountAmount =
    Number.isFinite(additionalNum) && additionalNum > 0 ? additionalNum : 0;
  const invoiceTotal = Math.max(
    0,
    Math.round((subtotal - additionalDiscountAmount) * 100) / 100,
  );

  const liveInvoice: Invoice = useMemo(() => {
    const lineItems: InvoiceLineItem[] = filledLines.map((l) => ({
      id: l.key,
      name: l.itemName.trim() || "Item",
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
      amountPaid: 0,
      lineItems,
      discountAmount:
        additionalDiscountAmount > 0 ? additionalDiscountAmount : undefined,
      verificationStatus: "pending_verification",
    };
  }, [
    filledLines,
    draftNumber,
    customer.id,
    issuedAt,
    invoiceTotal,
    additionalDiscountAmount,
  ]);

  function validateDraft(): boolean {
    if (filledLines.length === 0) {
      setLocalError("Add at least one line item.");
      return false;
    }
    setLocalError("");
    return true;
  }

  async function handleSubmit() {
    if (!validateDraft()) return;

    setLocalError("");
    try {
      await onSubmit({
        lineItems: liveInvoice.lineItems,
        discountAmount: additionalDiscountAmount,
        totalAmount: invoiceTotal,
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

              <div>
                <h2 className="mb-2 text-base font-medium">Items</h2>
                <CustomerInvoiceLineEntry
                  priceList={priceList}
                  priceRules={priceRules}
                  lines={lines}
                  onChange={setLines}
                  disabled={busy}
                />
                {priceList.length === 0 ? (
                  <p className="mt-2 text-xs text-muted">
                    No approved price list items available.
                  </p>
                ) : null}
              </div>

              <div>
                <span className="mb-1.5 block text-xs font-medium text-muted">
                  Rule discount
                </span>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-2.5">
                  <p className="text-sm tabular-nums text-foreground">
                    {formatINR(ruleDiscount)}
                  </p>
                  {activeRuleDescriptions.length > 0 ? (
                    <p className="text-xs text-muted">
                      {activeRuleDescriptions.join(" · ")}
                    </p>
                  ) : priceRules.length > 0 ? (
                    <p className="text-xs text-muted">
                      No matching price rules on entered items
                    </p>
                  ) : (
                    <p className="text-xs text-muted">
                      No price rules on this customer
                    </p>
                  )}
                </div>
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
                onClick={() => void handleSubmit()}
                className="rounded-lg bg-foreground px-3 py-2.5 text-sm font-medium text-surface disabled:opacity-50"
              >
                {busy ? "Saving…" : "Generate invoice"}
              </button>
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
