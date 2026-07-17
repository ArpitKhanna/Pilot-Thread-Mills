"use client";

import { useRef } from "react";
import type { PriceListItem } from "@/lib/auth/types";
import { formatINR } from "@/lib/salesmen/mock-data";
import { ItemNameCombobox } from "./ItemNameCombobox";

export type DraftLine = {
  key: string;
  priceListItemId: string | null;
  name: string;
  qty: string;
  unitPrice: number;
  amount: number;
};

type InvoiceLineEntryProps = {
  priceList: PriceListItem[];
  lines: DraftLine[];
  onChange: (lines: DraftLine[]) => void;
  disabled?: boolean;
};

function emptyLine(): DraftLine {
  return {
    key: `line-${crypto.randomUUID()}`,
    priceListItemId: null,
    name: "",
    qty: "",
    unitPrice: 0,
    amount: 0,
  };
}

export function createEmptyDraftLine(): DraftLine {
  return emptyLine();
}

export function InvoiceLineEntry({
  priceList,
  lines,
  onChange,
  disabled = false,
}: InvoiceLineEntryProps) {
  const itemRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const qtyRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  function updateLine(key: string, patch: Partial<DraftLine>) {
    const next = lines.map((line) => {
      if (line.key !== key) return line;
      const merged = { ...line, ...patch };
      const qtyNum = Number(merged.qty);
      const qty = Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : 0;
      merged.amount =
        Math.round(qty * merged.unitPrice * 100) / 100;
      return merged;
    });

    const last = next[next.length - 1];
    const needsBlank =
      last &&
      (last.name.trim() !== "" ||
        last.qty !== "" ||
        last.priceListItemId !== null);
    onChange(needsBlank ? [...next, emptyLine()] : next);
  }

  function removeLine(key: string) {
    if (lines.length <= 1) {
      onChange([emptyLine()]);
      return;
    }
    const filtered = lines.filter((l) => l.key !== key);
    const last = filtered[filtered.length - 1];
    if (
      last &&
      (last.name.trim() !== "" ||
        last.qty !== "" ||
        last.priceListItemId !== null)
    ) {
      onChange([...filtered, emptyLine()]);
    } else {
      onChange(filtered.length ? filtered : [emptyLine()]);
    }
  }

  function focusQty(key: string) {
    requestAnimationFrame(() => {
      qtyRefs.current.get(key)?.focus();
      qtyRefs.current.get(key)?.select();
    });
  }

  function commitQtyAndAdvance(key: string) {
    const line = lines.find((l) => l.key === key);
    if (!line) return;
    if (!line.name.trim() || !line.priceListItemId) {
      focusQty(key);
      return;
    }
    const qtyNum = Number(line.qty);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      focusQty(key);
      return;
    }

    const idx = lines.findIndex((l) => l.key === key);
    const next = lines[idx + 1];
    if (next) {
      requestAnimationFrame(() => {
        itemRefs.current.get(next.key)?.focus();
      });
      return;
    }

    const blank = emptyLine();
    onChange([...lines, blank]);
    requestAnimationFrame(() => {
      itemRefs.current.get(blank.key)?.focus();
    });
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[36rem] text-sm">
        <thead>
          <tr className="border-b border-border bg-table-header text-left text-xs text-muted">
            <th className="w-10 px-2 py-2 font-medium">#</th>
            <th className="px-2 py-2 font-medium">Item</th>
            <th className="w-24 px-2 py-2 font-medium text-right">Qty</th>
            <th className="w-28 px-2 py-2 font-medium text-right">Rate</th>
            <th className="w-28 px-2 py-2 font-medium text-right">Amount</th>
            <th className="w-10 px-1 py-2" />
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => {
            const isBlankTrailing =
              index === lines.length - 1 &&
              !line.name &&
              !line.qty &&
              !line.priceListItemId;
            const filledCount = lines.filter(
              (l) => l.priceListItemId && Number(l.qty) > 0,
            ).length;
            const rowNumber = isBlankTrailing ? filledCount + 1 : index + 1;

            return (
              <tr
                key={line.key}
                className="border-b border-border last:border-0"
              >
                <td className="px-2 py-1.5 tabular-nums text-muted">
                  {rowNumber}
                </td>
                <td className="px-2 py-1.5">
                  <ItemNameCombobox
                    items={priceList}
                    value={line.name}
                    disabled={disabled}
                    inputRef={(el) => {
                      if (el) itemRefs.current.set(line.key, el);
                      else itemRefs.current.delete(line.key);
                    }}
                    onChange={(name) =>
                      updateLine(line.key, {
                        name,
                        priceListItemId: null,
                        unitPrice: 0,
                      })
                    }
                    onSelect={(item) =>
                      updateLine(line.key, {
                        name: item.item_name,
                        priceListItemId: item.id,
                        unitPrice: item.salesmen_price,
                      })
                    }
                    onTabToQty={() => focusQty(line.key)}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    ref={(el) => {
                      if (el) qtyRefs.current.set(line.key, el);
                      else qtyRefs.current.delete(line.key);
                    }}
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    disabled={disabled}
                    value={line.qty}
                    placeholder="0"
                    className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-right text-sm tabular-nums outline-none focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20 disabled:opacity-50"
                    onChange={(e) =>
                      updateLine(line.key, { qty: e.target.value })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitQtyAndAdvance(line.key);
                      }
                      if (e.key === "Tab" && !e.shiftKey) {
                        e.preventDefault();
                        commitQtyAndAdvance(line.key);
                      }
                    }}
                  />
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-muted">
                  {line.unitPrice > 0 ? formatINR(line.unitPrice) : "—"}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                  {line.amount > 0 ? formatINR(line.amount) : "—"}
                </td>
                <td className="px-1 py-1.5">
                  {!isBlankTrailing && (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => removeLine(line.key)}
                      className="rounded p-1 text-muted hover:bg-sidebar hover:text-foreground disabled:opacity-50"
                      aria-label="Remove line"
                    >
                      <RemoveIcon />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RemoveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M3.5 3.5l7 7M10.5 3.5l-7 7"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
