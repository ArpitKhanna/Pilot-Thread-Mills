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
import type { BankAccount } from "@/lib/bank-accounts/types";
import { calculateSalesmanDiscount, formatINR } from "@/lib/salesmen/mock-data";
import type {
  Invoice,
  InvoiceLineItem,
  InvoicePaymentEntry,
  Salesman,
} from "@/lib/salesmen/types";
import { ENTITY_TYPE_LABELS } from "@/lib/salesmen/types";

type SalesmenInvoiceCreateClientProps = {
  context: AppContext;
  salesmen: Salesman[];
  priceList: PriceListItem[];
  bankAccounts: BankAccount[];
  initialSalesmanId?: string;
  mode?: "create" | "edit";
  initialInvoice?: Invoice;
};

type BuilderStep = 1 | 2;

function draftLinesFromInvoice(invoice: Invoice): DraftLine[] {
  const filled = invoice.lineItems.map((item) => ({
    key: item.id || `line-${crypto.randomUUID()}`,
    priceListItemId: item.priceListItemId ?? null,
    name: item.name,
    qty: String(item.qty),
    unitPrice: item.unitPrice,
    amount: item.amount,
  }));
  const blanks = createInitialDraftLines(
    Math.max(1, 5 - filled.length),
  ).slice(0, Math.max(1, 5 - filled.length));
  return [...filled, ...blanks];
}

