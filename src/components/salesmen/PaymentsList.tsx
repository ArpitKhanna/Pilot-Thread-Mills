"use client";

import { useMemo, useState } from "react";
import { formatBankAccountLabel } from "@/lib/bank-accounts/mappers";
import type { BankAccount } from "@/lib/bank-accounts/types";
import {
  formatINR,
  formatInvoiceDate,
} from "@/lib/salesmen/mock-data";
import { canMutateWithinWindow } from "@/lib/salesmen/record-window";
import type {
  Invoice,
  InvoicePaymentEntry,
  InvoicePaymentMethod,
  SalesmanAdvance,
} from "@/lib/salesmen/types";
import { verificationStatusLabel } from "@/lib/salesmen/verification";
import { Modal } from "@/components/ui/Modal";

type PaymentsListProps = {
  invoices: Invoice[];
  advances?: SalesmanAdvance[];
  bankAccounts: BankAccount[];
  onAdvancesChange?: (advances: SalesmanAdvance[]) => void;
  onInvoicesChange?: (invoices: Invoice[]) => void;
  onAddPayment?: () => void;
  onLedgerChanged?: () => void;
};

type LedgerItem =
  | {
      kind: "invoice-payment";
      invoice: Invoice;
      payment: InvoicePaymentEntry;
      at: string;
    }
  | { kind: "advance"; advance: SalesmanAdvance; at: string };

const METHOD_LABELS: Record<InvoicePaymentMethod, string> = {
  cash: "Cash",
  cheque: "Cheque",
  upi: "UPI",
  imps: "IMPS",
};

function groupByMonth(items: LedgerItem[]) {
  const groups: { label: string; items: LedgerItem[] }[] = [];
  for (const item of items) {
    const label = formatInvoiceDate(item.at).monthYear;
    const existing = groups.find((g) => g.label === label);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.push({ label, items: [item] });
    }
  }
  return groups;
}

function paymentReceivedAt(
  payment: InvoicePaymentEntry,
  invoice: Invoice,
): string {
  return payment.receivedAt ?? invoice.issuedAt;
}

function ledgerItemId(item: LedgerItem): string {
  return item.kind === "advance"
    ? item.advance.id
    : `${item.invoice.id}-${item.payment.id}`;
}

function buildLedger(
  paidInvoices: Invoice[],
  advances: SalesmanAdvance[],
): LedgerItem[] {
  const items: LedgerItem[] = [
    ...paidInvoices.flatMap((invoice) =>
      resolveEntries(invoice).map((payment) => ({
        kind: "invoice-payment" as const,
        invoice,
        payment,
        at: paymentReceivedAt(payment, invoice),
      })),
    ),
    ...advances.map((advance) => ({
      kind: "advance" as const,
      advance,
      at: advance.receivedAt,
    })),
  ];
  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return items;
}

function invoicesWithPayments(invoices: Invoice[]): Invoice[] {
  return invoices.filter(
    (inv) =>
      inv.amountPaid > 0 ||
      (inv.paymentEntries != null && inv.paymentEntries.length > 0),
  );
}

