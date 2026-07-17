"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { PriceListItem } from "@/lib/auth/types";
import { formatINR } from "@/lib/salesmen/mock-data";

type ItemNameComboboxProps = {
  items: PriceListItem[];
  value: string;
  onChange: (value: string) => void;
  onSelect: (item: PriceListItem) => void;
  onTabToQty: () => void;
  inputRef?: (el: HTMLInputElement | null) => void;
  disabled?: boolean;
  placeholder?: string;
};

export function ItemNameCombobox({
  items,
  value,
  onChange,
  onSelect,
  onTabToQty,
  inputRef,
  disabled = false,
  placeholder = "Item name",
}: ItemNameComboboxProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const query = value.trim().toLowerCase();
  const filtered = items.filter((item) =>
    query ? item.item_name.toLowerCase().includes(query) : true,
  );
  const visible = filtered.slice(0, 12);

  useEffect(() => {
    setHighlight(0);
  }, [value]);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function pick(item: PriceListItem) {
    onSelect(item);
    setOpen(false);
    requestAnimationFrame(() => onTabToQty());
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setHighlight((h) => Math.min(h + 1, Math.max(visible.length - 1, 0)));
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }

    if (e.key === "Enter") {
      if (open && visible[highlight]) {
        e.preventDefault();
        pick(visible[highlight]);
      }
      return;
    }

    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      if (open && value.trim() && visible.length > 0) {
        const exact = visible.find(
          (i) => i.item_name.toLowerCase() === value.trim().toLowerCase(),
        );
        const chosen = exact ?? visible[highlight];
        if (chosen) {
          onSelect(chosen);
          setOpen(false);
          requestAnimationFrame(() => onTabToQty());
          return;
        }
      }
      onTabToQty();
    }
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20 disabled:opacity-50"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {open && visible.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full min-w-[14rem] overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-md"
        >
          {visible.map((item, index) => (
            <li key={item.id} role="option" aria-selected={index === highlight}>
              <button
                type="button"
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                  index === highlight ? "bg-sidebar" : "hover:bg-sidebar"
                }`}
                onMouseEnter={() => setHighlight(index)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(item);
                }}
              >
                <span className="min-w-0 truncate">
                  {item.item_name}
                  {item.count_label ? (
                    <span className="text-muted"> · {item.count_label}</span>
                  ) : null}
                </span>
                <span className="shrink-0 tabular-nums text-muted">
                  {formatINR(item.salesmen_price)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && query && visible.length === 0 && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted shadow-md">
          No matching items
        </div>
      )}
    </div>
  );
}
