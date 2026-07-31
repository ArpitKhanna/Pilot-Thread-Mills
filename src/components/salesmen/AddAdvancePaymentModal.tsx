"use client";

import { useState } from "react";
import { formatBankAccountLabel } from "@/lib/bank-accounts/mappers";
import type { BankAccount } from "@/lib/bank-accounts/types";
import type {
  InvoicePaymentMethod,
  SalesmanAdvance,
} from "@/lib/salesmen/types";
import { toDateInputValue } from "@/lib/salesmen/record-window";
import { Modal } from "@/components/ui/Modal";

type AddAdvancePaymentModalProps = {
  open: boolean;
  onClose: () => void;
  salesmanId: string;
  partyName: string;
  bankAccounts: BankAccount[];
  onCreated: (advance: SalesmanAdvance) => void;
};

const METHOD_LABELS: Record<InvoicePaymentMethod, string> = {
  cash: "Cash",
  cheque: "Cheque",
  upi: "UPI",
  imps: "IMPS",
};

export function AddAdvancePaymentModal({
  open,
  onClose,
  salesmanId,
  partyName,
  bankAccounts,
  onCreated,
}: AddAdvancePaymentModalProps) {
  const accounts = bankAccounts.filter((a) => a.isActive);
  const defaultAccountId = accounts[0]?.id ?? "";

  const [method, setMethod] = useState<InvoicePaymentMethod>("upi");
  const [amount, setAmount] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [depositAccountId, setDepositAccountId] = useState(defaultAccountId);
  const [senderName, setSenderName] = useState("");
  const [notes, setNotes] = useState("");
  const [receivedAt, setReceivedAt] = useState(() => toDateInputValue());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setMethod("upi");
    setAmount("");
    setChequeNumber("");
    setDepositAccountId(defaultAccountId);
    setSenderName("");
    setNotes("");
    setReceivedAt(toDateInputValue());
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
      const res = await fetch(`/api/salesmen/${salesmanId}/advances`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          amount: value,
          chequeNumber: method === "cheque" ? chequeNumber : undefined,
          depositAccountId:
            method === "cash" ? undefined : depositAccountId || undefined,
          senderName:
            method === "upi" || method === "imps"
              ? senderName || undefined
              : undefined,
          notes: notes.trim() || undefined,
          receivedAt: method === "cash" ? undefined : receivedAt,
        }),
      });
      const data = (await res.json()) as {
        advance?: SalesmanAdvance;
        error?: string;
      };
      if (!res.ok || !data.advance) {
        throw new Error(data.error || "Could not record payment.");
      }
      onCreated(data.advance);
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record payment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Record advance payment"
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
            {busy ? "Saving…" : "Save payment"}
          </button>
        </div>
      }
    >
      <p className="mb-4 text-sm text-muted">
        Record money received from{" "}
        <span className="text-foreground">{partyName}</span> before an invoice.
        It will reduce their balance and auto-apply on the next invoice.
      </p>

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="space-y-3">
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

        {method === "cheque" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Cheque number <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={chequeNumber}
              disabled={busy}
              onChange={(e) => setChequeNumber(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            />
          </div>
        )}

        {method !== "cash" && (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">
                Payment date <span className="text-red-600">*</span>
              </label>
              <input
                type="date"
                value={receivedAt}
                max={toDateInputValue()}
                disabled={busy}
                onChange={(e) => setReceivedAt(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">
                Deposit account <span className="text-red-600">*</span>
              </label>
              <select
                value={depositAccountId}
                disabled={busy}
                onChange={(e) => setDepositAccountId(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              >
                {accounts.length === 0 ? (
                  <option value="">No accounts</option>
                ) : (
                  accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {formatBankAccountLabel(a)}
                    </option>
                  ))
                )}
              </select>
            </div>
          </>
        )}

        {(method === "upi" || method === "imps") && (
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Sender name
            </label>
            <input
              type="text"
              value={senderName}
              disabled={busy}
              onChange={(e) => setSenderName(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              placeholder="Optional"
            />
          </div>
        )}

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
