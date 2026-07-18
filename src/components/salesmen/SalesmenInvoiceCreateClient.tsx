"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppContext } from "@/app/(app)/layout";
import { TopBar } from "@/components/layout/AppShell";
import { InvoicePaymentsStep } from "@/components/salesmen/InvoicePaymentsStep";
import { InvoicePreview } from "@/components/salesmen/InvoicePreview";
import {
  createEmptyDraftLine,
  createInitialDraftLines,
  InvoiceLineEntry,
  type DraftLine,
} from "@/components/salesmen/InvoiceLineEntry";
import { ItemNameCombobox } from "@/components/salesmen/ItemNameCombobox";
import { Modal } from "@/components/ui/Modal";
import type { PriceListItem } from "@/lib/auth/types";
import {
  addInvoice,
  calculateSalesmanDiscount,
  formatINR,
} from "@/lib/salesmen/mock-data";
import type {
  Invoice,
  InvoiceLineItem,
  InvoicePaymentEntry,
  Salesman,
} from "@/lib/salesmen/types";

type SalesmenInvoiceCreateClientProps = {
  context: AppContext;
  salesmen: Salesman[];
  priceList: PriceListItem[];
  initialSalesmanId?: string;
};

type BuilderStep = 1 | 2;

export function SalesmenInvoiceCreateClient({
  context,
  salesmen,
  priceList,
  initialSalesmanId,
}: SalesmenInvoiceCreateClientProps) {
  const router = useRouter();
  const [draftId] = useState(() => `inv-draft-${Date.now()}`);
  const [draftNumber] = useState(() => `INV-SM-${Date.now()}`);
  const [issuedAt] = useState(() => new Date().toISOString());

  const [step, setStep] = useState<BuilderStep>(1);
  const [salesmanId, setSalesmanId] = useState("");
  const [salesmanQuery, setSalesmanQuery] = useState("");
  const [salesmanOpen, setSalesmanOpen] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>(() =>
    createInitialDraftLines(5),
  );
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnLine, setReturnLine] = useState<DraftLine>(() =>
    createEmptyDraftLine(),
  );
  const [additionalDiscount, setAdditionalDiscount] = useState("");
  const [payments, setPayments] = useState<InvoicePaymentEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!initialSalesmanId) return;
    const match = salesmen.find((s) => s.id === initialSalesmanId);
    if (!match) return;
    setSalesmanId(match.id);
    setSalesmanQuery(match.name);
  }, [initialSalesmanId, salesmen]);

  const salesman = salesmen.find((s) => s.id === salesmanId) ?? null;

  const filteredSalesmen = useMemo(() => {
    const q = salesmanQuery.trim().toLowerCase();
    if (!q || (salesman && salesman.name.toLowerCase() === q)) {
      return salesmen;
    }
    return salesmen.filter((s) => s.name.toLowerCase().includes(q));
  }, [salesmen, salesmanQuery, salesman]);

  const filledLines = useMemo(
    () =>
      lines.filter(
        (l) =>
          l.priceListItemId &&
          l.name.trim() &&
          Number(l.qty) > 0 &&
          l.unitPrice > 0,
      ),
    [lines],
  );

  const subtotal = useMemo(
    () => filledLines.reduce((sum, l) => sum + l.amount, 0),
    [filledLines],
  );

  const filledReturn =
    returnOpen &&
    returnLine.priceListItemId &&
    returnLine.name.trim() &&
    Number(returnLine.qty) > 0 &&
    returnLine.unitPrice > 0
      ? returnLine
      : null;

  const returnAmount = filledReturn?.amount ?? 0;

  const ruleDiscount = useMemo(
    () =>
      calculateSalesmanDiscount(
        filledLines.map((l) => ({
          priceListItemId: l.priceListItemId,
          qty: Number(l.qty),
        })),
        priceList,
        salesman?.discountRule,
      ),
    [filledLines, priceList, salesman?.discountRule],
  );

  const additionalNum = Number(additionalDiscount);
  const additionalDiscountAmount =
    Number.isFinite(additionalNum) && additionalNum > 0 ? additionalNum : 0;

  const discountAmount = ruleDiscount + additionalDiscountAmount;
  const invoiceTotal = Math.max(0, subtotal - returnAmount - discountAmount);

  const amountPaid = useMemo(
    () => payments.reduce((sum, p) => sum + (p.amount || 0), 0),
    [payments],
  );

  const previousBalance = salesman?.pendingBalance ?? 0;

  const liveInvoice: Invoice = useMemo(() => {
    const lineItems: InvoiceLineItem[] = filledLines.map((l) => ({
      id: l.key,
      name: l.name,
      qty: Number(l.qty),
      unitPrice: l.unitPrice,
      amount: l.amount,
      priceListItemId: l.priceListItemId ?? undefined,
    }));

    const returnItems: InvoiceLineItem[] | undefined = filledReturn
      ? [
          {
            id: filledReturn.key,
            name: filledReturn.name,
            qty: Number(filledReturn.qty),
            unitPrice: filledReturn.unitPrice,
            amount: filledReturn.amount,
            priceListItemId: filledReturn.priceListItemId ?? undefined,
          },
        ]
      : undefined;

    return {
      id: draftId,
      number: draftNumber,
      salesmanId: salesman?.id ?? "",
      issuedAt,
      itemCount: lineItems.length,
      totalAmount: invoiceTotal,
      amountPaid,
      lineItems,
      discountAmount: discountAmount > 0 ? discountAmount : undefined,
      returnItems,
      paymentEntries: payments.length > 0 ? payments : undefined,
    };
  }, [
    draftId,
    draftNumber,
    issuedAt,
    filledLines,
    filledReturn,
    salesman?.id,
    invoiceTotal,
    amountPaid,
    discountAmount,
    payments,
  ]);

  const previewSalesman: Salesman = salesman ?? {
    id: "preview-placeholder",
    name: "Select a salesman",
    phone: "",
    category: "Salesmen",
    isActive: true,
    pendingBalance: 0,
    lastInvoiceAt: null,
  };

  function selectSalesman(s: Salesman) {
    setSalesmanId(s.id);
    setSalesmanQuery(s.name);
    setSalesmanOpen(false);
    setError(null);
  }

  function updateReturn(patch: Partial<DraftLine>) {
    setReturnLine((prev) => {
      const merged = { ...prev, ...patch };
      const qtyNum = Number(merged.qty);
      const qty = Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : 0;
      merged.amount = Math.round(qty * merged.unitPrice * 100) / 100;
      return merged;
    });
  }

  function clearReturn() {
    setReturnOpen(false);
    setReturnLine(createEmptyDraftLine());
  }

  function validateStep1(): boolean {
    if (!salesman) {
      setError("Select a salesman first.");
      return false;
    }
    if (filledLines.length === 0) {
      setError("Add at least one line item with quantity.");
      return false;
    }
    setError(null);
    return true;
  }

  function goToPayments() {
    if (!validateStep1()) return;
    setStep(2);
  }

  function validatePayments(): boolean {
    for (const payment of payments) {
      if (!(payment.amount > 0)) {
        setError("Each payment needs an amount greater than zero.");
        return false;
      }
      if (payment.method === "cheque") {
        if (!payment.chequeNumber?.trim()) {
          setError("Cheque payments need a cheque number.");
          return false;
        }
        if (!payment.depositAccountId) {
          setError("Cheque payments need a deposit account.");
          return false;
        }
      }
      if (payment.method === "upi" || payment.method === "imps") {
        if (!payment.senderName?.trim()) {
          setError("UPI / IMPS payments need a sender name.");
          return false;
        }
        if (!payment.depositAccountId) {
          setError("UPI / IMPS payments need a deposit account.");
          return false;
        }
      }
    }
    setError(null);
    return true;
  }

  function handleGenerateClick() {
    if (!validateStep1()) {
      setStep(1);
      return;
    }
    if (!validatePayments()) {
      setStep(2);
      return;
    }
    setConfirmOpen(true);
  }

  function confirmGenerate() {
    if (!salesman || saving) return;
    setSaving(true);
    const saved = addInvoice({
      ...liveInvoice,
      issuedAt: new Date().toISOString(),
    });
    setConfirmOpen(false);
    router.push(`/entities/salesmen/${saved.salesmanId}`);
    router.refresh();
  }

  return (
    <>
      <TopBar
        context={context}
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Orders" },
          { label: "Create invoice" },
        ]}
      />

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden print:hidden">
        <div className="flex shrink-0 flex-col gap-3 border-b border-border px-4 py-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <h1 className="text-xl font-medium tracking-tight sm:text-2xl">
              Create New Invoice
            </h1>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-2">
          <div className="min-h-0 overflow-y-auto border-b border-border px-4 py-5 sm:px-6 lg:border-b-0 lg:border-r lg:px-8">
            <div className="mx-auto max-w-2xl space-y-6">
              <StepTabs
                step={step}
                onStepChange={(next) => {
                  if (next === 2) {
                    goToPayments();
                    return;
                  }
                  setError(null);
                  setStep(1);
                }}
              />

              {step === 1 && (
                <>
                  <section className="space-y-4">
                    <h2 className="text-sm font-medium">Invoice Details</h2>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block min-w-0 sm:col-span-2">
                        <span className="mb-1.5 block text-xs font-medium text-muted">
                          Salesman
                        </span>
                        <div className="relative">
                          <input
                            type="text"
                            role="combobox"
                            aria-expanded={salesmanOpen}
                            aria-autocomplete="list"
                            value={salesmanQuery}
                            placeholder="Search salesman…"
                            autoComplete="off"
                            className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20"
                            onFocus={() => setSalesmanOpen(true)}
                            onChange={(e) => {
                              setSalesmanQuery(e.target.value);
                              setSalesmanId("");
                              setSalesmanOpen(true);
                            }}
                            onBlur={() => {
                              window.setTimeout(
                                () => setSalesmanOpen(false),
                                150,
                              );
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") setSalesmanOpen(false);
                              if (e.key === "Enter" && filteredSalesmen[0]) {
                                e.preventDefault();
                                selectSalesman(filteredSalesmen[0]);
                              }
                            }}
                          />
                          {salesmanOpen && filteredSalesmen.length > 0 && (
                            <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-md">
                              {filteredSalesmen.map((s) => (
                                <li key={s.id}>
                                  <button
                                    type="button"
                                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-sidebar"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      selectSalesman(s);
                                    }}
                                  >
                                    <span>{s.name}</span>
                                    <span className="tabular-nums text-muted">
                                      {formatINR(s.pendingBalance)}
                                    </span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </label>

                      <div>
                        <span className="mb-1.5 block text-xs font-medium text-muted">
                          Last balance
                        </span>
                        <p className="py-2.5 text-sm tabular-nums text-foreground">
                          {salesman ? formatINR(previousBalance) : "—"}
                        </p>
                      </div>
                    </div>

                    {salesman && (
                      <p className="text-xs text-muted">
                        {salesman.phone ? `+${salesman.phone}` : null}
                        {salesman.phone ? " · " : null}
                        {salesman.category}
                      </p>
                    )}
                  </section>

                  <section className="space-y-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <h2 className="text-base font-medium">Items</h2>
                      <p className="text-xs text-muted">
                        Tab through item → qty · Enter for next row
                      </p>
                    </div>
                    <InvoiceLineEntry
                      priceList={priceList}
                      lines={lines}
                      onChange={setLines}
                      disabled={!salesman}
                    />
                    {!salesman && (
                      <p className="text-xs text-muted">
                        Select a salesman to start entering items.
                      </p>
                    )}
                    {salesman && priceList.length === 0 && (
                      <p className="text-xs text-muted">
                        No approved price list items available.
                      </p>
                    )}

                    {!returnOpen ? (
                      <button
                        type="button"
                        disabled={!salesman}
                        onClick={() => setReturnOpen(true)}
                        className="text-sm text-muted underline-offset-2 hover:text-foreground hover:underline disabled:opacity-40"
                      >
                        + Add return
                      </button>
                    ) : (
                      <div className="space-y-2 rounded-xl border border-dashed border-border bg-sidebar/40 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">Return item</p>
                          <button
                            type="button"
                            onClick={clearReturn}
                            className="text-xs text-muted hover:text-foreground"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_5.5rem] items-center gap-2">
                          <ItemNameCombobox
                            items={priceList}
                            value={returnLine.name}
                            disabled={!salesman}
                            placeholder="Returning item…"
                            onChange={(name) =>
                              updateReturn({
                                name,
                                priceListItemId: null,
                                unitPrice: 0,
                              })
                            }
                            onSelect={(item) =>
                              updateReturn({
                                name: item.item_name,
                                priceListItemId: item.id,
                                unitPrice: item.salesmen_price,
                              })
                            }
                            onTabToQty={() => undefined}
                          />
                          <input
                            type="number"
                            min={0}
                            step="any"
                            inputMode="decimal"
                            disabled={!salesman}
                            value={returnLine.qty}
                            placeholder="Qty"
                            className="w-full rounded-md border border-border bg-surface px-2 py-2 text-right text-sm tabular-nums outline-none focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20 disabled:opacity-50"
                            onChange={(e) =>
                              updateReturn({ qty: e.target.value })
                            }
                          />
                          <span className="text-right text-sm tabular-nums text-[#c45c26]">
                            {returnAmount > 0
                              ? `−${formatINR(returnAmount)}`
                              : "—"}
                          </span>
                        </div>
                      </div>
                    )}

                    <div>
                      <span className="mb-1.5 block text-xs font-medium text-muted">
                        Rule discount
                      </span>
                      <p className="py-2.5 text-sm tabular-nums text-foreground">
                        {salesman
                          ? formatINR(ruleDiscount)
                          : "—"}
                      </p>
                      {salesman?.discountRule && (
                        <p className="text-xs text-muted">
                          {salesman.discountRule.description}
                        </p>
                      )}
                      {salesman && !salesman.discountRule && (
                        <p className="text-xs text-muted">
                          No discount rule on this salesman
                        </p>
                      )}
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
                          value={additionalDiscount}
                          placeholder="0"
                          disabled={!salesman}
                          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm tabular-nums outline-none disabled:opacity-50"
                          onChange={(e) =>
                            setAdditionalDiscount(e.target.value)
                          }
                        />
                      </div>
                    </label>
                  </section>

                  {error && (
                    <p className="text-sm text-[#c45c26]" role="alert">
                      {error}
                    </p>
                  )}

                  <div className="flex justify-end pb-4">
                    <button
                      type="button"
                      onClick={goToPayments}
                      className="rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-surface hover:bg-foreground/90"
                    >
                      Continue to payments
                    </button>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <section className="space-y-1">
                    <h2 className="text-base font-medium">Payments</h2>
                    <p className="text-sm text-muted">
                      {salesman?.name ?? "Salesman"} · Invoice total{" "}
                      {formatINR(invoiceTotal)}
                    </p>
                  </section>

                  <InvoicePaymentsStep
                    payments={payments}
                    onChange={setPayments}
                    invoiceTotal={invoiceTotal}
                    disabled={!salesman}
                  />

                  {error && (
                    <p className="text-sm text-[#c45c26]" role="alert">
                      {error}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setStep(1);
                      }}
                      className="rounded-lg border border-border px-4 py-2.5 text-sm hover:bg-sidebar"
                    >
                      Back to items
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerateClick}
                      className="rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-surface hover:bg-foreground/90"
                    >
                      Generate Invoice
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="hidden min-h-0 overflow-y-auto bg-[#f0efeb] px-4 py-5 sm:px-6 lg:block lg:px-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium">Preview</h2>
              <span className="text-xs text-muted">Updates as you type</span>
            </div>
            <InvoicePreview
              invoice={liveInvoice}
              salesman={previewSalesman}
              hideToolbar
              previousBalance={salesman ? previousBalance : undefined}
            />
          </div>
        </div>
      </main>

      <div className="hidden print:block">
        <InvoicePreview
          invoice={liveInvoice}
          salesman={previewSalesman}
          forPrint
          previousBalance={salesman ? previousBalance : undefined}
        />
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => {
          if (!saving) setConfirmOpen(false);
        }}
        title="Generate this invoice?"
        footer={
          <div className="flex w-full flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => setConfirmOpen(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-sidebar disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={confirmGenerate}
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-surface hover:bg-foreground/90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Yes, generate"}
            </button>
          </div>
        }
      >
        <p className="text-sm text-muted">
          Create invoice{" "}
          <span className="font-medium text-foreground">
            {liveInvoice.number}
          </span>{" "}
          for{" "}
          <span className="font-medium text-foreground">
            {salesman?.name}
          </span>
          ?
        </p>
        <dl className="mt-4 space-y-1.5 text-sm">
          <div className="flex justify-between gap-4 text-muted">
            <dt>Invoice total</dt>
            <dd className="tabular-nums text-foreground">
              {formatINR(invoiceTotal)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 text-muted">
            <dt>Paid</dt>
            <dd className="tabular-nums text-foreground">
              {formatINR(amountPaid)}
            </dd>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between gap-4 text-muted">
              <dt>Discount</dt>
              <dd className="tabular-nums text-foreground">
                {formatINR(discountAmount)}
              </dd>
            </div>
          )}
        </dl>
        <p className="mt-4 text-xs text-muted">
          This will add the invoice to {salesman?.name}&apos;s invoice list.
        </p>
      </Modal>
    </>
  );
}

function StepTabs({
  step,
  onStepChange,
}: {
  step: BuilderStep;
  onStepChange: (step: BuilderStep) => void;
}) {
  return (
    <div className="inline-flex w-full rounded-lg border border-border bg-surface p-0.5 sm:w-auto">
      <button
        type="button"
        onClick={() => onStepChange(1)}
        className={`flex-1 rounded-md px-3 py-2 text-sm sm:flex-none ${
          step === 1
            ? "bg-sidebar font-medium"
            : "text-muted hover:text-foreground"
        }`}
      >
        1 · Items
      </button>
      <button
        type="button"
        onClick={() => onStepChange(2)}
        className={`flex-1 rounded-md px-3 py-2 text-sm sm:flex-none ${
          step === 2
            ? "bg-sidebar font-medium"
            : "text-muted hover:text-foreground"
        }`}
      >
        2 · Payments
      </button>
    </div>
  );
}
