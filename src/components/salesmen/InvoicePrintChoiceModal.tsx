"use client";

import { useEffect, useState } from "react";
import { InvoicePreview } from "@/components/salesmen/InvoicePreview";
import { Modal } from "@/components/ui/Modal";
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

export function InvoicePrintChoiceModal({
  open,
  onClose,
  invoice,
  party,
  previousBalance,
  title = "Print invoice",
  description = "Choose how to print this invoice.",
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

  function printWithPrices() {
    setHidePrices(false);
    setPrintRequest(Date.now());
  }

  function printWithoutPrices() {
    setHidePrices(true);
    setPrintRequest(Date.now());
  }

  const canShow = open && Boolean(invoice) && Boolean(party);

  return (
    <>
      <Modal open={canShow} onClose={onClose} title={title}>
        <div className="space-y-4">
          <p className="text-sm text-muted">{description}</p>
          {invoice ? (
            <p className="text-sm font-medium">{invoice.number}</p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="order-last rounded-lg border border-border px-3 py-2.5 text-sm font-medium sm:order-first"
            >
              Close
            </button>
            <button
              type="button"
              onClick={printWithoutPrices}
              className="rounded-lg border border-border px-3 py-2.5 text-sm font-medium hover:bg-sidebar"
            >
              Print without prices
            </button>
            <button
              type="button"
              onClick={printWithPrices}
              className="rounded-lg bg-foreground px-3 py-2.5 text-sm font-medium text-surface"
            >
              Print with prices
            </button>
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
