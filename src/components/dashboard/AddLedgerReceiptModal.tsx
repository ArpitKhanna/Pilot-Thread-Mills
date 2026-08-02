"use client";

import { useCallback, useEffect, useState } from "react";
import { formatBankAccountLabel } from "@/lib/bank-accounts/mappers";
import type { BankAccount } from "@/lib/bank-accounts/types";
import type { LedgerReceiptSource } from "@/lib/ledger/types";
import { toDateInputValue } from "@/lib/salesmen/record-window";
import type { InvoicePaymentMethod } from "@/lib/salesmen/types";
import { Modal } from "@/components/ui/Modal";

type Party = {
  id: string;
  name: string;
  entityType: "customer" | "salesman";
};

type OpenInvoice = {
  id: string;
  number: string;
  balanceDue: number;
};

type AddLedgerReceiptModalProps = {
  open: boolean;
  onClose: () => void;
  bankAccounts: BankAccount[];
  onCreated: () => void;
};

const METHOD_LABELS: Record<InvoicePaymentMethod, string> = {
  cash: "Cash",
  cheque: "Cheque",
  upi: "UPI",
  imps: "IMPS",
};

const SOURCE_OPTIONS: { id: LedgerReceiptSource; label: string }[] = [
  { id: "party_payment", label: "Customer / Salesman" },
  { id: "chitfund", label: "Chit fund" },
  { id: "mutual_fund", label: "Mutual fund" },
  { id: "other", label: "Other" },
];

export function AddLedgerReceiptModal({
  open,
  onClose,
  bankAccounts,
  onCreated,
}: AddLedgerReceiptModalProps) {
  const accounts = bankAccounts.filter((a) => a.isActive);
  const defaultAccountId = accounts[0]?.id ?? "";

  const [sourceCategory, setSourceCategory] =
    useState<LedgerReceiptSource>("party_payment");
  const [mode, setMode] = useState<"advance" | "invoice">("advance");
  const [parties, setParties] = useState<Party[]>([]);
  const [partyId, setPartyId] = useState("");
  const [invoices, setInvoices] = useState<OpenInvoice[]>([]);
  const [invoiceId, setInvoiceId] = useState("");
  const [method, setMethod] = useState<InvoicePaymentMethod>("upi");
  const [amount, setAmount] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [depositAccountId, setDepositAccountId] = useState(defaultAccountId);
  const [senderName, setSenderName] = useState("");
  const [notes, setNotes] = useState("");
  const [receivedAt, setReceivedAt] = useState(() => toDateInputValue());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isPartySource = sourceCategory === "party_payment";

  useEffect(() => {
    if (!open) return;
    void fetch("/api/parties")
      .then((r) => r.json())
      .then((data: { parties?: Party[] }) => {
        setParties(data.parties ?? []);
      })
      .catch(() => setParties([]));
  }, [open]);

  useEffect(() => {
    if (!open || !partyId || mode !== "invoice") {
      setInvoices([]);
      setInvoiceId("");
      return;
    }
    void fetch(`/api/dashboard/receipts?partyId=${encodeURIComponent(partyId)}`)
      .then((r) => r.json())
      .then((data: { invoices?: OpenInvoice[] }) => {
        const list = data.invoices ?? [];
        setInvoices(list);
        setInvoiceId(list[0]?.id ?? "");
      })
      .catch(() => {
        setInvoices([]);
        setInvoiceId("");
      });
  }, [open, partyId, mode]);

  function reset() {
    setSourceCategory("party_payment");
    setMode("advance");
    setPartyId("");
    setInvoiceId("");
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

  const submit = useCallback(async () => {
    if (busy) return;
    setError("");
    const value = Number(amount);
    if (!Number.isFinite(value) || !(value > 0)) {
      setError("Enter a valid amount.");
      return;
    }
    if (isPartySource && !partyId) {
      setError("Select a party.");
      return;
    }
    if (isPartySource && mode === "invoice" && !invoiceId) {
      setError("Select an invoice.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/dashboard/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: isPartySource ? mode : "advance",
          sourceCategory,
          partyId: isPartySource ? partyId : undefined,
          invoiceId: isPartySource && mode === "invoice" ? invoiceId : undefined,
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
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Could not record receipt.");
      }
      onCreated();
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record receipt.");
    } finally {
      setBusy(false);
    }
  }, [
    amount,
    busy,
    chequeNumber,
    depositAccountId,
    invoiceId,
    isPartySource,
    method,
    mode,
    notes,
    onClose,
    onCreated,
    partyId,
    receivedAt,
    senderName,
    sourceCategory,
  ]);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add receipt"
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
            {busy ? "Saving…" : "Save receipt"}
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
            Source
          </label>
          <div className="flex flex-wrap gap-2">
            {SOURCE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={busy}
                onClick={() => setSourceCategory(opt.id)}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  sourceCategory === opt.id
                    ? "border-foreground bg-foreground/10 text-foreground"
                    : "border-border bg-surface hover:bg-sidebar"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {isPartySource && (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">
                Party <span className="text-red-600">*</span>
              </label>
              <select
                value={partyId}
                disabled={busy}
                onChange={(e) => setPartyId(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              >
                <option value="">Select customer or salesman</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.entityType})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">
                Apply as
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setMode("advance")}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${
                    mode === "advance"
                      ? "border-foreground bg-foreground/10 text-foreground"
                      : "border-border bg-surface hover:bg-sidebar"
                  }`}
                >
                  Open balance (advance)
                </button>
                <button
                  type="button"
                  disabled={busy || !partyId}
                  onClick={() => setMode("invoice")}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${
                    mode === "invoice"
                      ? "border-foreground bg-foreground/10 text-foreground"
                      : "border-border bg-surface hover:bg-sidebar"
                  }`}
                >
                  Specific invoice
                </button>
              </div>
            </div>

            {mode === "invoice" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  Invoice <span className="text-red-600">*</span>
                </label>
                <select
                  value={invoiceId}
                  disabled={busy || invoices.length === 0}
                  onChange={(e) => setInvoiceId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                >
                  {invoices.length === 0 ? (
                    <option value="">No open invoices</option>
                  ) : (
                    invoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.number} — due ₹{inv.balanceDue.toFixed(2)}
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}
          </>
        )}

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
