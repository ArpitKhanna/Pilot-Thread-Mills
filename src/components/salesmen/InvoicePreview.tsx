"use client";

import { useEffect, useMemo } from "react";
import {
  formatINR,
  formatShortDate,
} from "@/lib/salesmen/mock-data";
import type { Invoice, InvoiceLineItem, Salesman } from "@/lib/salesmen/types";

type InvoicePreviewProps = {
  invoice: Invoice;
  salesman: Salesman;
  onClose?: () => void;
  onEdit?: () => void;
  onPrint?: () => void;
  onWhatsApp?: () => void;
  asOverlay?: boolean;
  forPrint?: boolean;
  hideToolbar?: boolean;
  previousBalance?: number;
};

/** Rows that fit on a single A4 page with header + totals */
const ROWS_SINGLE_PAGE = 10;
/** Rows on first page when content continues */
const ROWS_FIRST_CONTINUED = 14;
/** Rows on middle / last continuation pages */
const ROWS_CONTINUATION = 18;

type InvoicePage = {
  items: InvoiceLineItem[];
  showHeader: boolean;
  showTotals: boolean;
  isContinuation: boolean;
};

function paginateLineItems(items: InvoiceLineItem[]): InvoicePage[] {
  if (items.length === 0) {
    return [
      {
        items: [],
        showHeader: true,
        showTotals: true,
        isContinuation: false,
      },
    ];
  }

  if (items.length <= ROWS_SINGLE_PAGE) {
    return [
      {
        items,
        showHeader: true,
        showTotals: true,
        isContinuation: false,
      },
    ];
  }

  const pages: InvoicePage[] = [];
  let offset = 0;

  pages.push({
    items: items.slice(0, ROWS_FIRST_CONTINUED),
    showHeader: true,
    showTotals: false,
    isContinuation: false,
  });
  offset = ROWS_FIRST_CONTINUED;

  while (offset < items.length) {
    const remaining = items.length - offset;
    const isLast = remaining <= ROWS_CONTINUATION;
    const take = isLast ? remaining : ROWS_CONTINUATION;
    pages.push({
      items: items.slice(offset, offset + take),
      showHeader: false,
      showTotals: isLast,
      isContinuation: true,
    });
    offset += take;
  }

  return pages;
}

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

  const pages = useMemo(
    () => paginateLineItems(invoice.lineItems),
    [invoice.lineItems],
  );

  const showToolbar = !hideToolbar && !forPrint;

  const documentPages = (
    <div
      id={forPrint ? "invoice-print-root" : undefined}
      className="mx-auto flex w-full max-w-[210mm] flex-col gap-4 print:max-w-none print:gap-0"
    >
      {pages.map((page, index) => (
        <A4Page
          key={`${invoice.id}-page-${index}`}
          pageNumber={index + 1}
          totalPages={pages.length}
          forPrint={forPrint}
        >
          {page.showHeader ? (
            <PageHeader invoice={invoice} salesman={salesman} />
          ) : (
            <ContinuationHeader
              invoice={invoice}
              pageNumber={index + 1}
              totalPages={pages.length}
            />
          )}

          <LineItemsTable items={page.items} empty={invoice.lineItems.length === 0} />

          {page.showTotals && (
            <PageTotals
              invoice={invoice}
              previousBalance={previousBalance}
              closingBalance={closingBalance}
            />
          )}

          {!page.showTotals && (
            <p className="mt-auto pt-4 text-[10px] text-muted">
              Continued on next page…
            </p>
          )}
        </A4Page>
      ))}
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
            {pages.length > 1 && (
              <span className="text-xs text-muted">
                {pages.length} pages
              </span>
            )}
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
        className={`flex-1 overflow-y-auto p-4 sm:p-5 print:bg-white print:p-0 ${
          hideToolbar ? "bg-transparent" : "bg-[#f0efeb]"
        }`}
      >
        {documentPages}
      </div>
    </div>
  );

  if (forPrint) {
    return documentPages;
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
        hideToolbar ? "min-h-0 border-0 bg-transparent shadow-none" : ""
      }`}
    >
      {content}
    </div>
  );
}

function A4Page({
  children,
  pageNumber,
  totalPages,
  forPrint,
}: {
  children: React.ReactNode;
  pageNumber: number;
  totalPages: number;
  forPrint: boolean;
}) {
  return (
    <article
      className={`invoice-a4-page relative mx-auto flex w-full flex-col overflow-hidden border border-border bg-surface shadow-sm print:break-after-page print:shadow-none ${
        forPrint ? "print:border-0" : ""
      }`}
      style={{
        aspectRatio: "210 / 297",
        maxWidth: "210mm",
        minHeight: forPrint ? "297mm" : undefined,
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col p-[6%] sm:p-[7%]">
        {children}
      </div>
      <p className="absolute right-[6%] bottom-[3%] text-[10px] text-muted tabular-nums print:right-[14mm] print:bottom-[10mm]">
        Page {pageNumber} of {totalPages}
      </p>
    </article>
  );
}

function PageHeader({
  invoice,
  salesman,
}: {
  invoice: Invoice;
  salesman: Salesman;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
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

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
    </>
  );
}

function ContinuationHeader({
  invoice,
  pageNumber,
  totalPages,
}: {
  invoice: Invoice;
  pageNumber: number;
  totalPages: number;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between border-b border-border pb-2">
      <p className="text-sm font-medium">{invoice.number}</p>
      <p className="text-xs text-muted">
        Continued · {pageNumber}/{totalPages}
      </p>
    </div>
  );
}

function LineItemsTable({
  items,
  empty,
}: {
  items: InvoiceLineItem[];
  empty: boolean;
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-border">
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
          {empty ? (
            <tr>
              <td
                colSpan={4}
                className="px-3 py-6 text-center text-sm text-muted"
              >
                No items yet
              </td>
            </tr>
          ) : (
            items.map((item) => (
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
  );
}

function PageTotals({
  invoice,
  previousBalance,
  closingBalance,
}: {
  invoice: Invoice;
  previousBalance?: number;
  closingBalance: number;
}) {
  return (
    <div className="mt-auto flex flex-col gap-4 pt-5 sm:flex-row sm:justify-between">
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
