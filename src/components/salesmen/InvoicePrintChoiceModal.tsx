"use client";

import { useEffect, useState } from "react";
import { InvoicePreview } from "@/components/salesmen/InvoicePreview";
import { Modal } from "@/components/ui/Modal";
import { formatINR } from "@/lib/salesmen/mock-data";
import type { Invoice, Salesman } from "@/lib/salesmen/types";

type InvoicePrintChoiceModalProps = {
  open: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  party: Salesman | null;
  previousBalance?: number;
  title?: string;
  description?: string;
};

function PrintToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onCheckedChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-foreground" : "bg-border"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-surface shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

export function InvoicePrintChoiceModal({
  open,
  onClose,
  invoice,
  party,
  previousBalance,
  title = "Print invoice",
  description = "Choose how the copy should look, then print. The preview updates live.",
}: InvoicePrintChoiceModalProps) {
  const [hidePrices, setHidePrices] = useState(false);
  const [printRequest, setPrintRequest] = useState<number | null>(null);

  useEffect(() => {
    if (!open) {
      setHidePrices(false);
      setPrintRequest(null);
    }
  }, [open]);

  useEffect(() => {
    if (printRequest == null || !invoice || !party) return;
    const id = window.setTimeout(() => {
      window.print();
      setPrintRequest(null);
    }, 80);
    return () => window.clearTimeout(id);
  }, [printRequest, invoice, party, hidePrices]);

  const canShow = open && Boolean(invoice) && Boolean(party);

  return (
    <>
      <Modal
        open={canShow}
        onClose={onClose}
        title={title}
        size="2xl"
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
      >
        <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-2">
          <div className="min-h-0 overflow-y-auto border-b border-border px-4 py-4 sm:px-5 lg:border-b-0 lg:border-r lg:py-5">
            <div className="mx-auto max-w-xl space-y-5">
              <section className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted">Invoice</p>
                  {invoice ? (
                    <p className="mt-1 text-sm font-medium">
                      {invoice.number}
                      {" · "}
                      {formatINR(invoice.totalAmount)}
                    </p>
                  ) : null}
                  <p className="mt-1.5 text-sm text-muted">{description}</p>
                </div>

                <div className="space-y-2">
                  <PrintToggleRow
                    label="Show prices"
                    description="Rates, amounts, and totals visible"
                    checked={!hidePrices}
                    onCheckedChange={(on) => setHidePrices(!on)}
                  />
                  <PrintToggleRow
                    label="Mask prices"
                    description="Hide rates, amounts, and totals for delivery"
                    checked={hidePrices}
                    onCheckedChange={setHidePrices}
                  />
                </div>
              </section>

              <div className="flex justify-end gap-2 pb-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-border px-3 py-2.5 text-sm font-medium"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={!invoice || !party}
                  onClick={() => setPrintRequest(Date.now())}
                  className="rounded-lg bg-foreground px-3 py-2.5 text-sm font-medium text-surface disabled:opacity-50"
                >
                  Print
                </button>
              </div>
            </div>
          </div>

          <div className="hidden min-h-0 overflow-y-auto bg-sidebar/30 p-4 lg:block">
            {invoice && party ? (
              <InvoicePreview
                invoice={invoice}
                salesman={party}
                hideToolbar
                hidePrices={hidePrices}
                previousBalance={hidePrices ? undefined : previousBalance}
              />
            ) : null}
          </div>
        </div>
      </Modal>

      {canShow && invoice && party ? (
        <div className="hidden print:block">
          <InvoicePreview
            invoice={invoice}
            salesman={party}
            forPrint
            hidePrices={hidePrices}
            previousBalance={hidePrices ? undefined : previousBalance}
          />
        </div>
      ) : null}
    </>
  );
}