export function PaymentsList({
  invoices,
  advances = [],
  bankAccounts,
  onAdvancesChange,
  onInvoicesChange,
  onAddPayment,
  onLedgerChanged,
}: PaymentsListProps) {
  const paidInvoices = invoicesWithPayments(invoices);

  const ledger = useMemo(
    () => buildLedger(paidInvoices, advances),
    [paidInvoices, advances],
  );

  const [cancelTarget, setCancelTarget] = useState<
    | { type: "invoice"; payment: InvoicePaymentEntry; invoiceId: string }
    | { type: "advance"; advance: SalesmanAdvance }
    | null
  >(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SalesmanAdvance | null>(
    null,
  );
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteLockedOpen, setDeleteLockedOpen] = useState(false);

  const accountById = new Map(bankAccounts.map((a) => [a.id, a]));

  async function confirmCancel() {
    if (!cancelTarget || cancelBusy) return;
    setCancelBusy(true);
    setCancelError("");
    try {
      if (cancelTarget.type === "advance") {
        const res = await fetch(
          `/api/salesmen/advances/${cancelTarget.advance.id}/cancel`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: cancelReason.trim() || undefined }),
          },
        );
        const data = (await res.json()) as {
          advance?: SalesmanAdvance;
          error?: string;
        };
        if (!res.ok || !data.advance) {
          throw new Error(data.error || "Could not cancel cheque.");
        }
        onAdvancesChange?.(
          advances.map((a) =>
            a.id === data.advance!.id ? data.advance! : a,
          ),
        );
      } else {
        const res = await fetch(
          `/api/salesmen-invoice-payments/${cancelTarget.payment.id}/cancel`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: cancelReason.trim() || undefined }),
          },
        );
        const data = (await res.json()) as {
          invoiceId?: string;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error || "Could not cancel cheque.");
        }
        // Refresh payment status locally
        onInvoicesChange?.(
          invoices.map((inv) => {
            if (inv.id !== cancelTarget.invoiceId) return inv;
            const entries = (inv.paymentEntries ?? []).map((p) =>
              p.id === cancelTarget.payment.id
                ? {
                    ...p,
                    status: "cancelled" as const,
                    cancelledAt: new Date().toISOString(),
                    cancelReason: cancelReason.trim() || null,
                  }
                : p,
            );
            const amountPaid = entries
              .filter((p) => p.status !== "cancelled")
              .reduce((s, p) => s + p.amount, 0);
            return { ...inv, paymentEntries: entries, amountPaid };
          }),
        );
      }
      setCancelTarget(null);
      setCancelReason("");
      onLedgerChanged?.();
    } catch (err) {
      setCancelError(
        err instanceof Error ? err.message : "Could not cancel cheque.",
      );
    } finally {
      setCancelBusy(false);
    }
  }

  async function confirmDeleteAdvance() {
    if (!deleteTarget || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      const res = await fetch(
        `/api/salesmen/advances/${deleteTarget.id}`,
        { method: "DELETE" },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Could not delete payment.");
      }
      onAdvancesChange?.(advances.filter((a) => a.id !== deleteTarget.id));
      setDeleteTarget(null);
      onLedgerChanged?.();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Could not delete payment.",
      );
    } finally {
      setDeleteBusy(false);
    }
  }

  if (ledger.length === 0) {
    return (
      <div className="space-y-3">
        {onAddPayment && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onAddPayment}
              className="rounded-lg bg-foreground px-3.5 py-2 text-sm font-medium text-surface hover:bg-foreground/90"
            >
              Add payment
            </button>
          </div>
        )}
        <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-12 text-center">
          <p className="text-sm text-muted">No payments recorded yet</p>
          {onAddPayment && (
            <button
              type="button"
              onClick={onAddPayment}
              className="mt-4 rounded-lg bg-foreground px-3.5 py-2 text-sm font-medium text-surface hover:bg-foreground/90"
            >
              Add payment
            </button>
          )}
        </div>
      </div>
    );
  }

  const groups = groupByMonth(ledger);

  return (
    <div className="space-y-5">
      {onAddPayment && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onAddPayment}
            className="rounded-lg bg-foreground px-3.5 py-2 text-sm font-medium text-surface hover:bg-foreground/90"
          >
            Add payment
          </button>
        </div>
      )}

      {groups.map((group) => (
        <section key={group.label}>
          <h3 className="mb-2 px-1 text-xs font-medium tracking-wide text-muted uppercase">
            {group.label}
          </h3>
          <ul className="space-y-1 rounded-xl border border-border bg-surface p-1">
            {group.items.map((item) => {
              if (item.kind === "advance") {
                return (
                  <AdvanceRow
                    key={ledgerItemId(item)}
                    advance={item.advance}
                    accountById={accountById}
                    onCancelCheque={() =>
                      setCancelTarget({
                        type: "advance",
                        advance: item.advance,
                      })
                    }
                    onDelete={() => {
                      const a = item.advance;
                      const unapplied =
                        Math.round(a.remainingAmount * 100) ===
                        Math.round(a.amount * 100);
                      if (
                        !canMutateWithinWindow(a.createdAt) ||
                        !unapplied ||
                        a.status === "cancelled"
                      ) {
                        setDeleteLockedOpen(true);
                        return;
                      }
                      setDeleteTarget(a);
                    }}
                  />
                );
              }

              return (
                <InvoicePaymentRow
                  key={ledgerItemId(item)}
                  invoice={item.invoice}
                  payment={item.payment}
                  receivedAt={item.at}
                  accountById={accountById}
                  onCancelCheque={() =>
                    setCancelTarget({
                      type: "invoice",
                      payment: item.payment,
                      invoiceId: item.invoice.id,
                    })
                  }
                />
              );
            })}
          </ul>
        </section>
      ))}

      <Modal
        open={Boolean(cancelTarget)}
        onClose={() => {
          if (cancelBusy) return;
          setCancelTarget(null);
          setCancelReason("");
          setCancelError("");
        }}
        title="Cancel returned cheque"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={cancelBusy}
              onClick={() => {
                setCancelTarget(null);
                setCancelReason("");
                setCancelError("");
              }}
              className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-sidebar disabled:opacity-40"
            >
              Keep
            </button>
            <button
              type="button"
              disabled={cancelBusy}
              onClick={() => void confirmCancel()}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
            >
              {cancelBusy ? "Cancelling…" : "Cancel cheque"}
            </button>
          </div>
        }
      >
        <p className="text-sm text-muted">
          This removes the cheque from balances. The amount will show again on
          the next invoice as outstanding.
        </p>
        {cancelError && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {cancelError}
          </div>
        )}
        <label className="mt-4 block text-xs font-medium text-muted">
          Reason (optional)
        </label>
        <input
          type="text"
          value={cancelReason}
          disabled={cancelBusy}
          onChange={(e) => setCancelReason(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          placeholder="e.g. Cheque returned / bounced"
        />
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (deleteBusy) return;
          setDeleteTarget(null);
          setDeleteError("");
        }}
        title="Delete advance payment"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={deleteBusy}
              onClick={() => {
                setDeleteTarget(null);
                setDeleteError("");
              }}
              className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-sidebar disabled:opacity-40"
            >
              Keep
            </button>
            <button
              type="button"
              disabled={deleteBusy}
              onClick={() => void confirmDeleteAdvance()}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
            >
              {deleteBusy ? "Deleting…" : "Delete"}
            </button>
          </div>
        }
      >
        <p className="text-sm text-muted">
          Permanently remove this unapplied advance. Only allowed within 1 day
          of recording.
        </p>
        {deleteError && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {deleteError}
          </div>
        )}
      </Modal>

      <Modal
        open={deleteLockedOpen}
        onClose={() => setDeleteLockedOpen(false)}
        title="Delete locked"
        footer={
          <button
            type="button"
            onClick={() => setDeleteLockedOpen(false)}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-sidebar"
          >
            Close
          </button>
        }
      >
        <p className="text-sm text-muted">
          Advances can only be deleted within 1 day of recording, and only if
          they have not been applied to an invoice yet.
        </p>
      </Modal>
    </div>
  );
}

