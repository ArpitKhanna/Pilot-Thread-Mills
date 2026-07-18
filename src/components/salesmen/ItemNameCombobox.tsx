"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  /** When false, dropdown shows name (+ count) only — no price. Default true. */
  showPrice?: boolean;
};

type MenuPos = { top: number; left: number; width: number };

export function ItemNameCombobox({
  items,
  value,
  onChange,
  onSelect,
  onTabToQty,
  inputRef,
  disabled = false,
  placeholder = "Item name",
  showPrice = true,
}: ItemNameComboboxProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [pos, setPos] = useState<MenuPos | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputElRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const query = value.trim().toLowerCase();
  const filtered = items.filter((item) =>
    query ? item.item_name.toLowerCase().includes(query) : true,
  );
  const visible = filtered.slice(0, 12);

  function setInputRef(el: HTMLInputElement | null) {
    inputElRef.current = el;
    inputRef?.(el);
  }

  function updatePosition() {
    const el = inputElRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.max(rect.width, 240);
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 220 && rect.top > spaceBelow;
    setPos({
      top: openUp ? rect.top - 4 : rect.bottom + 4,
      left: Math.min(rect.left, window.innerWidth - width - 8),
      width,
    });
  }

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    updatePosition();
  }, [open, value, visible.length]);

  useEffect(() => {
    if (!open) return;
    function onScrollOrResize() {
      updatePosition();
    }
    window.addEventListener("resize", onScrollOrResize);
    // capture scroll from any scrollable ancestor
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open]);

  useEffect(() => {
    setHighlight(0);
  }, [value]);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
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
      setOpen(false);
      onTabToQty();
    }
  }

  const menu =
    open &&
    pos &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={menuRef}
        id={listId}
        role="listbox"
        style={{
          position: "fixed",
          top: pos.top,
          left: pos.left,
          width: pos.width,
          transform:
            pos.top < (inputElRef.current?.getBoundingClientRect().top ?? 0)
              ? "translateY(-100%)"
              : undefined,
          zIndex: 80,
        }}
        className="max-h-56 overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg"
      >
        {visible.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted">No matching items</div>
        ) : (
          visible.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={index === highlight}
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
              {showPrice ? (
                <span className="shrink-0 tabular-nums text-muted">
                  {formatINR(item.salesmen_price)}
                </span>
              ) : null}
            </button>
          ))
        )}
      </div>,
      document.body,
    );

  return (
    <div ref={rootRef} className="relative min-w-0">
      <input
        ref={setInputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-md border border-border bg-surface px-2.5 py-2 text-sm outline-none focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20 disabled:opacity-50"
        onFocus={() => {
          if (!disabled) setOpen(true);
        }}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {menu}
    </div>
  );
}
