"use client";

import { formatBankAccountLabel } from "@/lib/bank-accounts/mappers";
import type { BankAccount } from "@/lib/bank-accounts/types";
import { formatINR } from "@/lib/salesmen/mock-data";
import { toDateInputValue } from "@/lib/salesmen/record-window";
import type { InvoicePaymentEntry, InvoicePaymentMethod } from "@/lib/salesmen/types";

type InvoicePaymentsStepProps = {
  payments: InvoicePaymentEntry[];
  onChange: (payments: InvoicePaymentEntry[]) => void;
  invoiceTotal: number;
  previousBalance?: number;
  bankAccounts: BankAccount[];
  disabled?: boolean;
  fieldErrors?: Record<
    string,
    {
      amount?: string;
      chequeNumber?: string;
      depositAccountId?: string;
      depositAccountOther?: string;
      receivedAt?: string;
    }
  >;
};

const OTHER_ACCOUNT_VALUE = "__other__";

const METHOD_LABELS: Record<InvoicePaymentMethod, string> = {
  cash: "Cash",
  cheque: "Cheque",
  upi: "UPI",
  imps: "IMPS",
};

function emptyPayment(
  method: InvoicePaymentMethod,
  defaultAccountId?: string,
): InvoicePaymentEntry {
  return {
    id: `pay-${crypto.randomUUID()}`,
    method,
    amount: 0,
    chequeNumber: method === "cheque" ? "" : undefined,
    depositAccountId: method === "cash" ? undefined : defaultAccountId,
    senderName: method === "upi" || method === "imps" ? "" : undefined,
    receivedAt:
      method === "cash" ? undefined : toDateInputValue(),
  };
}