function InvoicePaymentRow({
  invoice,
  payment,
  receivedAt,
  accountById,
  onCancelCheque,
}: {
  invoice: Invoice;
  payment: InvoicePaymentEntry;
  receivedAt: string;
  accountById: Map<string, BankAccount>;
  onCancelCheque: () => void;
}) {
  const date = formatInvoiceDate(receivedAt);
  const statusLabel = verificationStatusLabel(invoice.verificationStatus);
  const cancelled = payment.status === "cancelled";
  const account = payment.depositAccountId
    ? accountById.get(payment.depositAccountId)
    : undefined;
  const detailParts = [
    payment.method === "cheque" && payment.chequeNumber
      ? `Cheque ${payment.chequeNumber}`
      : null,
    (payment.method === "upi" || payment.method === "imps") &&
    payment.senderName
      ? `Sender ${payment.senderName}`
      : null,
    account ? formatBankAccountLabel(account) : null,
    !account && payment.depositAccountOther
      ? payment.depositAccountOther
      : null,
    payment.method === "cash" ? "Received in cash" : null,
    cancelled && payment.cancelReason ? payment.cancelReason : null,
  ].filter((part): part is string => Boolean(part));

  return (
    <li className="flex items-start gap-3 rounded-lg px-3 py-2.5 sm:gap-4 sm:px-3.5">
      <div className="flex w-11 shrink-0 flex-col items-center sm:w-12">
        <span className="text-[11px] text-muted">{date.weekday}</span>
        <span className="text-xl font-semibold tracking-tight tabular-nums">
          {date.day}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{invoice.number}</p>
          <span className="rounded bg-sidebar px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted uppercase">
            {METHOD_LABELS[payment.method]}
          </span>
          {payment.advanceId && (
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-emerald-800 uppercase">
              Advance
            </span>
          )}
          {statusLabel && (
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase ${
                invoice.verificationStatus === "needs_edit"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-sky-100 text-sky-800"
              }`}
            >
              {statusLabel}
            </span>
          )}
          {cancelled && (
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-red-800 uppercase">
              Cancelled
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {date.time}
          {detailParts.length > 0 && (
            <>
              <span className="mx-1.5 text-border">·</span>
              {detailParts.join(" · ")}
            </>
          )}
        </p>
        {payment.method === "cheque" && !cancelled && (
          <button
            type="button"
            onClick={onCancelCheque}
            className="mt-2 text-xs font-medium text-red-700 hover:underline"
          >
            Cancel cheque
          </button>
        )}
      </div>

      <p
        className={`shrink-0 text-sm font-medium tabular-nums ${
          cancelled ? "text-muted line-through" : ""
        }`}
      >
        {formatINR(payment.amount)}
      </p>
    </li>
  );
}

function AdvanceRow({
  advance,
  accountById,
  onCancelCheque,
  onDelete,
}: {
  advance: SalesmanAdvance;
  accountById: Map<string, BankAccount>;
  onCancelCheque: () => void;
  onDelete: () => void;
}) {
  const date = formatInvoiceDate(advance.receivedAt);
  const statusLabel = verificationStatusLabel(advance.verificationStatus);
  const cancelled = advance.status === "cancelled";
  const account = advance.depositAccountId
    ? accountById.get(advance.depositAccountId)
    : undefined;
  const applied =
    Math.round((advance.amount - advance.remainingAmount) * 100) / 100;
  const detailParts = [
    METHOD_LABELS[advance.method],
    advance.method === "cheque" && advance.chequeNumber
      ? `Cheque ${advance.chequeNumber}`
      : null,
    (advance.method === "upi" || advance.method === "imps") &&
    advance.senderName
      ? `Sender ${advance.senderName}`
      : null,
    account ? formatBankAccountLabel(account) : null,
    advance.notes ? advance.notes : null,
    !cancelled && advance.remainingAmount > 0
      ? `${formatINR(advance.remainingAmount)} left`
      : null,
    cancelled && advance.cancelReason ? advance.cancelReason : null,
  ].filter((part): part is string => Boolean(part));

  return (
    <li className="flex items-start gap-3 rounded-lg px-3 py-2.5 sm:gap-4 sm:px-3.5">
      <div className="flex w-11 shrink-0 flex-col items-center sm:w-12">
        <span className="text-[11px] text-muted">{date.weekday}</span>
        <span className="text-xl font-semibold tracking-tight tabular-nums">
          {date.day}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">Advance</p>
          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-emerald-800 uppercase">
            Credit
          </span>
          {statusLabel && (
            <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-sky-800 uppercase">
              {statusLabel}
            </span>
          )}
          {cancelled && (
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-red-800 uppercase">
              Cancelled
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {date.time}
          {detailParts.length > 0 && (
            <>
              <span className="mx-1.5 text-border">·</span>
              {detailParts.join(" · ")}
            </>
          )}
        </p>
        {!cancelled && (
          <div className="mt-2 flex flex-wrap gap-3">
            {advance.method === "cheque" && (
              <button
                type="button"
                onClick={onCancelCheque}
                className="text-xs font-medium text-red-700 hover:underline"
              >
                Cancel cheque
              </button>
            )}
            <button
              type="button"
              onClick={onDelete}
              className="text-xs font-medium text-red-700 hover:underline"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      <div className="shrink-0 text-right">
        <p
          className={`text-sm font-medium tabular-nums ${
            cancelled ? "text-muted line-through" : ""
          }`}
        >
          {formatINR(advance.amount)}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          {cancelled
            ? "Cancelled"
            : applied > 0
              ? `${formatINR(applied)} applied`
              : "Unapplied"}
        </p>
      </div>
    </li>
  );
}

function resolveEntries(invoice: Invoice): InvoicePaymentEntry[] {
  if (invoice.paymentEntries && invoice.paymentEntries.length > 0) {
    return invoice.paymentEntries;
  }
  if (invoice.amountPaid > 0) {
    return [
      {
        id: `${invoice.id}-paid`,
        method: "cash",
        amount: invoice.amountPaid,
        status: "active",
      },
    ];
  }
  return [];
}
