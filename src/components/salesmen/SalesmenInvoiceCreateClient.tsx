"use client";

import { useEffect, useMemo, useState } from "react";
import type { AppContext } from "@/app/(app)/layout";
import { TopBar } from "@/components/layout/AppShell";
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
  buildWhatsAppShareUrl,
  calculateSalesmanDiscount,
  formatINR,
} from "@/lib/salesmen/mock-data";
import type { Invoice, InvoiceLineItem, Salesman } from "@/lib/salesmen/types";

type SalesmenInvoiceCreateClientProps = {
  context: AppContext;
  salesmen: Salesman[];
  priceList: PriceListItem[];
};

export function SalesmenInvoiceCreateClient({
  context,
  salesmen,
  priceList,
}: SalesmenInvoiceCreateClientProps) {
  const [draftId] = useState(() => `inv-draft-${Date.now()}`);
  const [draftNumber] = useState(() => `INV-SM-${Date.now()}`);
  const [issuedAt] = useState(() => new Date().toISOString());

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
  const [discount, setDiscount] = useState("");
  const [discountManual, setDiscountManual] = useState(false);
  const [amountPaid, setAmountPaid] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);

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

  const suggestedDiscount = useMemo(
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

  useEffect(() => {
    if (discountManual) return;
    setDiscount(suggestedDiscount > 0 ? String(suggestedDiscount) : "");
  }, [suggestedDiscount, discountManual]);

  const discountNum = Number(discount);
  const discountAmount =
    Number.isFinite(discountNum) && discountNum > 0 ? discountNum : 0;

  const invoiceTotal = Math.max(0, subtotal - returnAmount - discountAmount);

  const previousBalance = salesman?.pendingBalance ?? 0;
  const paidNum = Number(amountPaid);
  const paid = Number.isFinite(paidNum) && paidNum > 0 ? paidNum : 0;

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
      amountPaid: paid,
      lineItems,
      discountAmount: discountAmount > 0 ? discountAmount : undefined,
      returnItems,
    };
  }, [
    draftId,
    draftNumber,
    issuedAt,
    filledLines,
    filledReturn,
    salesman?.id,
    invoiceTotal,
    paid,
    discountAmount,
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
    setDiscountManual(false);
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

  function validateForGenerate(): boolean {
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

  function handleGenerateClick() {
    if (!validateForGenerate()) return;
    setGenerateOpen(true);
  }

  function handlePrint() {
    requestAnimationFrame(() => {
      window.setTimeout(() => window.print(), 50);
    });
  }

  function handleWhatsApp() {
    if (!salesman) return;
    const url = buildWhatsAppShareUrl(
      salesman.phone,
      liveInvoice,
      salesman.name,
    );
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handleBoth() {
    handleWhatsApp();
    handlePrint();
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
        <div className="flex shrink-0 flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="min-w-0">
            <h1 className="text-xl font-medium tracking-tight sm:text-2xl">
              Create New Invoice
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleGenerateClick}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-surface hover:bg-foreground/90"
            >
              Generate Invoice
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-2">
          <div className="min-h-0 overflow-y-auto border-b border-border px-4 py-5 sm:px-6 lg:border-b-0 lg:border-r lg:px-8">
            <div className="mx-auto max-w-2xl space-y-6">
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
                          window.setTimeout(() => setSalesmanOpen(false), 150);
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
                    {salesman.discountRule ? (
                      <>
                        {" · "}
                        <span className="text-foreground">
                          {salesman.discountRule.description}
                        </span>
                      </>
                    ) : null}
                  </p>
                )}
              </section>

              <section className="space-y-3">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-base font-medium">Items Details</h2>
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
                    <p className="text-xs text-muted">
                      Return amount is subtracted from the invoice total.
                    </p>
                  </div>
                )}

                <div>
                  <span className="mb-1.5 block text-xs font-medium text-muted">
                    Subtotal
                  </span>
                  <div className="flex overflow-hidden rounded-lg border border-border bg-sidebar">
                    <span className="flex items-center border-r border-border px-3 text-sm text-muted">
                      ₹
                    </span>
                    <p className="min-w-0 flex-1 px-3 py-2.5 text-sm tabular-nums">
                      {subtotal.toLocaleString("en-IN", {
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                </div>

                <label className="block">
                  <span className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2 text-xs font-medium text-muted">
                    <span>Discount</span>
                    {salesman?.discountRule && suggestedDiscount > 0 && (
                      <span className="font-normal">
                        Auto: {formatINR(suggestedDiscount)}
                        {discountManual ? (
                          <>
                            {" · "}
                            <button
                              type="button"
                              className="underline-offset-2 hover:underline"
                              onClick={() => {
                                setDiscountManual(false);
                                setDiscount(String(suggestedDiscount));
                              }}
                            >
                              Reset
                            </button>
                          </>
                        ) : null}
                      </span>
                    )}
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
                      value={discount}
                      placeholder="0"
                      disabled={!salesman}
                      className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm tabular-nums outline-none disabled:opacity-50"
                      onChange={(e) => {
                        setDiscountManual(true);
                        setDiscount(e.target.value);
                      }}
                    />
                  </div>
                  {salesman?.discountRule && (
                    <p className="mt-1 text-xs text-muted">
                      Rule: {salesman.discountRule.description}
                    </p>
                  )}
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-muted">
                    Amount paid
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
                      value={amountPaid}
                      placeholder="0"
                      disabled={!salesman}
                      className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm tabular-nums outline-none disabled:opacity-50"
                      onChange={(e) => setAmountPaid(e.target.value)}
                    />
                  </div>
                </label>

                {(returnAmount > 0 || discountAmount > 0) && (
                  <p className="text-sm tabular-nums text-muted">
                    Invoice total:{" "}
                    <span className="font-medium text-foreground">
                      {formatINR(invoiceTotal)}
                    </span>
                  </p>
                )}
              </section>

              {error && (
                <p className="text-sm text-[#c45c26]" role="alert">
                  {error}
                </p>
              )}

              <div className="pb-4 lg:hidden">
                <button
                  type="button"
                  onClick={handleGenerateClick}
                  className="w-full rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-surface hover:bg-foreground/90"
                >
                  Generate Invoice
                </button>
              </div>
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
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        title="Generate Invoice"
        footer={
          <button
            type="button"
            onClick={() => setGenerateOpen(false)}
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-sidebar"
          >
            Cancel
          </button>
        }
      >
        <p className="text-sm text-muted">
          Invoice{" "}
          <span className="font-medium text-foreground">
            {liveInvoice.number}
          </span>{" "}
          for{" "}
          <span className="font-medium text-foreground">
            {salesman?.name}
          </span>
          . How would you like to deliver it?
        </p>
        <div className="mt-5 grid gap-2">
          <ActionChoice
            label="Send via WhatsApp"
            description={`Opens WhatsApp to ${salesman?.name ?? "salesman"}`}
            onClick={() => {
              handleWhatsApp();
              setGenerateOpen(false);
            }}
          />
          <ActionChoice
            label="Print"
            description="Open the print dialog for this invoice"
            onClick={() => {
              setGenerateOpen(false);
              handlePrint();
            }}
          />
          <ActionChoice
            label="Both"
            description="Send on WhatsApp and print"
            primary
            onClick={() => {
              setGenerateOpen(false);
              handleBoth();
            }}
          />
        </div>
      </Modal>
    </>
  );
}

function ActionChoice({
  label,
  description,
  onClick,
  primary = false,
}: {
  label: string;
  description: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left transition-colors ${
        primary
          ? "border-foreground bg-foreground text-surface hover:bg-foreground/90"
          : "border-border bg-surface hover:bg-sidebar"
      }`}
    >
      <span className="block text-sm font-medium">{label}</span>
      <span
        className={`mt-0.5 block text-xs ${
          primary ? "text-surface/70" : "text-muted"
        }`}
      >
        {description}
      </span>
    </button>
  );
}
