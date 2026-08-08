"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { AppContext } from "@/app/(app)/layout";
import type { PendingPriceListApproval } from "@/lib/approvals/price-list";
import { notifyApprovalsCountChanged } from "@/lib/approvals/use-approvals-count";
import {
  ITEM_TYPE_LABELS,
  type ItemType,
} from "@/lib/auth/types";
import { formatINR, formatInvoiceDate } from "@/lib/salesmen/mock-data";
import type { PendingAdvanceApproval } from "@/lib/salesmen/advances";
import type { PendingReturnApproval } from "@/lib/salesmen/returns";
import type { PendingInvoiceApproval } from "@/lib/salesmen/queries";
import type { InvoiceLineItem, InvoicePaymentEntry } from "@/lib/salesmen/types";
import { formatVerificationAttribution } from "@/lib/salesmen/verification";

type ApprovalsClientProps = {
  context: AppContext;
  initialPending: PendingInvoiceApproval[];
  initialPendingAdvances?: PendingAdvanceApproval[];
  initialPendingReturns?: PendingReturnApproval[];
  initialPendingPriceList?: PendingPriceListApproval[];
};

export function ApprovalsClient({
  initialPending,
  initialPendingAdvances = [],
  initialPendingReturns = [],
  initialPendingPriceList = [],
}: ApprovalsClientProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialPending);
  const [advances, setAdvances] = useState(initialPendingAdvances);
  const [returns, setReturns] = useState(initialPendingReturns);
  const [priceListItems, setPriceListItems] = useState(initialPendingPriceList);
  const [expandedId, setExpandedId] = useState<string | null>(
    () =>
      initialPendingPriceList[0]?.item.id ??
      initialPending[0]?.invoice.id ??
      initialPendingAdvances[0]?.advance.id ??
      initialPendingReturns[0]?.returnRecord.id ??
      null,
  );
  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function review(
    invoiceId: string,
    action: "approve" | "send_back",
  ) {
    if (busyId) return;
    setBusyId(invoiceId);
    setError(null);
    try {
      const res = await fetch(`/api/salesmen-invoices/${invoiceId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          note: noteById[invoiceId]?.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Could not update verification.");
      }
      setItems((prev) => prev.filter((row) => row.invoice.id !== invoiceId));
      setExpandedId((curr) => (curr === invoiceId ? null : curr));
      notifyApprovalsCountChanged();
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update verification.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function reviewAdvance(
    advanceId: string,
    action: "approve" | "send_back",
  ) {
    if (busyId) return;
    setBusyId(advanceId);
    setError(null);
    try {
      const res = await fetch(`/api/salesmen/advances/${advanceId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          note: noteById[advanceId]?.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Could not update verification.");
      }
      setAdvances((prev) => prev.filter((row) => row.advance.id !== advanceId));
      setExpandedId((curr) => (curr === advanceId ? null : curr));
      notifyApprovalsCountChanged();
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update verification.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function reviewPriceList(itemId: string) {
    if (busyId) return;
    setBusyId(itemId);
    setError(null);
    try {
      const res = await fetch(`/api/price-list/${itemId}/approve`, {
        method: "POST",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Could not approve price change.");
      }
      setPriceListItems((prev) =>
        prev.filter((row) => row.item.id !== itemId),
      );
      setExpandedId((curr) => (curr === itemId ? null : curr));
      notifyApprovalsCountChanged();
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not approve price change.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function reviewReturn(
    returnId: string,
    action: "approve" | "send_back",
  ) {
    if (busyId) return;
    setBusyId(returnId);
    setError(null);
    try {
      const res = await fetch(`/api/salesmen/returns/${returnId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          note: noteById[returnId]?.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Could not update verification.");
      }
      setReturns((prev) =>
        prev.filter((row) => row.returnRecord.id !== returnId),
      );
      setExpandedId((curr) => (curr === returnId ? null : curr));
      notifyApprovalsCountChanged();
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update verification.",
      );
    } finally {
      setBusyId(null);
    }
  }

  const empty =
    items.length === 0 &&
    advances.length === 0 &&
    returns.length === 0 &&
    priceListItems.length === 0;

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl font-medium tracking-tight sm:text-2xl">
          Approvals
        </h1>
        <p className="mt-1 text-sm text-muted">
          Review salesman invoices, advance payments, returns, and price list
          changes submitted by accountants before they go live.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {empty ? (
        <div className="rounded-xl border border-border bg-surface px-4 py-12 text-center text-sm text-muted">
          Nothing waiting for verification
        </div>
      ) : (
        <div className="space-y-8">
          {priceListItems.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">
                Price list
              </h2>
              <ul className="space-y-3">
                {priceListItems.map(({ item, submittedByName }) => {
                  const date = formatInvoiceDate(item.updated_at);
                  const expanded = expandedId === item.id;
                  const busy = busyId === item.id;
                  const typeLabel =
                    ITEM_TYPE_LABELS[item.item_type as ItemType] ??
                    item.item_type;

                  return (
                    <li
                      key={item.id}
                      className="rounded-xl border border-border bg-surface"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(expanded ? null : item.id)
                        }
                        className="flex w-full items-start gap-3 px-4 py-3.5 text-left sm:gap-4 sm:px-5"
                        aria-expanded={expanded}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">
                              {item.item_name}
                            </p>
                            <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-violet-800 uppercase">
                              Price change
                            </span>
                            <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-sky-800 uppercase">
                              Pending
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-muted">
                            {typeLabel}
                            {item.count_label ? (
                              <>
                                <span className="mx-1.5 text-border">·</span>
                                {item.count_label}
                              </>
                            ) : null}
                            <span className="mx-1.5 text-border">·</span>
                            {date.monthYear} {date.day}, {date.time}
                          </p>
                          <p className="mt-1 text-[11px] text-muted">
                            Submitted by {submittedByName}
                          </p>
                        </div>
                        <div className="shrink-0 text-right text-sm">
                          <p className="tabular-nums">
                            Salesmen {formatINR(Number(item.salesmen_price))}
                          </p>
                          <p className="mt-0.5 tabular-nums text-muted">
                            Customer {formatINR(Number(item.customer_price))}
                          </p>
                        </div>
                      </button>

                      {expanded && (
                        <div className="border-t border-border px-4 py-4 sm:px-5">
                          <dl className="grid gap-2 text-sm sm:grid-cols-2">
                            <div>
                              <dt className="text-xs text-muted">Item</dt>
                              <dd className="font-medium">{item.item_name}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-muted">Type</dt>
                              <dd>{typeLabel}</dd>
                            </div>
                            {item.count_label ? (
                              <div>
                                <dt className="text-xs text-muted">Count</dt>
                                <dd>{item.count_label}</dd>
                              </div>
                            ) : null}
                            <div>
                              <dt className="text-xs text-muted">
                                Salesmen price
                              </dt>
                              <dd className="tabular-nums">
                                {formatINR(Number(item.salesmen_price))}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-xs text-muted">
                                Customer price
                              </dt>
                              <dd className="tabular-nums">
                                {formatINR(Number(item.customer_price))}
                              </dd>
                            </div>
                          </dl>
                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void reviewPriceList(item.id)}
                              className="rounded-lg bg-foreground px-3.5 py-2 text-sm font-medium text-background disabled:opacity-50"
                            >
                              {busy ? "Saving…" : "Approve"}
                            </button>
                            <a
                              href="/entities/price-list"
                              className="ml-auto text-sm text-muted underline underline-offset-2"
                            >
                              Open price list
                            </a>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {advances.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">
                Advance payments
              </h2>
              <ul className="space-y-3">
                {advances.map(({ advance, salesmanName, salesmanId }) => {
                  const date = formatInvoiceDate(advance.receivedAt);
                  const expanded = expandedId === advance.id;
                  const busy = busyId === advance.id;

                  return (
                    <li
                      key={advance.id}
                      className="rounded-xl border border-border bg-surface"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(expanded ? null : advance.id)
                        }
                        className="flex w-full items-start gap-3 px-4 py-3.5 text-left sm:gap-4 sm:px-5"
                        aria-expanded={expanded}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">Advance</p>
                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-emerald-800 uppercase">
                              Credit
                            </span>
                            <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-sky-800 uppercase">
                              Pending
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-muted">
                            {salesmanName}
                            <span className="mx-1.5 text-border">·</span>
                            {date.monthYear} {date.day}, {date.time}
                            <span className="mx-1.5 text-border">·</span>
                            <span className="capitalize">{advance.method}</span>
                          </p>
                          <p className="mt-1 text-[11px] text-muted">
                            {formatVerificationAttribution({
                              verificationStatus: advance.verificationStatus,
                              createdByName: advance.createdByName,
                              verifiedByName: advance.verifiedByName,
                            })}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-medium tabular-nums">
                            {formatINR(advance.amount)}
                          </p>
                        </div>
                      </button>

                      {expanded && (
                        <div className="border-t border-border px-4 py-4 sm:px-5">
                          <div className="mt-1">
                            <label
                              htmlFor={`adv-note-${advance.id}`}
                              className="text-xs font-medium tracking-wide text-muted uppercase"
                            >
                              Note (for send back)
                            </label>
                            <textarea
                              id={`adv-note-${advance.id}`}
                              rows={2}
                              value={noteById[advance.id] ?? ""}
                              onChange={(e) =>
                                setNoteById((prev) => ({
                                  ...prev,
                                  [advance.id]: e.target.value,
                                }))
                              }
                              className="mt-1.5 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-foreground/30"
                              placeholder="Optional reason for the accountant"
                            />
                          </div>
                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void reviewAdvance(advance.id, "approve")
                              }
                              className="rounded-lg bg-foreground px-3.5 py-2 text-sm font-medium text-background disabled:opacity-50"
                            >
                              {busy ? "Saving…" : "Approve"}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void reviewAdvance(advance.id, "send_back")
                              }
                              className="rounded-lg border border-border bg-white px-3.5 py-2 text-sm font-medium disabled:opacity-50"
                            >
                              Send back
                            </button>
                            <a
                              href={`/entities/salesmen/${salesmanId}?tab=payments`}
                              className="ml-auto text-sm text-muted underline underline-offset-2"
                            >
                              Open payments
                            </a>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {returns.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">
                Returns
              </h2>
              <ul className="space-y-3">
                {returns.map(({ returnRecord, salesmanName, salesmanId }) => {
                  const date = formatInvoiceDate(returnRecord.receivedAt);
                  const expanded = expandedId === returnRecord.id;
                  const busy = busyId === returnRecord.id;

                  return (
                    <li
                      key={returnRecord.id}
                      className="rounded-xl border border-border bg-surface"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(expanded ? null : returnRecord.id)
                        }
                        className="flex w-full items-start gap-3 px-4 py-3.5 text-left sm:gap-4 sm:px-5"
                        aria-expanded={expanded}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">Return</p>
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-amber-800 uppercase">
                              Credit
                            </span>
                            <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-sky-800 uppercase">
                              Pending
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-muted">
                            {salesmanName}
                            <span className="mx-1.5 text-border">·</span>
                            {date.monthYear} {date.day}, {date.time}
                            <span className="mx-1.5 text-border">·</span>
                            {returnRecord.lineItems.length} item
                            {returnRecord.lineItems.length === 1 ? "" : "s"}
                          </p>
                          <p className="mt-1 text-[11px] text-muted">
                            {formatVerificationAttribution({
                              verificationStatus:
                                returnRecord.verificationStatus,
                              createdByName: returnRecord.createdByName,
                              verifiedByName: returnRecord.verifiedByName,
                            })}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-medium tabular-nums text-warning">
                            −{formatINR(returnRecord.totalAmount)}
                          </p>
                        </div>
                      </button>

                      {expanded && (
                        <div className="border-t border-border px-4 py-4 sm:px-5">
                          <ul className="mb-3 space-y-1 text-xs text-muted">
                            {returnRecord.lineItems.map((line) => (
                              <li
                                key={line.id}
                                className="flex justify-between gap-3"
                              >
                                <span className="truncate">
                                  {line.name} × {line.qty}
                                </span>
                                <span className="tabular-nums text-foreground">
                                  {formatINR(line.amount)}
                                </span>
                              </li>
                            ))}
                          </ul>
                          <div className="mt-1">
                            <label
                              htmlFor={`ret-note-${returnRecord.id}`}
                              className="text-xs font-medium tracking-wide text-muted uppercase"
                            >
                              Note (for send back)
                            </label>
                            <textarea
                              id={`ret-note-${returnRecord.id}`}
                              rows={2}
                              value={noteById[returnRecord.id] ?? ""}
                              onChange={(e) =>
                                setNoteById((prev) => ({
                                  ...prev,
                                  [returnRecord.id]: e.target.value,
                                }))
                              }
                              className="mt-1.5 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-foreground/30"
                              placeholder="Optional reason for the accountant"
                            />
                          </div>
                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void reviewReturn(returnRecord.id, "approve")
                              }
                              className="rounded-lg bg-foreground px-3.5 py-2 text-sm font-medium text-background disabled:opacity-50"
                            >
                              {busy ? "Saving…" : "Approve"}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void reviewReturn(returnRecord.id, "send_back")
                              }
                              className="rounded-lg border border-border bg-white px-3.5 py-2 text-sm font-medium disabled:opacity-50"
                            >
                              Send back
                            </button>
                            <a
                              href={`/entities/salesmen/${salesmanId}?tab=returns`}
                              className="ml-auto text-sm text-muted underline underline-offset-2"
                            >
                              Open returns
                            </a>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {items.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">
                Invoices
              </h2>
              <ul className="space-y-3">
                {items.map(
                  ({
                    invoice,
                    salesmanName,
                    previousBalance,
                    chargedTotal,
                  }) => {
                  const date = formatInvoiceDate(invoice.issuedAt);
                  const expanded = expandedId === invoice.id;
                  const busy = busyId === invoice.id;
                  const closingBalance =
                    Math.round(
                      (previousBalance +
                        invoice.totalAmount -
                        invoice.amountPaid) *
                        100,
                    ) / 100;

                  return (
                    <li
                      key={invoice.id}
                      className="rounded-xl border border-border bg-surface"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(expanded ? null : invoice.id)
                        }
                        className="flex w-full items-start gap-3 px-4 py-3.5 text-left sm:gap-4 sm:px-5"
                        aria-expanded={expanded}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">
                              {salesmanName}
                            </p>
                            <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-sky-800 uppercase">
                              Pending
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-muted">
                            {invoice.number}
                          </p>
                          <p className="mt-0.5 text-xs text-muted">
                            {date.monthYear} {date.day}, {date.time}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-medium tabular-nums">
                            {formatINR(chargedTotal)}
                          </p>
                          <p className="mt-0.5 text-xs text-muted tabular-nums">
                            Paid {formatINR(invoice.amountPaid)}
                          </p>
                        </div>
                      </button>

                      {expanded && (
                        <div className="border-t border-border px-4 py-4 sm:px-5">
                          <div className="space-y-4">
                            <ApprovalInvoiceLineTable
                              title="Line items"
                              items={invoice.lineItems}
                            />

                            {(invoice.returnItems?.length ?? 0) > 0 && (
                              <ApprovalInvoiceLineTable
                                title="Returns"
                                items={invoice.returnItems!}
                                isReturn
                              />
                            )}

                            {invoice.notes ? (
                              <div>
                                <h3 className="text-xs font-medium tracking-wide text-muted uppercase">
                                  Notes
                                </h3>
                                <p className="mt-2 text-sm leading-relaxed text-foreground">
                                  {invoice.notes}
                                </p>
                              </div>
                            ) : null}

                            <div className="sm:flex sm:justify-end">
                              <div className="w-full sm:max-w-md">
                                <ApprovalInvoiceTotals
                                  invoice={invoice}
                                  previousBalance={previousBalance}
                                  closingBalance={closingBalance}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="mt-4">
                            <label
                              htmlFor={`note-${invoice.id}`}
                              className="text-xs font-medium tracking-wide text-muted uppercase"
                            >
                              Note (for send back)
                            </label>
                            <textarea
                              id={`note-${invoice.id}`}
                              rows={2}
                              value={noteById[invoice.id] ?? ""}
                              onChange={(e) =>
                                setNoteById((prev) => ({
                                  ...prev,
                                  [invoice.id]: e.target.value,
                                }))
                              }
                              className="mt-1.5 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-foreground/30"
                              placeholder="Optional reason for the accountant"
                            />
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void review(invoice.id, "approve")
                              }
                              className="rounded-lg bg-foreground px-3.5 py-2 text-sm font-medium text-background disabled:opacity-50"
                            >
                              {busy ? "Saving…" : "Approve"}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void review(invoice.id, "send_back")
                              }
                              className="rounded-lg border border-border bg-white px-3.5 py-2 text-sm font-medium disabled:opacity-50"
                            >
                              Send back
                            </button>
                            <p className="ml-auto text-sm text-muted">
                              Created by{" "}
                              {invoice.createdByName ?? "Unknown"}
                            </p>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function formatPaidLabel(payment: InvoicePaymentEntry): string {
  const method =
    payment.method.charAt(0).toUpperCase() + payment.method.slice(1);
  if (payment.advanceId) return `${method} (advance)`;
  if (payment.chequeNumber) return `${method} #${payment.chequeNumber}`;
  if (payment.senderName) return `${method} · ${payment.senderName}`;
  return method;
}

function ApprovalInvoiceLineTable({
  title,
  items,
  isReturn = false,
}: {
  title: string;
  items: InvoiceLineItem[];
  isReturn?: boolean;
}) {
  return (
    <div>
      <h3 className="text-xs font-medium tracking-wide text-muted uppercase">
        {title}
      </h3>
      <div className="mt-2 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-table-header text-left text-xs text-muted">
              <th className="w-8 px-2 py-1.5 font-medium text-right">#</th>
              <th className="px-2.5 py-1.5 font-medium">Item</th>
              <th className="w-14 px-2.5 py-1.5 font-medium text-right">Qty</th>
              <th className="hidden w-16 px-2.5 py-1.5 font-medium text-right sm:table-cell">
                Rate
              </th>
              <th className="w-20 px-2.5 py-1.5 font-medium text-right">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((line, index) => (
              <tr
                key={line.id}
                className="border-b border-border last:border-0"
              >
                <td className="px-2 py-2 text-right text-xs tabular-nums text-muted">
                  {index + 1}
                </td>
                <td className="max-w-0 px-2.5 py-2">
                  <span className="block truncate" title={line.name}>
                    {line.name}
                  </span>
                </td>
                <td className="px-2.5 py-2 text-right font-medium tabular-nums">
                  {line.qty}
                </td>
                <td className="hidden px-2.5 py-2 text-right tabular-nums sm:table-cell">
                  {formatINR(line.unitPrice)}
                </td>
                <td
                  className={`px-2.5 py-2 text-right tabular-nums ${
                    isReturn ? "text-warning" : ""
                  }`}
                >
                  {isReturn ? "−" : ""}
                  {formatINR(line.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ApprovalTotalRow({
  label,
  value,
  emphasize = false,
  credit = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  credit?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-4 ${
        emphasize || credit ? "font-medium" : ""
      }`}
    >
      <span className={emphasize || credit ? undefined : "text-muted"}>
        {label}
      </span>
      <span
        className={`tabular-nums ${
          emphasize ? "text-warning" : credit ? "text-credit" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function ApprovalInvoiceTotals({
  invoice,
  previousBalance,
  closingBalance,
}: {
  invoice: PendingInvoiceApproval["invoice"];
  previousBalance: number;
  closingBalance: number;
}) {
  const grossSubtotal = invoice.lineItems.reduce(
    (sum, item) => sum + item.amount,
    0,
  );
  const returnsTotal =
    invoice.returnItems?.reduce((sum, item) => sum + item.amount, 0) ?? 0;
  const discountAmount = invoice.discountAmount ?? 0;
  const additionalAmount = invoice.additionalAmount ?? 0;
  const additionalAmountLabel = invoice.additionalAmountReason
    ? `Additional amount (${invoice.additionalAmountReason})`
    : "Additional amount";

  return (
    <div>
      <h3 className="text-xs font-medium tracking-wide text-muted uppercase">
        Summary
      </h3>
      <div className="mt-2 space-y-1.5 rounded-lg border border-border bg-[#fafaf8] px-3 py-3 text-sm">
        <ApprovalTotalRow label="Subtotal" value={formatINR(grossSubtotal)} />
        {returnsTotal > 0 && (
          <ApprovalTotalRow
            label="Returns"
            value={`−${formatINR(returnsTotal)}`}
          />
        )}
        {discountAmount > 0 && (
          <ApprovalTotalRow
            label="Discount"
            value={`−${formatINR(discountAmount)}`}
          />
        )}
        {additionalAmount > 0 && (
          <ApprovalTotalRow
            label={additionalAmountLabel}
            value={`+${formatINR(additionalAmount)}`}
          />
        )}
        <ApprovalTotalRow
          label="Invoice total"
          value={formatINR(invoice.totalAmount)}
        />
        <ApprovalTotalRow
          label="Prev. balance"
          value={formatINR(previousBalance)}
        />
        {(invoice.paymentEntries ?? []).length === 0 ? (
          <ApprovalTotalRow label="Paid" value={formatINR(invoice.amountPaid)} />
        ) : (
          (invoice.paymentEntries ?? []).map((payment) => (
            <ApprovalTotalRow
              key={payment.id}
              label={`Paid · ${formatPaidLabel(payment)}`}
              value={formatINR(payment.amount)}
            />
          ))
        )}
        <div className="border-t border-border pt-1.5">
          <ApprovalTotalRow
            label="Closing"
            value={formatINR(closingBalance)}
            emphasize={closingBalance > 0}
            credit={closingBalance < 0}
          />
        </div>
      </div>
    </div>
  );
}
