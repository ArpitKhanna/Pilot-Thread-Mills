"use client";

import { useEffect } from "react";
import {
  formatINR,
  formatShortDate,
} from "@/lib/salesmen/mock-data";
import type { Invoice, Salesman } from "@/lib/salesmen/types";

type InvoicePreviewProps = {
  invoice: Invoice;
  salesman: Salesman;
  onClose?: () => void;
  onEdit?: () => void;
  onPrint?: () => void;
  onWhatsApp?: () => void;
  /** When true, render as mobile overlay sheet */
  asOverlay?: boolean;
  /** Dedicated print copy — marks the document root for print CSS */
  forPrint?: boolean;
  /** Live draft pane — document only, no action toolbar */
  hideToolbar?: boolean;
  /** Show previous balance in the summary (create flow) */
  previousBalance?: number;
};

export function InvoicePreview({
  invoice,
  salesman,
  onClose,
  onEdit,
  onPrint,
  onWhatsApp,
  asOverlay = false,
  forPrint = false,
  hideToolbar = false,
  previousBalance,
}: InvoicePreviewProps) {
  useEffect(() => {
    if (!asOverlay) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [asOverlay, onClose]);

  const invoiceBalance = invoice.totalAmount - invoice.amountPaid;
  const closingBalance =
    previousBalance !== undefined
      ? previousBalance + invoice.totalAmount - invoice.amountPaid
      : invoiceBalance;

  const showToolbar = !hideToolbar && !forPrint;

  const documentBody = (
    <div
      id={forPrint ? "invoice-print-root" : undefined}
      className="mx-auto max-w-lg rounded-sm border border-border bg-surface p-6 shadow-sm sm:p-8 print:max-w-none print:border-0 print:shadow-none"
    >
      <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="font-logo-serif text-lg tracking-wide">
            Pilot Thread Mills
          </p>
          <p className="mt-1 text-xs text-muted">Tax Invoice</p>
        </div>
        <div className="text-right text-xs text-muted">
          <p className="font-medium text-foreground">{invoice.number}</p>
          <p className="mt-1">Issued {formatShortDate(invoice.issuedAt)}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="font-mono text-[10px] tracking-wider text-muted uppercase">
            Billed by
          </p>
          <p className="mt-1 text-sm font-medium">Pilot Thread Mills</p>
          <p className="mt-0.5 text-xs text-muted leading-relaxed">
            Textile wholesale &amp; dyeing
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] tracking-wider text-muted uppercase">
            Billed to
          </p>
          <p className="mt-1 text-sm font-medium">{salesman.name}</p>
          <p className="mt-0.5 text-xs text-muted">{salesman.category}</p>
          <p className="mt-0.5 text-xs text-muted">+{salesman.phone}</p>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-table-header text-left text-xs text-muted">
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 font-medium text-right">Qty</th>
              <th className="hidden px-3 py-2 font-medium text-right sm:table-cell">
                Rate
              </th>
              <th className="px-3 py-2 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-6 text-center text-sm text-muted"
                >
                  No items yet
                </td>
              </tr>
            ) : (
              invoice.lineItems.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-3 py-2.5">{item.name}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {item.qty}
                  </td>
                  <td className="hidden px-3 py-2.5 text-right tabular-nums sm:table-cell">
                    {formatINR(item.unitPrice)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                    {formatINR(item.amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:justify-between">
        <div className="text-xs text-muted">
          {invoice.notes ? (
            <>
              <p className="font-mono text-[10px] tracking-wider uppercase">
                Notes
              </p>
              <p className="mt-1 max-w-xs leading-relaxed text-foreground">
                {invoice.notes}
              </p>
            </>
          ) : null}
        </div>
        <div className="min-w-[10rem] space-y-1.5 text-sm">
          <Row label="Subtotal" value={formatINR(invoice.totalAmount)} />
          {previousBalance !== undefined && (
            <Row label="Prev. balance" value={formatINR(previousBalance)} />
          )}
          <Row label="Paid" value={formatINR(invoice.amountPaid)} />
          <div className="flex items-center justify-between border-t border-border pt-2 font-medium">
            <span>
              {previousBalance !== undefined ? "Closing" : "Balance"}
            </span>
            <span className={closingBalance > 0 ? "text-[#c45c26]" : undefined}>
              {formatINR(closingBalance)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const content = (
    <div className="flex h-full min-h-0 flex-col">
      {showToolbar && (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 print:hidden">
          <div className="flex items-center gap-2">
            {asOverlay && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-border px-2.5 py-1.5 text-sm hover:bg-sidebar"
              >
                Close
              </button>
            )}
            {!asOverlay && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-muted hover:bg-sidebar hover:text-foreground"
                aria-label="Close preview"
              >
                <CloseIcon />
              </button>
            )}
            <p className="text-sm font-medium">{invoice.number}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onEdit && <ActionButton label="Edit" onClick={onEdit} />}
            {onPrint && <ActionButton label="Print" onClick={onPrint} />}
            {onWhatsApp && (
              <ActionButton label="WhatsApp" onClick={onWhatsApp} primary />
            )}
          </div>
        </div>
      )}

      <div
        className={`flex-1 overflow-y-auto p-4 sm:p-6 print:bg-white print:p-0 ${
          hideToolbar ? "bg-transparent" : "bg-[#f0efeb]"
        }`}
      >
        {documentBody}
      </div>
    </div>
  );

  if (forPrint) {
    return documentBody;
  }

  if (asOverlay) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-background lg:hidden">
        {content}
      </div>
    );
  }

  return (
    <div
      className={`flex h-full min-h-[28rem] flex-col overflow-hidden rounded-xl border border-border bg-surface ${
        hideToolbar ? "border-0 bg-transparent shadow-none" : ""
      }`}
    >
      {content}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-6 text-muted">
      <span>{label}</span>
      <span className="tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  primary = false,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        primary
          ? "bg-foreground text-surface hover:bg-foreground/90"
          : "border border-border bg-surface hover:bg-sidebar"
      }`}
    >
      {label}
    </button>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M4 4l8 8M12 4L4 12"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
