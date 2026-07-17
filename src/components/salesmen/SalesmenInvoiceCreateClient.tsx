"use client";

import { useEffect, useMemo, useState } from "react";
import type { AppContext } from "@/app/(app)/layout";
import { TopBar } from "@/components/layout/AppShell";
import { InvoicePreview } from "@/components/salesmen/InvoicePreview";
import {
  createEmptyDraftLine,
  InvoiceLineEntry,
  type DraftLine,
} from "@/components/salesmen/InvoiceLineEntry";
import type { PriceListItem } from "@/lib/auth/types";
import {
  buildWhatsAppShareUrl,
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
  const [salesmanId, setSalesmanId] = useState("");
  const [salesmanQuery, setSalesmanQuery] = useState("");
  const [salesmanOpen, setSalesmanOpen] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>([createEmptyDraftLine()]);
  const [amountPaid, setAmountPaid] = useState("");
  const [notes, setNotes] = useState("");
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    function sync() {
      setIsNarrow(mq.matches);
    }
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

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

  const previousBalance = salesman?.pendingBalance ?? 0;
  const paidNum = Number(amountPaid);
  const paid = Number.isFinite(paidNum) && paidNum > 0 ? paidNum : 0;
  const closingBalance = previousBalance + subtotal - paid;

  function selectSalesman(s: Salesman) {
    setSalesmanId(s.id);
    setSalesmanQuery(s.name);
    setSalesmanOpen(false);
    setError(null);
  }

  function buildInvoice(): Invoice | null {
    if (!salesman) {
      setError("Select a salesman first.");
      return null;
    }
    if (filledLines.length === 0) {
      setError("Add at least one line item with quantity.");
      return null;
    }

    const lineItems: InvoiceLineItem[] = filledLines.map((l) => ({
      id: l.key,
      name: l.name,
      qty: Number(l.qty),
      unitPrice: l.unitPrice,
      amount: l.amount,
      priceListItemId: l.priceListItemId ?? undefined,
    }));

    const stamp = Date.now();
    return {
      id: `inv-draft-${stamp}`,
      number: `INV-SM-${stamp}`,
      salesmanId: salesman.id,
      issuedAt: new Date().toISOString(),
      itemCount: lineItems.length,
      totalAmount: subtotal,
      amountPaid: paid,
      lineItems,
      notes: notes.trim() || undefined,
    };
  }

  function handlePreview() {
    const invoice = buildInvoice();
    if (!invoice) return;
    setError(null);
    setPreviewInvoice(invoice);
  }

  function handlePrint() {
    if (!previewInvoice) return;
    requestAnimationFrame(() => {
      window.setTimeout(() => window.print(), 50);
    });
  }

  function handleWhatsApp() {
    if (!previewInvoice || !salesman) return;
    const url = buildWhatsAppShareUrl(
      salesman.phone,
      previewInvoice,
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
          { label: "Orders" },
          { label: "Salesmen invoice" },
        ]}
      />

      <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8 print:hidden">
        <div className="mb-5 sm:mb-6">
          <h1 className="text-xl font-medium tracking-tight sm:text-2xl">
            New salesmen invoice
          </h1>
          <p className="mt-1 text-sm text-muted">
            Select a salesman, then enter items with Tab — rates from the price
            list
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] lg:items-start">
          <div className="space-y-5">
            <section className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block min-w-0">
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
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20"
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
                  <div className="rounded-lg border border-border bg-sidebar px-3 py-2 text-sm tabular-nums">
                    {salesman ? formatINR(previousBalance) : "—"}
                  </div>
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

            <section className="space-y-2">
              <h2 className="text-sm font-medium">Line items</h2>
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
            </section>

            <section className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-muted">
                  Amount paid
                </span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={amountPaid}
                  placeholder="0"
                  disabled={!salesman}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm tabular-nums outline-none focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20 disabled:opacity-50"
                  onChange={(e) => setAmountPaid(e.target.value)}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs font-medium text-muted">
                  Notes
                </span>
                <textarea
                  value={notes}
                  rows={2}
                  disabled={!salesman}
                  placeholder="Optional"
                  className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20 disabled:opacity-50"
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
            </section>

            {error && (
              <p className="text-sm text-[#c45c26]" role="alert">
                {error}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handlePreview}
                className="rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-surface hover:bg-foreground/90"
              >
                Preview invoice
              </button>
              <p className="text-xs text-muted">
                Preview only — saving to the ledger comes next.
              </p>
            </div>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-4">
            <div className="rounded-xl border border-border bg-surface p-4">
              <h2 className="text-sm font-medium">Totals</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-4 text-muted">
                  <dt>Invoice subtotal</dt>
                  <dd className="tabular-nums text-foreground">
                    {formatINR(subtotal)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 text-muted">
                  <dt>Previous balance</dt>
                  <dd className="tabular-nums text-foreground">
                    {formatINR(previousBalance)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 text-muted">
                  <dt>Amount paid</dt>
                  <dd className="tabular-nums text-foreground">
                    {formatINR(paid)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-border pt-2 font-medium">
                  <dt>Closing balance</dt>
                  <dd
                    className={`tabular-nums ${
                      closingBalance > 0 ? "text-[#c45c26]" : ""
                    }`}
                  >
                    {formatINR(closingBalance)}
                  </dd>
                </div>
              </dl>
            </div>

            {previewInvoice && salesman && !isNarrow && (
              <div className="hidden lg:block">
                <InvoicePreview
                  invoice={previewInvoice}
                  salesman={salesman}
                  onClose={() => setPreviewInvoice(null)}
                  onEdit={() => setPreviewInvoice(null)}
                  onPrint={handlePrint}
                  onWhatsApp={handleWhatsApp}
                />
              </div>
            )}
          </aside>
        </div>
      </main>

      {previewInvoice && salesman && isNarrow && (
        <InvoicePreview
          invoice={previewInvoice}
          salesman={salesman}
          asOverlay
          onClose={() => setPreviewInvoice(null)}
          onEdit={() => setPreviewInvoice(null)}
          onPrint={handlePrint}
          onWhatsApp={handleWhatsApp}
        />
      )}

      {previewInvoice && salesman && (
        <div className="hidden print:block">
          <InvoicePreview
            invoice={previewInvoice}
            salesman={salesman}
            forPrint
            onClose={() => undefined}
            onEdit={() => undefined}
            onPrint={() => undefined}
            onWhatsApp={() => undefined}
          />
        </div>
      )}
    </>
  );
}
