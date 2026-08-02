"use client";

import { useState } from "react";
import type { ExpenseCategory } from "@/lib/ledger/types";
import { toDateInputValue } from "@/lib/salesmen/record-window";
import type { InvoicePaymentMethod } from "@/lib/salesmen/types";
import { Modal } from "@/components/ui/Modal";

type AddExpenseModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

const CATEGORY_OPTIONS: { id: ExpenseCategory; label: string }[] = [
  { id: "petrol", label: "Petrol / delivery" },
  { id: "dyer", label: "Dyer payment" },
  { id: "maintenance", label: "Maintenance" },
  { id: "scheduled", label: "Scheduled payment" },
  { id: "other", label: "Other" },
];

const METHOD_LABELS: Record<InvoicePaymentMethod, string> = {
  cash: "Cash",
  cheque: "Cheque",
  upi: "UPI",
  imps: "IMPS",
};

export function AddExpenseModal({
  open,
  onClose,
  onCreated,
}: AddExpenseModalProps) {
  const [category, setCategory] = useState<ExpenseCategory>("other");
  const [payee, setPayee] = useState("");
  const [method, setMethod] = useState<InvoicePaymentMethod>("cash");
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(() => toDateInputValue());
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setCategory("other");
    setPayee("");
    setMethod("cash");
    setAmount("");
    setPaidAt(toDateInputValue());
    setNotes("");
    setError("");
  }

  function handleClose() {
    if (busy) return;
    reset();
    onClose();
  }

  async function submit() {
    if (busy) return;
    setError("");
    const value = Number(amount);
    if (!Number.isFinite(value) || !(value > 0)) {
      setError("Enter a valid amount.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/dashboard/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          payee: payee.trim() || undefined,
          method,
          amount: value,
          paidAt,
          notes: notes.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Could not record expense.");
      }
      onCreated();
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record expense.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add expense"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={handleClose}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-sidebar disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-surface hover:bg-foreground/90 disabled:opacity-40"
          >
            {busy ? "Saving…" : "Save expense"}
          </button>
        </div>
      }
    >
      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">
            Category
          </label>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={busy}
                onClick={() => setCategory(opt.id)}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  category === opt.id
                    ? "border-foreground bg-foreground/10 text-foreground"
                    : "border-border bg-surface hover:bg-sidebar"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">
            Payee / vendor
          </label>
          <input
            type="text"
            value={payee}
            disabled={busy}
            onChange={(e) => setPayee(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            placeholder="Optional"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">
            Method
          </label>
          <div className="flex flex-wrap gap-2">
            {(["cash", "cheque", "upi", "imps"] as const).map((m) => (
              <button
                key={m}
                type="button"
                disabled={busy}
                onClick={() => setMethod(m)}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  method === m
                    ? "border-foreground bg-foreground/10 text-foreground"
                    : "border-border bg-surface hover:bg-sidebar"
                }`}
              >
                {METHOD_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">
            Amount <span className="text-red-600">*</span>
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            disabled={busy}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            placeholder="0.00"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">
            Date
          </label>
          <input
            type="date"
            value={paidAt}
            max={toDateInputValue()}
            disabled={busy}
            onChange={(e) => setPaidAt(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">
            Notes
          </label>
          <input
            type="text"
            value={notes}
            disabled={busy}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            placeholder="Optional"
          />
        </div>
      </div>
    </Modal>
  );
}