export function InvoicePaymentsStep({
  payments,
  onChange,
  invoiceTotal,
  previousBalance = 0,
  bankAccounts,
  disabled = false,
  fieldErrors = {},
}: InvoicePaymentsStepProps) {
  const accounts = bankAccounts.filter((a) => a.isActive);
  const defaultAccountId = accounts[0]?.id;
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const closingBalance =
    Math.round((previousBalance + invoiceTotal - totalPaid) * 100) / 100;

  function addPayment(method: InvoicePaymentMethod) {
    onChange([...payments, emptyPayment(method, defaultAccountId)]);
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
      <div className="grid grid-cols-2 gap-3">
        <SummaryTile label="Invoice total" value={formatINR(invoiceTotal)} />
        <SummaryTile
          label="Prev. balance"
          value={formatINR(previousBalance)}
        />
        <SummaryTile label="Total paid" value={formatINR(totalPaid)} />
        <SummaryTile
          label="Closing"
          value={formatINR(closingBalance)}
          emphasize={closingBalance > 0}
          credit={closingBalance < 0}
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
                  {payment.advanceId
                    ? "Applied advance"
                    : METHOD_LABELS[payment.method]}{" "}
                  <span className="font-normal text-muted">#{index + 1}</span>
                  {payment.advanceId && (
                    <span className="ml-1.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-emerald-800 uppercase">
                      {METHOD_LABELS[payment.method]}
                    </span>
                  )}
                </p>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => removePayment(payment.id)}
                  className="text-xs text-red-600 hover:text-red-700 disabled:opacity-40"
                >
                  Remove
                </button>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-muted">
                  Amount
                </span>
                <div
                  className={`flex overflow-hidden rounded-lg border focus-within:ring-1 ${
                    fieldErrors[payment.id]?.amount
                      ? "border-red-500 focus-within:border-red-500 focus-within:ring-red-500/20"
                      : "border-border focus-within:border-foreground/40 focus-within:ring-foreground/20"
                  }`}
                >
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
                {fieldErrors[payment.id]?.amount && (
                  <p className="mt-1 text-xs text-red-600" role="alert">
                    {fieldErrors[payment.id]?.amount}
                  </p>
                )}
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
                      className={`w-full rounded-lg border bg-surface px-3 py-2.5 text-sm outline-none disabled:opacity-50 ${
                        fieldErrors[payment.id]?.chequeNumber
                          ? "border-red-500 focus:border-red-500"
                          : "border-border focus:border-foreground/40"
                      }`}
                      onChange={(e) =>
                        updatePayment(payment.id, {
                          chequeNumber: e.target.value,
                        })
                      }
                    />
                    {fieldErrors[payment.id]?.chequeNumber && (
                      <p className="mt-1 text-xs text-red-600" role="alert">
                        {fieldErrors[payment.id]?.chequeNumber}
                      </p>
                    )}
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-muted">
                      Payment date
                    </span>
                    <input
                      type="date"
                      disabled={disabled || Boolean(payment.advanceId)}
                      max={toDateInputValue()}
                      value={
                        payment.receivedAt
                          ? toDateInputValue(payment.receivedAt)
                          : toDateInputValue()
                      }
                      className={`w-full rounded-lg border bg-surface px-3 py-2.5 text-sm outline-none disabled:opacity-50 ${
                        fieldErrors[payment.id]?.receivedAt
                          ? "border-red-500 focus:border-red-500"
                          : "border-border focus:border-foreground/40"
                      }`}
                      onChange={(e) =>
                        updatePayment(payment.id, {
                          receivedAt: e.target.value,
                        })
                      }
                    />
                    {fieldErrors[payment.id]?.receivedAt && (
                      <p className="mt-1 text-xs text-red-600" role="alert">
                        {fieldErrors[payment.id]?.receivedAt}
                      </p>
                    )}
                  </label>
                  <AccountSelect
                    accountId={payment.depositAccountId}
                    otherText={payment.depositAccountOther}
                    disabled={disabled}
                    accounts={accounts}
                    label="Deposit into account"
                    error={fieldErrors[payment.id]?.depositAccountId}
                    otherError={fieldErrors[payment.id]?.depositAccountOther}
                    onChange={(patch) => updatePayment(payment.id, patch)}
                  />
                </>
              )}

              {(payment.method === "upi" || payment.method === "imps") && (
                <>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-muted">
                      Sender name{" "}
                      <span className="font-normal">(optional)</span>
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
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-muted">
                      Payment date
                    </span>
                    <input
                      type="date"
                      disabled={disabled || Boolean(payment.advanceId)}
                      max={toDateInputValue()}
                      value={
                        payment.receivedAt
                          ? toDateInputValue(payment.receivedAt)
                          : toDateInputValue()
                      }
                      className={`w-full rounded-lg border bg-surface px-3 py-2.5 text-sm outline-none disabled:opacity-50 ${
                        fieldErrors[payment.id]?.receivedAt
                          ? "border-red-500 focus:border-red-500"
                          : "border-border focus:border-foreground/40"
                      }`}
                      onChange={(e) =>
                        updatePayment(payment.id, {
                          receivedAt: e.target.value,
                        })
                      }
                    />
                    {fieldErrors[payment.id]?.receivedAt && (
                      <p className="mt-1 text-xs text-red-600" role="alert">
                        {fieldErrors[payment.id]?.receivedAt}
                      </p>
                    )}
                  </label>
                  <AccountSelect
                    accountId={payment.depositAccountId}
                    otherText={payment.depositAccountOther}
                    disabled={disabled}
                    accounts={accounts}
                    label="Deposited to account"
                    error={fieldErrors[payment.id]?.depositAccountId}
                    otherError={fieldErrors[payment.id]?.depositAccountOther}
                    onChange={(patch) => updatePayment(payment.id, patch)}
                  />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SummaryTile({
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
    <div className="rounded-lg border border-border bg-sidebar px-3 py-2.5">
      <p className="text-xs text-muted">{label}</p>
      <p
        className={`mt-1 text-sm font-medium tabular-nums ${
          emphasize ? "text-warning" : credit ? "text-credit" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function AccountSelect({
  accountId,
  otherText,
  onChange,
  accounts,
  label,
  disabled,
  error,
  otherError,
}: {
  accountId?: string;
  otherText?: string;
  onChange: (patch: {
    depositAccountId?: string;
    depositAccountOther?: string;
  }) => void;
  accounts: BankAccount[];
  label: string;
  disabled?: boolean;
  error?: string;
  otherError?: string;
}) {
  const isOther = otherText !== undefined;
  const selectValue = isOther
    ? OTHER_ACCOUNT_VALUE
    : (accountId ?? accounts[0]?.id ?? "");

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-muted">
          {label}
        </span>
        <select
          value={selectValue}
          disabled={disabled}
          onChange={(e) => {
            if (e.target.value === OTHER_ACCOUNT_VALUE) {
              onChange({
                depositAccountId: undefined,
                depositAccountOther: "",
              });
              return;
            }
            onChange({
              depositAccountId: e.target.value,
              depositAccountOther: undefined,
            });
          }}
          className={`w-full rounded-lg border bg-surface px-3 py-2.5 text-sm outline-none disabled:opacity-50 ${
            error
              ? "border-red-500 focus:border-red-500"
              : "border-border focus:border-foreground/40"
          }`}
        >
          {accounts.length === 0 ? (
            <>
              <option value="">Select account</option>
              <option value={OTHER_ACCOUNT_VALUE}>Other</option>
            </>
          ) : (
            <>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {formatBankAccountLabel(account)}
                </option>
              ))}
              <option value={OTHER_ACCOUNT_VALUE}>Other</option>
            </>
          )}
        </select>
        {error && (
          <p className="mt-1 text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
      </label>

      {isOther && (
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">
            Name
          </span>
          <input
            type="text"
            disabled={disabled}
            value={otherText}
            placeholder="Recipient name"
            className={`w-full rounded-lg border bg-surface px-3 py-2.5 text-sm outline-none disabled:opacity-50 ${
              otherError
                ? "border-red-500 focus:border-red-500"
                : "border-border focus:border-foreground/40"
            }`}
            onChange={(e) =>
              onChange({
                depositAccountId: undefined,
                depositAccountOther: e.target.value,
              })
            }
          />
          {otherError && (
            <p className="mt-1 text-xs text-red-600" role="alert">
              {otherError}
            </p>
          )}
        </label>
      )}
    </div>
  );
}
