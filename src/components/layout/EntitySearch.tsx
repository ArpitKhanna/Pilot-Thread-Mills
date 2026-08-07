"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { AppContext } from "@/app/(app)/layout";
import type { SalesmanEntityType } from "@/lib/salesmen/types";

type SearchParty = {
  id: string;
  name: string;
  phone: string;
  entityType: SalesmanEntityType;
  area: string;
  isActive: boolean;
};

type MenuPos = { top: number; left: number; width: number };

const ENTITY_LABEL: Record<SalesmanEntityType, string> = {
  salesman: "Salesman",
  customer: "Customer",
};

type EntitySearchProps = {
  context: AppContext;
  autoFocus?: boolean;
  onNavigate?: () => void;
};

export function EntitySearch({
  context,
  autoFocus = false,
  onNavigate,
}: EntitySearchProps) {
  const router = useRouter();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const canSearch = context.modules.some(
    (m) => m.id === "entity-salesmen" || m.id === "entity-customers",
  );

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [pos, setPos] = useState<MenuPos | null>(null);
  const [parties, setParties] = useState<SearchParty[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [shortcutLabel, setShortcutLabel] = useState("Ctrl K");
  const loadStateRef = useRef({ parties: null as SearchParty[] | null, loading: false });

  loadStateRef.current = { parties, loading };

  const filtered = useMemo(() => {
    if (!parties) return [];
    const q = query.trim().toLowerCase();
    const matches = parties.filter((party) => {
      if (!q) return party.isActive;
      const haystack = [party.name, party.phone, party.area]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
    return matches
      .sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 12);
  }, [parties, query]);

  async function ensureLoaded() {
    if (loadStateRef.current.parties || loadStateRef.current.loading) return;
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/parties");
      const data = (await res.json()) as {
        parties?: SearchParty[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setParties(data.parties ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load");
      setParties([]);
    } finally {
      setLoading(false);
    }
  }

  function updatePosition() {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(rect.width, window.innerWidth - 16);
    const left = Math.min(
      Math.max(8, rect.left),
      window.innerWidth - width - 8,
    );
    setPos({
      top: rect.bottom + 4,
      left,
      width,
    });
  }

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    updatePosition();
  }, [open, query, filtered.length, loading]);

  useEffect(() => {
    if (!open) return;
    function onScrollOrResize() {
      updatePosition();
    }
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

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

  useEffect(() => {
    const isMac =
      typeof navigator !== "undefined" &&
      /Mac|iPhone|iPad|iPod/.test(navigator.platform);
    setShortcutLabel(isMac ? "⌘K" : "Ctrl K");
  }, []);

  useEffect(() => {
    if (!canSearch) return;
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "k") return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        if (e.target === inputRef.current) {
          e.preventDefault();
          inputRef.current?.blur();
          setOpen(false);
        }
        return;
      }
      e.preventDefault();
      inputRef.current?.focus();
      setOpen(true);
      void ensureLoaded();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSearch]);

  function navigateTo(party: SearchParty) {
    const href =
      party.entityType === "customer"
        ? `/entities/customers/${party.id}`
        : `/entities/salesmen/${party.id}?tab=invoices`;
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
    onNavigate?.();
    router.push(href);
  }

  useEffect(() => {
    if (!autoFocus) return;
    inputRef.current?.focus();
    setOpen(true);
    void ensureLoaded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }

    if (e.key === "Enter" && open && filtered[highlight]) {
      e.preventDefault();
      navigateTo(filtered[highlight]);
    }
  }

  if (!canSearch) return null;

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
          zIndex: 80,
        }}
        className="max-h-72 overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg"
      >
        {loading && !parties ? (
          <div className="px-3 py-2 text-sm text-muted">Loading…</div>
        ) : loadError ? (
          <div className="px-3 py-2 text-sm text-red-600">{loadError}</div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted">
            {query.trim()
              ? "No matching salesman or customer"
              : "Type a name to search"}
          </div>
        ) : (
          filtered.map((party, index) => (
            <button
              key={party.id}
              type="button"
              role="option"
              aria-selected={index === highlight}
              className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                index === highlight ? "bg-sidebar" : "hover:bg-sidebar"
              }`}
              onMouseEnter={() => setHighlight(index)}
              onMouseDown={(e) => {
                e.preventDefault();
                navigateTo(party);
              }}
            >
              <span className="min-w-0 truncate font-medium text-foreground">
                {party.name}
                {!party.isActive && (
                  <span className="ml-1.5 text-xs font-normal text-muted">
                    (inactive)
                  </span>
                )}
              </span>
              <span className="shrink-0 text-xs text-muted">
                {[party.area || null, ENTITY_LABEL[party.entityType]]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </button>
          ))
        )}
      </div>,
      document.body,
    );

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1 sm:max-w-xs lg:max-w-sm">
      <div
        ref={anchorRef}
        className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          className="shrink-0 text-muted"
          aria-hidden
        >
          <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M10.5 10.5L13.5 13.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label="Search salesmen and customers"
          value={query}
          placeholder="Search salesman or customer…"
          autoComplete="off"
          className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted"
          onFocus={() => {
            setOpen(true);
            void ensureLoaded();
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            void ensureLoaded();
          }}
          onKeyDown={onKeyDown}
        />
        <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted sm:inline">
          {shortcutLabel}
        </kbd>
      </div>
      {menu}
    </div>
  );
}
