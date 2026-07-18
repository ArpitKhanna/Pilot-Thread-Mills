"use client";

import { useEffect, useMemo, useState } from "react";
import {
  canEditInvoice,
  formatEditCountdown,
  formatINR,
  formatShortDate,
  getInvoiceEditRemainingMs,
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

function renderPageContent(
  page: InvoicePage,
  index: number,
  pages: InvoicePage[],
  invoice: Invoice,
  salesman: Salesman,
  previousBalance: number | undefined,
  closingBalance: number,
) {
  return (
    <>
      {page.showHeader ? (
        <PageHeader invoice={invoice} salesman={salesman} />
      ) : (
        <ContinuationHeader
          invoice={invoice}
          pageNumber={index + 1}
          totalPages={pages.length}
        />
      )}

      <LineItemsTable
        items={page.items}
        empty={invoice.lineItems.length === 0}
      />

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
    </>
  );
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
  const [pageIndex, setPageIndex] = useState(0);
  const [now, setNow] = useState(() => Date.now());

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

  const editable = Boolean(onEdit) && canEditInvoice(invoice, now);
  const editRemainingMs = getInvoiceEditRemainingMs(invoice, now);

  useEffect(() => {
    setPageIndex(0);
    setNow(Date.now());
  }, [invoice.id]);

  useEffect(() => {
    if (pageIndex > pages.length - 1) {
      setPageIndex(Math.max(0, pages.length - 1));
    }
  }, [pageIndex, pages.length]);

  useEffect(() => {
    if (!onEdit) return;
    if (!canEditInvoice(invoice, Date.now())) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [invoice.id, invoice.issuedAt, onEdit]);

  const showToolbar = !hideToolbar && !forPrint;
  const currentPage = pages[pageIndex] ?? pages[0];
  const hasMultiplePages = pages.length > 1;

  if (forPrint) {
    return (
      <div
        id="invoice-print-root"
        className="mx-auto flex w-full max-w-[210mm] flex-col gap-4 print:max-w-none print:gap-0"
      >
        {pages.map((page, index) => (
          <A4Page
            key={`${invoice.id}-page-${index}`}
            pageNumber={index + 1}
            totalPages={pages.length}
            forPrint
          >
            {renderPageContent(
              page,
              index,
              pages,
              invoice,
              salesman,
              previousBalance,
              closingBalance,
            )}
          </A4Page>
        ))}
      </div>
    );
  }

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
            {hasMultiplePages && (
              <span className="text-xs text-muted">
                {pages.length} pages
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {editable && onEdit && (
              <ActionButton
                label={`Edit (${formatEditCountdown(editRemainingMs)})`}
                onClick={onEdit}
              />
            )}
            {onEdit && !editable && (
              <span
                className="text-xs text-muted"
                title="Invoices can only be edited within 5 minutes of generation"
              >
                Edit locked
              </span>
            )}
            {onPrint && <ActionButton label="Print" onClick={onPrint} />}
            {onWhatsApp && (
              <ActionButton label="WhatsApp" onClick={onWhatsApp} primary />
            )}
          </div>
        </div>
      )}

      <div
        className={`flex min-h-0 flex-1 flex-col p-4 sm:p-5 ${
          hideToolbar ? "bg-transparent" : "bg-[#f0efeb]"
        }`}
      >
        <div className="mx-auto flex min-h-0 w-full max-w-[210mm] flex-1 flex-col">
          {currentPage && (
            <A4Page
              pageNumber={pageIndex + 1}
              totalPages={pages.length}
              forPrint={false}
            >
              {renderPageContent(
                currentPage,
                pageIndex,
                pages,
                invoice,
                salesman,
                previousBalance,
                closingBalance,
              )}
            </A4Page>
          )}
        </div>

        {hasMultiplePages && (
          <div className="mt-3 flex shrink-0 items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
              disabled={pageIndex === 0}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:bg-sidebar disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span className="min-w-[5.5rem] text-center text-xs text-muted tabular-nums">
              Page {pageIndex + 1} of {pages.length}
            </span>
            <button
              type="button"
              onClick={() =>
                setPageIndex((i) => Math.min(pages.length - 1, i + 1))
              }
              disabled={pageIndex >= pages.length - 1}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:bg-sidebar disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );

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
  const grossSubtotal = invoice.lineItems.reduce(
    (sum, item) => sum + item.amount,
    0,
  );
  const returnsTotal =
    invoice.returnItems?.reduce((sum, item) => sum + item.amount, 0) ?? 0;
  const discountAmount = invoice.discountAmount ?? 0;

  return (
    <div className="mt-auto flex flex-col gap-4 pt-5 sm:flex-row sm:justify-between">
      <div className="text-xs text-muted">
        {(invoice.returnItems?.length ?? 0) > 0 && (
          <div className="mb-3">
            <p className="font-mono text-[10px] tracking-wider uppercase">
              Returns
            </p>
            <ul className="mt-1 space-y-0.5 text-foreground">
              {invoice.returnItems!.map((item) => (
                <li key={item.id}>
                  {item.name} × {item.qty} (−{formatINR(item.amount)})
                </li>
              ))}
            </ul>
          </div>
        )}
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
        <Row label="Subtotal" value={formatINR(grossSubtotal)} />
        {returnsTotal > 0 && (
          <Row label="Returns" value={`−${formatINR(returnsTotal)}`} />
        )}
        {discountAmount > 0 && (
          <Row label="Discount" value={`−${formatINR(discountAmount)}`} />
        )}
        {(returnsTotal > 0 || discountAmount > 0) && (
          <Row label="Invoice total" value={formatINR(invoice.totalAmount)} />
        )}
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
