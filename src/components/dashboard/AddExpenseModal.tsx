"use client";

import { useState } from "react";
import type { ExpenseCategory } from "@/lib/ledger/types";
import { toDateInputValue } from "@/lib/salesmen/record-window";
import type { InvoicePaymentMethod } from "@/lib/salesmen/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModalFooterActions } from "@/components/ui/modal-footer";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/textarea";

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
        <ModalFooterActions
          onCancel={handleClose}
          onSubmit={() => void submit()}
          submitLabel="Save expense"
          busy={busy}
        />
      }
    >
      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <Label className="mb-1.5 block text-xs text-muted">Category</Label>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_OPTIONS.map((opt) => (
              <Button
                key={opt.id}
                type="button"
                size="sm"
                variant={category === opt.id ? "default" : "outline"}
                disabled={busy}
                onClick={() => setCategory(opt.id)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="expense-payee" className="mb-1 block text-xs text-muted">
            Payee / vendor
          </Label>
          <Input
            id="expense-payee"
            type="text"
            value={payee}
            disabled={busy}
            onChange={(e) => setPayee(e.target.value)}
            placeholder="Optional"
          />
        </div>

        <div>
          <Label className="mb-1.5 block text-xs text-muted">Method</Label>
          <div className="flex flex-wrap gap-2">
            {(["cash", "cheque", "upi", "imps"] as const).map((m) => (
              <Button
                key={m}
                type="button"
                size="sm"
                variant={method === m ? "default" : "outline"}
                disabled={busy}
                onClick={() => setMethod(m)}
              >
                {METHOD_LABELS[m]}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="expense-amount" className="mb-1 block text-xs text-muted">
            Amount <span className="text-red-600">*</span>
          </Label>
          <Input
            id="expense-amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            disabled={busy}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>

        <div>
          <Label htmlFor="expense-date" className="mb-1 block text-xs text-muted">
            Date
          </Label>
          <Input
            id="expense-date"
            type="date"
            value={paidAt}
            max={toDateInputValue()}
            disabled={busy}
            onChange={(e) => setPaidAt(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="expense-notes" className="mb-1 block text-xs text-muted">
            Notes
          </Label>
          <Textarea
            id="expense-notes"
            value={notes}
            disabled={busy}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
            rows={2}
          />
        </div>
      </div>
    </Modal>
  );
}