export function SalesmenInvoiceCreateClient({
  context,
  salesmen,
  priceList,
  bankAccounts,
  initialSalesmanId,
  mode = "create",
  initialInvoice,
}: SalesmenInvoiceCreateClientProps) {
  const router = useRouter();
  const isEdit = mode === "edit" && Boolean(initialInvoice);

  const [draftId] = useState(
    () => initialInvoice?.id ?? `inv-draft-${Date.now()}`,
  );
  const [draftNumber] = useState(
    () => initialInvoice?.number ?? `INV-SM-${Date.now()}`,
  );
  const [issuedAt] = useState(
    () => initialInvoice?.issuedAt ?? new Date().toISOString(),
  );

  const [step, setStep] = useState<BuilderStep>(1);
  const [salesmanId, setSalesmanId] = useState(
    () => initialInvoice?.salesmanId ?? "",
  );
  const [salesmanQuery, setSalesmanQuery] = useState("");
  const [salesmanOpen, setSalesmanOpen] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>(() =>
    initialInvoice
      ? draftLinesFromInvoice(initialInvoice)
      : createInitialDraftLines(5),
  );
  const [returnOpen, setReturnOpen] = useState(
    () => Boolean(initialInvoice?.returnItems?.length),
  );
  const [returnLine, setReturnLine] = useState<DraftLine>(() => {
    const first = initialInvoice?.returnItems?.[0];
    if (!first) return createEmptyDraftLine();
    return {
      key: first.id || `ret-${crypto.randomUUID()}`,
      priceListItemId: first.priceListItemId ?? null,
      name: first.name,
      qty: String(first.qty),
      unitPrice: first.unitPrice,
      amount: first.amount,
    };
  });
  const [additionalDiscount, setAdditionalDiscount] = useState("");
  const [payments, setPayments] = useState<InvoicePaymentEntry[]>(
    () => initialInvoice?.paymentEntries ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hydratedDiscount, setHydratedDiscount] = useState(!isEdit);

  useEffect(() => {
    const id = initialInvoice?.salesmanId ?? initialSalesmanId;
    if (!id) return;
    const match = salesmen.find((s) => s.id === id);
    if (!match) return;
    setSalesmanId(match.id);
    setSalesmanQuery(match.name);
  }, [initialSalesmanId, initialInvoice?.salesmanId, salesmen]);

  // After salesman + lines known in edit mode, split stored discount into rule vs additional
  useEffect(() => {
    if (!isEdit || !initialInvoice || hydratedDiscount) return;
    const salesman = salesmen.find((s) => s.id === salesmanId);
    if (!salesmanId) return;
    const rule = calculateSalesmanDiscount(
      lines
        .filter((l) => l.priceListItemId && Number(l.qty) > 0)
        .map((l) => ({
          priceListItemId: l.priceListItemId,
          name: l.name,
          qty: Number(l.qty),
        })),
      priceList,
      salesman?.discountRules,
    );
    const stored = initialInvoice.discountAmount ?? 0;
    const additional = Math.max(0, Math.round((stored - rule) * 100) / 100);
    setAdditionalDiscount(additional > 0 ? String(additional) : "");
    setHydratedDiscount(true);
  }, [
    isEdit,
    initialInvoice,
    hydratedDiscount,
    salesmanId,
    salesmen,
    lines,
    priceList,
  ]);

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
          name: l.name,
          qty: Number(l.qty),
        })),
        priceList,
        salesman?.discountRules,
      ),
    [filledLines, priceList, salesman?.discountRules],
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

  const previousBalance = Math.max(
    0,
    (salesman?.pendingBalance ?? 0) -
      (isEdit && initialInvoice
        ? Math.max(0, initialInvoice.totalAmount - initialInvoice.amountPaid)
        : 0),
  );

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
    alternatePhone: "",
    entityType: "salesman",
    isActive: true,
    pendingBalance: 0,
    lastInvoiceAt: null,
    discountRules: [],
    marketDay: "",
    area: "",
    isDefaulter: false,
    tier: "",
    balanceThreshold: null,
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

  async function confirmSave() {
    if (!salesman || saving) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        salesmanId: salesman.id,
        number: draftNumber,
        issuedAt: isEdit ? issuedAt : new Date().toISOString(),
        lineItems: liveInvoice.lineItems,
        returnItems: liveInvoice.returnItems ?? [],
        discountAmount: liveInvoice.discountAmount ?? 0,
        paymentEntries: liveInvoice.paymentEntries ?? [],
        totalAmount: liveInvoice.totalAmount,
        amountPaid: liveInvoice.amountPaid,
        notes: liveInvoice.notes ?? null,
      };

      const res = await fetch(
        isEdit
          ? `/api/salesmen-invoices/${draftId}`
          : "/api/salesmen-invoices",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Could not save invoice.");
      }

      setConfirmOpen(false);
      router.push(`/entities/salesmen/${salesman.id}?tab=invoices`);
      router.refresh();
      // Keep saving until navigation completes.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save invoice.");
      setSaving(false);
    }
  }

  return (
    <>
      <TopBar
        context={context}
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Orders" },
          { label: isEdit ? "Edit invoice" : "Create invoice" },
        ]}
      />

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden print:hidden">
        <div className="flex shrink-0 flex-col gap-3 border-b border-border px-4 py-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <h1 className="text-xl font-medium tracking-tight sm:text-2xl">
              {isEdit ? "Edit Invoice" : "Create New Invoice"}
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
                            disabled={isEdit}
                            className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20 disabled:cursor-not-allowed disabled:opacity-70"
                            onFocus={() => {
                              if (!isEdit) setSalesmanOpen(true);
                            }}
                            onChange={(e) => {
                              if (isEdit) return;
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
                              if (isEdit) return;
                              if (e.key === "Escape") setSalesmanOpen(false);
                              if (e.key === "Enter" && filteredSalesmen[0]) {
                                e.preventDefault();
                                selectSalesman(filteredSalesmen[0]);
                              }
                            }}
                          />
                          {!isEdit &&
                            salesmanOpen &&
                            filteredSalesmen.length > 0 && (
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
                        {ENTITY_TYPE_LABELS[salesman.entityType]}
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
                      {salesman && salesman.discountRules.length > 0 ? (
                        <ul className="mt-1 space-y-0.5 text-xs text-muted">
                          {salesman.discountRules.map((rule) => (
                            <li key={rule.id}>{rule.description}</li>
                          ))}
                        </ul>
                      ) : salesman ? (
                        <p className="text-xs text-muted">
                          No discount rules on this salesman
                        </p>
                      ) : null}
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
                    bankAccounts={bankAccounts}
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
                      {isEdit ? "Save Changes" : "Generate Invoice"}
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
        title={isEdit ? "Save these changes?" : "Generate this invoice?"}
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
              onClick={confirmSave}
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-surface hover:bg-foreground/90 disabled:opacity-50"
            >
              {saving
                ? "Saving…"
                : isEdit
                  ? "Yes, save changes"
                  : "Yes, generate"}
            </button>
          </div>
        }
      >
        <p className="text-sm text-muted">
          {isEdit ? "Update" : "Create"} invoice{" "}
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
          {isEdit
            ? "Changes will replace the current invoice details."
            : `This will add the invoice to ${salesman?.name}'s invoice list.`}
        </p>
        {error && (
          <p className="mt-3 text-sm text-[#c45c26]" role="alert">
            {error}
          </p>
        )}
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
