"use client";

import {
  formatBankAccountLabel,
  getActiveBankAccounts,
} from "@/lib/bank-accounts/mock-data";
import { formatINR } from "@/lib/salesmen/mock-data";
import type { InvoicePaymentEntry, InvoicePaymentMethod } from "@/lib/salesmen/types";

type InvoicePaymentsStepProps = {
  payments: InvoicePaymentEntry[];
  onChange: (payments: InvoicePaymentEntry[]) => void;
  invoiceTotal: number;
  disabled?: boolean;
};

const METHOD_LABELS: Record<InvoicePaymentMethod, string> = {
  cash: "Cash",
  cheque: "Cheque",
  upi: "UPI",
  imps: "IMPS",
};

function emptyPayment(method: InvoicePaymentMethod): InvoicePaymentEntry {
  return {
    id: `pay-${crypto.randomUUID()}`,
    method,
    amount: 0,
    chequeNumber: method === "cheque" ? "" : undefined,
    depositAccountId:
      method === "cash" ? undefined : getActiveBankAccounts()[0]?.id,
    senderName: method === "upi" || method === "imps" ? "" : undefined,
  };
}

export function InvoicePaymentsStep({
  payments,
  onChange,
  invoiceTotal,
  disabled = false,
}: InvoicePaymentsStepProps) {
  const accounts = getActiveBankAccounts();
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const balanceDue = Math.max(0, invoiceTotal - totalPaid);

  function addPayment(method: InvoicePaymentMethod) {
    onChange([...payments, emptyPayment(method)]);
  }

  function updatePayment(id: string, patch: Partial<InvoicePaymentEntry>) {
    onChange(
      payments.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
  }

  function removePayment(id: string) {
    onChange(payments.filter((p) => p.id !== id));
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile label="Invoice total" value={formatINR(invoiceTotal)} />
        <SummaryTile label="Total paid" value={formatINR(totalPaid)} />
        <SummaryTile
          label="Balance due"
          value={formatINR(balanceDue)}
          emphasize={balanceDue > 0}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {(["cash", "cheque", "upi", "imps"] as const).map((method) => (
          <button
            key={method}
            type="button"
            disabled={disabled}
            onClick={() => addPayment(method)}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm hover:bg-sidebar disabled:opacity-40"
          >
            + {METHOD_LABELS[method]}
          </button>
        ))}
      </div>

      {payments.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
          No payments yet. Add cash, cheque, UPI, or IMPS — you can combine
          several on one invoice.
        </p>
      ) : (
        <ul className="space-y-3">
          {payments.map((payment, index) => (
            <li
              key={payment.id}
              className="space-y-3 rounded-xl border border-border bg-surface p-3 sm:p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  {METHOD_LABELS[payment.method]}{" "}
                  <span className="font-normal text-muted">#{index + 1}</span>
                </p>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => removePayment(payment.id)}
                  className="text-xs text-muted hover:text-foreground disabled:opacity-40"
                >
                  Remove
                </button>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-muted">
                  Amount
                </span>
                <div className="flex overflow-hidden rounded-lg border border-border focus-within:border-foreground/40 focus-within:ring-1 focus-within:ring-foreground/20">
                  <span className="flex items-center border-r border-border bg-sidebar px-3 text-sm text-muted">
                    ₹
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    disabled={disabled}
                    value={payment.amount || ""}
                    placeholder="0"
                    className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm tabular-nums outline-none disabled:opacity-50"
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      updatePayment(payment.id, {
                        amount: Number.isFinite(n) && n > 0 ? n : 0,
                      });
                    }}
                  />
                </div>
              </label>

              {payment.method === "cheque" && (
                <>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-muted">
                      Cheque number
                    </span>
                    <input
                      type="text"
                      disabled={disabled}
                      value={payment.chequeNumber ?? ""}
                      placeholder="Cheque no."
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-foreground/40 disabled:opacity-50"
                      onChange={(e) =>
                        updatePayment(payment.id, {
                          chequeNumber: e.target.value,
                        })
                      }
                    />
                  </label>
                  <AccountSelect
                    value={payment.depositAccountId ?? ""}
                    disabled={disabled}
                    accounts={accounts}
                    label="Deposit into account"
                    onChange={(depositAccountId) =>
                      updatePayment(payment.id, { depositAccountId })
                    }
                  />
                </>
              )}

              {(payment.method === "upi" || payment.method === "imps") && (
                <>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-muted">
                      Sender name
                    </span>
                    <input
                      type="text"
                      disabled={disabled}
                      value={payment.senderName ?? ""}
                      placeholder="Name as on transfer"
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-foreground/40 disabled:opacity-50"
                      onChange={(e) =>
                        updatePayment(payment.id, {
                          senderName: e.target.value,
                        })
                      }
                    />
                  </label>
                  <AccountSelect
                    value={payment.depositAccountId ?? ""}
                    disabled={disabled}
                    accounts={accounts}
                    label="Deposited to account"
                    onChange={(depositAccountId) =>
                      updatePayment(payment.id, { depositAccountId })
                    }
                  />
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted">
        On the printed invoice, payments appear as one combined “Paid” amount.
      </p>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-sidebar px-3 py-2.5">
      <p className="text-xs text-muted">{label}</p>
      <p
        className={`mt-1 text-sm font-medium tabular-nums ${
          emphasize ? "text-[#c45c26]" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function AccountSelect({
  value,
  onChange,
  accounts,
  label,
  disabled,
}: {
  value: string;
  onChange: (id: string) => void;
  accounts: ReturnType<typeof getActiveBankAccounts>;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">
        {label}
      </span>
      <select
        value={value}
        disabled={disabled || accounts.length === 0}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-foreground/40 disabled:opacity-50"
      >
        {accounts.length === 0 ? (
          <option value="">No bank accounts</option>
        ) : (
          accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {formatBankAccountLabel(account)}
            </option>
          ))
        )}
      </select>
    </label>
  );
}
