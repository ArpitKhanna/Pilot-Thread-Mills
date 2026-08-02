"use client";

import { useMemo, useState } from "react";
import {
  formatINR,
  formatInvoiceDate,
} from "@/lib/salesmen/mock-data";
import { canMutateWithinWindow } from "@/lib/salesmen/record-window";
import type { SalesmanReturn } from "@/lib/salesmen/types";
import { verificationStatusLabel } from "@/lib/salesmen/verification";
import { Modal } from "@/components/ui/Modal";

type ReturnsListProps = {
  returns: SalesmanReturn[];
  onReturnsChange: (returns: SalesmanReturn[]) => void;
  onAddReturn?: () => void;
  onLedgerChanged?: () => void;
};

export function ReturnsList({
  returns,
  onReturnsChange,
  onAddReturn,
  onLedgerChanged,
}: ReturnsListProps) {
  const sorted = useMemo(
    () =>
      [...returns].sort(
        (a, b) =>
          new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime(),
      ),
    [returns],
  );
  const [deleteTarget, setDeleteTarget] = useState<SalesmanReturn | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [lockedOpen, setLockedOpen] = useState(false);

  async function confirmDelete() {
    if (!deleteTarget || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      const res = await fetch(
        `/api/salesmen/returns/${deleteTarget.id}`,
        { method: "DELETE" },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Could not delete return.");
      }
      onReturnsChange(returns.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
      onLedgerChanged?.();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Could not delete return.",
      );
    } finally {
      setDeleteBusy(false);
    }
  }

  if (sorted.length === 0) {
    return (
      <div className="space-y-3">
        {onAddReturn && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onAddReturn}
              className="rounded-lg bg-foreground px-3.5 py-2 text-sm font-medium text-surface hover:bg-foreground/90"
            >
              Add return
            </button>
          </div>
        )}
        <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-12 text-center">
          <p className="text-sm text-muted">No returns recorded yet</p>
          {onAddReturn && (
            <button
              type="button"
              onClick={onAddReturn}
              className="mt-4 rounded-lg bg-foreground px-3.5 py-2 text-sm font-medium text-surface hover:bg-foreground/90"
            >
              Add return
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {onAddReturn && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onAddReturn}
            className="rounded-lg bg-foreground px-3.5 py-2 text-sm font-medium text-surface hover:bg-foreground/90"
          >
            Add return
          </button>
        </div>
      )}

      <ul className="space-y-1 rounded-xl border border-border bg-surface p-1">
        {sorted.map((ret) => (
          <ReturnRow
            key={ret.id}
            ret={ret}
            onDelete={() => setDeleteTarget(ret)}
            onDeleteLocked={() => setLockedOpen(true)}
          />
        ))}
      </ul>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (deleteBusy) return;
          setDeleteTarget(null);
          setDeleteError("");
        }}
        title="Delete return"
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
              onClick={() => void confirmDelete()}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
            >
              {deleteBusy ? "Deleting…" : "Delete"}
            </button>
          </div>
        }
      >
        <p className="text-sm text-muted">
          This permanently removes the return credit and updates the party
          balance. Only unapplied returns within 1 day can be deleted.
        </p>
        {deleteError && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {deleteError}
          </div>
        )}
      </Modal>

      <Modal
        open={lockedOpen}
        onClose={() => setLockedOpen(false)}
        title="Delete locked"
        footer={
          <button
            type="button"
            onClick={() => setLockedOpen(false)}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-sidebar"
          >
            Close
          </button>
        }
      >
        <p className="text-sm text-muted">
          Returns can only be deleted within 1 day of recording, and only if
          they have not been applied to an invoice yet.
        </p>
      </Modal>
    </div>
  );
}

function ReturnRow({
  ret,
  onDelete,
  onDeleteLocked,
}: {
  ret: SalesmanReturn;
  onDelete: () => void;
  onDeleteLocked: () => void;
}) {
  const date = formatInvoiceDate(ret.receivedAt);
  const statusLabel = verificationStatusLabel(ret.verificationStatus);
  const applied =
    Math.round((ret.totalAmount - ret.remainingAmount) * 100) / 100;
  const deletable =
    canMutateWithinWindow(ret.createdAt) &&
    Math.round(ret.remainingAmount * 100) ===
      Math.round(ret.totalAmount * 100);

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
          <p className="truncate text-sm font-medium">
            Return · {ret.lineItems.length} item
            {ret.lineItems.length === 1 ? "" : "s"}
          </p>
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-amber-800 uppercase">
            Credit
          </span>
          {statusLabel && (
            <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-sky-800 uppercase">
              {statusLabel}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {date.time}
          {ret.remainingAmount > 0 &&
            ret.remainingAmount < ret.totalAmount && (
              <>
                <span className="mx-1.5 text-border">·</span>
                {formatINR(ret.remainingAmount)} left
              </>
            )}
        </p>
        <ul className="mt-2 space-y-0.5">
          {ret.lineItems.map((line) => (
            <li
              key={line.id}
              className="flex justify-between gap-3 text-xs"
            >
              <span className="min-w-0 truncate text-muted">
                {line.name} × {line.qty}
              </span>
              <span className="shrink-0 tabular-nums text-foreground">
                {formatINR(line.amount)}
              </span>
            </li>
          ))}
        </ul>
        {ret.notes && (
          <p className="mt-2 text-xs text-muted">
            Notes <span className="text-foreground">{ret.notes}</span>
          </p>
        )}
        <div className="mt-2">
          {deletable ? (
            <button
              type="button"
              onClick={onDelete}
              className="text-xs font-medium text-red-700 hover:underline"
            >
              Delete
            </button>
          ) : (
            <button
              type="button"
              onClick={onDeleteLocked}
              className="text-xs text-muted hover:underline"
            >
              Delete locked
            </button>
          )}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-sm font-medium tabular-nums text-[#c45c26]">
          −{formatINR(ret.totalAmount)}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          {applied > 0 ? `${formatINR(applied)} applied` : "Unapplied"}
        </p>
      </div>
    </li>
  );
}
