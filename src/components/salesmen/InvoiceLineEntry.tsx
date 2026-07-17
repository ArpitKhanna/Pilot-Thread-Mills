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

const MIN_ROWS = 5;

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

/** Start with enough blank rows for Tally-style entry */
export function createInitialDraftLines(count = MIN_ROWS): DraftLine[] {
  return Array.from({ length: count }, () => emptyLine());
}

function isBlank(line: DraftLine): boolean {
  return (
    !line.name.trim() && !line.qty && line.priceListItemId === null
  );
}

/** Keep at least MIN_ROWS total, with one trailing blank after filled rows */
function normalizeLines(lines: DraftLine[]): DraftLine[] {
  const meaningful = lines.filter((l) => !isBlank(l));
  const existingBlanks = lines.filter(isBlank);
  const target = Math.max(MIN_ROWS, meaningful.length + 1);
  const blanksNeeded = target - meaningful.length;
  const blanks = [
    ...existingBlanks.slice(0, blanksNeeded),
    ...Array.from(
      { length: Math.max(0, blanksNeeded - existingBlanks.length) },
      () => emptyLine(),
    ),
  ];
  return [...meaningful, ...blanks];
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
      merged.amount = Math.round(qty * merged.unitPrice * 100) / 100;
      return merged;
    });
    onChange(normalizeLines(next));
  }

  function removeLine(key: string) {
    onChange(normalizeLines(lines.filter((l) => l.key !== key)));
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
    onChange(normalizeLines([...lines, blank]));
    requestAnimationFrame(() => {
      itemRefs.current.get(blank.key)?.focus();
    });
  }

  return (
    <div className="overflow-visible rounded-xl border border-border bg-surface shadow-sm">
      {/* Header */}
      <div className="grid grid-cols-[1.5rem_minmax(0,1fr)_3.5rem_4.5rem_4.5rem_1.5rem] gap-1 border-b border-border bg-table-header px-2 py-2 text-[11px] font-medium tracking-wide text-muted uppercase sm:grid-cols-[2rem_minmax(0,1fr)_4rem_5.5rem_5.5rem_1.75rem] sm:gap-2 sm:px-3">
        <span>#</span>
        <span>Item</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Rate</span>
        <span className="text-right">Amt</span>
        <span />
      </div>

      <div className="divide-y divide-border">
        {lines.map((line, index) => {
          const blank = isBlank(line);
          const canRemove = !blank || lines.filter((l) => !isBlank(l)).length > 0;

          return (
            <div
              key={line.key}
              className="grid grid-cols-[1.5rem_minmax(0,1fr)_3.5rem_4.5rem_4.5rem_1.5rem] items-center gap-1 px-2 py-1.5 sm:grid-cols-[2rem_minmax(0,1fr)_4rem_5.5rem_5.5rem_1.75rem] sm:gap-2 sm:px-3 sm:py-2"
            >
              <span className="text-xs tabular-nums text-muted">
                {index + 1}
              </span>
              <div className="min-w-0">
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
              </div>
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
                className="w-full rounded-md border border-border bg-surface px-1.5 py-2 text-right text-sm tabular-nums outline-none focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20 disabled:opacity-50 sm:px-2"
                onChange={(e) => updateLine(line.key, { qty: e.target.value })}
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
              <span className="truncate text-right text-xs tabular-nums text-muted sm:text-sm">
                {line.unitPrice > 0 ? formatINR(line.unitPrice) : "—"}
              </span>
              <span className="truncate text-right text-xs font-medium tabular-nums sm:text-sm">
                {line.amount > 0 ? formatINR(line.amount) : "—"}
              </span>
              <div className="flex justify-center">
                {canRemove && !blank ? (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => removeLine(line.key)}
                    className="rounded p-0.5 text-muted hover:bg-sidebar hover:text-foreground disabled:opacity-50"
                    aria-label="Remove line"
                  >
                    <RemoveIcon />
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
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
