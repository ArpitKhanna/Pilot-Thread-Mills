"use client";

import { useState } from "react";
import type { PriceListItem } from "@/lib/auth/types";
import { formatINR } from "@/lib/salesmen/mock-data";
import { toDateInputValue } from "@/lib/salesmen/record-window";
import type { InvoiceLineItem, SalesmanReturn } from "@/lib/salesmen/types";
import { ItemNameCombobox } from "@/components/salesmen/ItemNameCombobox";
import { ModalFooterActions } from "@/components/ui/modal-footer";
import { Modal } from "@/components/ui/Modal";

type DraftItem = {
  key: string;
  priceListItemId: string | null;
  name: string;
  qty: string;
  unitPrice: number;
};

type AddReturnModalProps = {
  open: boolean;
  onClose: () => void;
  salesmanId: string;
  partyName: string;
  priceList: PriceListItem[];
  onCreated: (returnRecord: SalesmanReturn) => void;
};

function emptyItem(): DraftItem {
  return {
    key: `ri-${crypto.randomUUID()}`,
    priceListItemId: null,
    name: "",
    qty: "",
    unitPrice: 0,
  };
}

export function AddReturnModal({
  open,
  onClose,
  salesmanId,
  partyName,
  priceList,
  onCreated,
}: AddReturnModalProps) {
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [notes, setNotes] = useState("");
  const [receivedAt, setReceivedAt] = useState(() => toDateInputValue());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setItems([emptyItem()]);
    setNotes("");
    setReceivedAt(toDateInputValue());
    setError("");
  }

  function handleClose() {
    if (busy) return;
    reset();
    onClose();
  }

  function updateItem(key: string, patch: Partial<DraftItem>) {
    setItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  function removeItem(key: string) {
    setItems((prev) => {
      const next = prev.filter((i) => i.key !== key);
      return next.length > 0 ? next : [emptyItem()];
    });
  }

  async function submit() {
    if (busy) return;
    setError("");

    const lineItems: InvoiceLineItem[] = [];
    for (const item of items) {
      const qty = Number(item.qty);
      if (!item.name.trim() && !item.qty) continue;
      if (!item.priceListItemId || !item.name.trim() || !(qty > 0) || !(item.unitPrice > 0)) {
        setError("Each return item needs a catalog item, qty, and price.");
        return;
      }
      lineItems.push({
        id: item.key,
        name: item.name.trim(),
        qty,
        unitPrice: item.unitPrice,
        amount: Math.round(qty * item.unitPrice * 100) / 100,
        priceListItemId: item.priceListItemId,
      });
    }
    if (lineItems.length === 0) {
      setError("Add at least one return item.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/salesmen/${salesmanId}/returns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineItems,
          notes: notes.trim() || undefined,
          receivedAt,
        }),
      });
      const data = (await res.json()) as {
        return?: SalesmanReturn;
        error?: string;
      };
      if (!res.ok || !data.return) {
        throw new Error(data.error || "Could not record return.");
      }
      onCreated(data.return);
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record return.");
    } finally {
      setBusy(false);
    }
  }

  const total = items.reduce((sum, item) => {
    const qty = Number(item.qty);
    if (!(qty > 0) || !(item.unitPrice > 0)) return sum;
    return sum + qty * item.unitPrice;
  }, 0);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Record return"
      footer={
        <ModalFooterActions
          onCancel={handleClose}
          onSubmit={() => void submit()}
          submitLabel="Save return"
          busy={busy}
        />
      }
    >
      <p className="mb-4 text-sm text-muted">
        Record goods returned by{" "}
        <span className="text-foreground">{partyName}</span> before an invoice.
        Credit reduces their balance and auto-applies on the next invoice.
      </p>

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">
            Return date
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

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted">Items</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => setItems((prev) => [...prev, emptyItem()])}
              className="text-xs text-accent hover:underline disabled:opacity-40"
            >
              + Add item
            </button>
          </div>
          {items.map((item) => {
            const qty = Number(item.qty);
            const amount =
              qty > 0 && item.unitPrice > 0
                ? Math.round(qty * item.unitPrice * 100) / 100
                : 0;
            return (
              <div
                key={item.key}
                className="space-y-2 rounded-lg border border-border bg-sidebar/40 p-2.5"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_5rem] items-center gap-2">
                  <ItemNameCombobox
                    items={priceList}
                    value={item.name}
                    disabled={busy}
                    placeholder="Item…"
                    onChange={(name) =>
                      updateItem(item.key, {
                        name,
                        priceListItemId: null,
                        unitPrice: 0,
                      })
                    }
                    onSelect={(picked) =>
                      updateItem(item.key, {
                        name: picked.item_name,
                        priceListItemId: picked.id,
                        unitPrice: picked.salesmen_price,
                      })
                    }
                    onTabToQty={() => undefined}
                  />
                  <input
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    disabled={busy}
                    value={item.qty}
                    placeholder="Qty"
                    className="w-full rounded-md border border-border bg-surface px-2 py-2 text-right text-sm tabular-nums"
                    onChange={(e) =>
                      updateItem(item.key, { qty: e.target.value })
                    }
                  />
                  <span className="text-right text-sm tabular-nums text-warning">
                    {amount > 0 ? formatINR(amount) : "—"}
                  </span>
                </div>
                {items.length > 1 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => removeItem(item.key)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
            );
          })}
          {total > 0 && (
            <p className="text-right text-sm font-medium tabular-nums">
              Total {formatINR(total)}
            </p>
          )}
        </div>

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
