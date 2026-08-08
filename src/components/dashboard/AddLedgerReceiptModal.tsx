"use client";

import { useCallback, useEffect, useState } from "react";
import { formatBankAccountLabel } from "@/lib/bank-accounts/mappers";
import type { BankAccount } from "@/lib/bank-accounts/types";
import type { LedgerReceiptSource } from "@/lib/ledger/types";
import { toDateInputValue } from "@/lib/salesmen/record-window";
import type { InvoicePaymentMethod } from "@/lib/salesmen/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModalFooterActions } from "@/components/ui/modal-footer";
import { Modal } from "@/components/ui/Modal";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

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
        <ModalFooterActions
          onCancel={handleClose}
          onSubmit={() => void submit()}
          submitLabel="Save receipt"
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
          <Label className="mb-1.5 block text-xs text-muted">Source</Label>
          <div className="flex flex-wrap gap-2">
            {SOURCE_OPTIONS.map((opt) => (
              <Button
                key={opt.id}
                type="button"
                size="sm"
                variant={sourceCategory === opt.id ? "default" : "outline"}
                disabled={busy}
                onClick={() => setSourceCategory(opt.id)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        {isPartySource && (
          <>
            <div>
              <Label htmlFor="receipt-party" className="mb-1 block text-xs text-muted">
                Party <span className="text-red-600">*</span>
              </Label>
              <NativeSelect
                id="receipt-party"
                value={partyId}
                disabled={busy}
                onChange={(e) => setPartyId(e.target.value)}
                className="w-full sm:w-full"
              >
                <option value="">Select customer or salesman</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.entityType})
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div>
              <Label className="mb-1.5 block text-xs text-muted">Apply as</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "advance" ? "default" : "outline"}
                  disabled={busy}
                  onClick={() => setMode("advance")}
                >
                  Open balance (advance)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "invoice" ? "default" : "outline"}
                  disabled={busy || !partyId}
                  onClick={() => setMode("invoice")}
                >
                  Specific invoice
                </Button>
              </div>
            </div>

            {mode === "invoice" && (
              <div>
                <Label htmlFor="receipt-invoice" className="mb-1 block text-xs text-muted">
                  Invoice <span className="text-red-600">*</span>
                </Label>
                <NativeSelect
                  id="receipt-invoice"
                  value={invoiceId}
                  disabled={busy || invoices.length === 0}
                  onChange={(e) => setInvoiceId(e.target.value)}
                  className="w-full sm:w-full"
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
                </NativeSelect>
              </div>
            )}
          </>
        )}

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
          <Label htmlFor="receipt-amount" className="mb-1 block text-xs text-muted">
            Amount <span className="text-red-600">*</span>
          </Label>
          <Input
            id="receipt-amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            disabled={busy}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>

        {method === "cheque" && (
          <div>
            <Label htmlFor="receipt-cheque" className="mb-1 block text-xs text-muted">
              Cheque number <span className="text-red-600">*</span>
            </Label>
            <Input
              id="receipt-cheque"
              type="text"
              value={chequeNumber}
              disabled={busy}
              onChange={(e) => setChequeNumber(e.target.value)}
            />
          </div>
        )}

        {method !== "cash" && (
          <>
            <div>
              <Label htmlFor="receipt-date" className="mb-1 block text-xs text-muted">
                Payment date <span className="text-red-600">*</span>
              </Label>
              <Input
                id="receipt-date"
                type="date"
                value={receivedAt}
                max={toDateInputValue()}
                disabled={busy}
                onChange={(e) => setReceivedAt(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="receipt-account" className="mb-1 block text-xs text-muted">
                Deposit account <span className="text-red-600">*</span>
              </Label>
              <NativeSelect
                id="receipt-account"
                value={depositAccountId}
                disabled={busy}
                onChange={(e) => setDepositAccountId(e.target.value)}
                className="w-full sm:w-full"
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
              </NativeSelect>
            </div>
          </>
        )}

        {(method === "upi" || method === "imps") && (
          <div>
            <Label htmlFor="receipt-sender" className="mb-1 block text-xs text-muted">
              Sender name
            </Label>
            <Input
              id="receipt-sender"
              type="text"
              value={senderName}
              disabled={busy}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="Optional"
            />
          </div>
        )}

        <div>
          <Label htmlFor="receipt-notes" className="mb-1 block text-xs text-muted">
            Notes
          </Label>
          <Textarea
            id="receipt-notes"
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
