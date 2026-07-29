"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { AppContext } from "@/app/(app)/layout";
import { formatINR, formatInvoiceDate } from "@/lib/salesmen/mock-data";
import type { PendingInvoiceApproval } from "@/lib/salesmen/queries";
import { formatVerificationAttribution } from "@/lib/salesmen/verification";

type ApprovalsClientProps = {
  context: AppContext;
  initialPending: PendingInvoiceApproval[];
};

export function ApprovalsClient({
  initialPending,
}: ApprovalsClientProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialPending);
  const [expandedId, setExpandedId] = useState<string | null>(
    () => initialPending[0]?.invoice.id ?? null,
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

  return (
    <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl font-medium tracking-tight sm:text-2xl">
          Approvals
        </h1>
        <p className="mt-1 text-sm text-muted">
          Review salesman invoices submitted by accountants before they affect
          balances.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-4 py-12 text-center text-sm text-muted">
          No invoices waiting for verification
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map(({ invoice, salesmanName, salesmanId }) => {
            const date = formatInvoiceDate(invoice.issuedAt);
            const expanded = expandedId === invoice.id;
            const busy = busyId === invoice.id;

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
                      <p className="text-sm font-medium">{invoice.number}</p>
                      <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-sky-800 uppercase">
                        Pending
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {salesmanName}
                      <span className="mx-1.5 text-border">·</span>
                      {date.monthYear} {date.day}, {date.time}
                    </p>
                    <p className="mt-1 text-[11px] text-muted">
                      {formatVerificationAttribution({
                        verificationStatus: invoice.verificationStatus,
                        createdByName: invoice.createdByName,
                        verifiedByName: invoice.verifiedByName,
                      })}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium tabular-nums">
                      {formatINR(invoice.totalAmount)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted tabular-nums">
                      Paid {formatINR(invoice.amountPaid)}
                    </p>
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-border px-4 py-4 sm:px-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <h3 className="text-xs font-medium tracking-wide text-muted uppercase">
                          Line items
                        </h3>
                        <ul className="mt-2 space-y-1.5 text-sm">
                          {invoice.lineItems.map((line) => (
                            <li
                              key={line.id}
                              className="flex justify-between gap-3"
                            >
                              <span className="min-w-0 truncate">
                                {line.name}{" "}
                                <span className="text-muted">
                                  ×{line.qty}
                                </span>
                              </span>
                              <span className="shrink-0 tabular-nums">
                                {formatINR(line.amount)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h3 className="text-xs font-medium tracking-wide text-muted uppercase">
                          Payments
                        </h3>
                        {(invoice.paymentEntries ?? []).length === 0 ? (
                          <p className="mt-2 text-sm text-muted">
                            No payments recorded
                          </p>
                        ) : (
                          <ul className="mt-2 space-y-1.5 text-sm">
                            {(invoice.paymentEntries ?? []).map((p) => (
                              <li
                                key={p.id}
                                className="flex justify-between gap-3"
                              >
                                <span className="capitalize">{p.method}</span>
                                <span className="tabular-nums">
                                  {formatINR(p.amount)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
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
                        onClick={() => review(invoice.id, "approve")}
                        className="rounded-lg bg-foreground px-3.5 py-2 text-sm font-medium text-background disabled:opacity-50"
                      >
                        {busy ? "Saving…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => review(invoice.id, "send_back")}
                        className="rounded-lg border border-border bg-white px-3.5 py-2 text-sm font-medium disabled:opacity-50"
                      >
                        Send back
                      </button>
                      <a
                        href={`/entities/salesmen/${salesmanId}?tab=invoices`}
                        className="ml-auto text-sm text-muted underline underline-offset-2"
                      >
                        Open entity
                      </a>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
