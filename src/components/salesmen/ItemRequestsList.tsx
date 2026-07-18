"use client";

import { useMemo, useRef, useState } from "react";
import { ItemNameCombobox } from "@/components/salesmen/ItemNameCombobox";
import { Modal } from "@/components/ui/Modal";
import type { ItemType, PriceListItem } from "@/lib/auth/types";
import { ITEM_TYPE_LABELS } from "@/lib/auth/types";
import {
  daysToFulfill,
} from "@/lib/salesmen/item-requests";
import {
  formatInvoiceDate,
  formatShortDate,
} from "@/lib/salesmen/mock-data";
import type { ItemRequest, ItemRequestUrgency } from "@/lib/salesmen/types";
import { ITEM_REQUEST_URGENCY_LABELS } from "@/lib/salesmen/types";

type ItemRequestsListProps = {
  salesmanId: string;
  priceList: PriceListItem[];
  requests: ItemRequest[];
  onRequestsChange: (requests: ItemRequest[]) => void;
};

function todayInputValue(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function groupByMonth(requests: ItemRequest[]) {
  const groups: { label: string; items: ItemRequest[] }[] = [];
  for (const req of requests) {
    const label = formatInvoiceDate(req.requestedAt).monthYear;
    const existing = groups.find((g) => g.label === label);
    if (existing) existing.items.push(req);
    else groups.push({ label, items: [req] });
  }
  return groups;
}

function formatItemType(itemType: string | undefined): string | null {
  if (!itemType) return null;
  if (itemType in ITEM_TYPE_LABELS) {
    return ITEM_TYPE_LABELS[itemType as ItemType];
  }
  return itemType;
}

function urgencyClass(urgency: ItemRequestUrgency): string {
  if (urgency === "high") return "text-[#c45c26]";
  if (urgency === "low") return "text-muted";
  return "text-foreground";
}

export function ItemRequestsList({
  salesmanId,
  priceList,
  requests,
  onRequestsChange,
}: ItemRequestsListProps) {
  const [itemName, setItemName] = useState("");
  const [itemType, setItemType] = useState("");
  const [priceListItemId, setPriceListItemId] = useState<string | undefined>();
  const [qty, setQty] = useState("1");
  const [urgency, setUrgency] = useState<ItemRequestUrgency>("medium");
  const [requestedAt, setRequestedAt] = useState(todayInputValue);
  const [notes, setNotes] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fulfillingId, setFulfillingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const qtyRef = useRef<HTMLInputElement>(null);

  const openCount = useMemo(
    () => requests.filter((r) => r.status === "open").length,
    [requests],
  );

  const sorted = useMemo(() => {
    return [...requests].sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "open" ? -1 : 1;
      }
      return (
        new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
      );
    });
  }, [requests]);

  const openGroups = groupByMonth(sorted.filter((r) => r.status === "open"));
  const fulfilledGroups = groupByMonth(
    sorted.filter((r) => r.status === "fulfilled"),
  );

  function resetForm() {
    setItemName("");
    setItemType("");
    setPriceListItemId(undefined);
    setQty("1");
    setUrgency("medium");
    setRequestedAt(todayInputValue());
    setNotes("");
    setError(null);
  }

  function openModal() {
    resetForm();
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setError(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const qtyNum = Number(qty);
    if (!itemName.trim()) {
      setError("Item name is required");
      return;
    }
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setError("Quantity must be greater than 0");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        `/api/salesmen/${encodeURIComponent(salesmanId)}/item-requests`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemName: itemName.trim(),
            itemType: itemType.trim() || undefined,
            priceListItemId,
            qty: qtyNum,
            urgency,
            requestedAt: new Date(`${requestedAt}T12:00:00`).toISOString(),
            notes: notes.trim() || undefined,
          }),
        },
      );
      const data = (await res.json()) as {
        request?: ItemRequest;
        error?: string;
      };
      if (!res.ok || !data.request) {
        setError(data.error ?? "Failed to create request");
        return;
      }
      onRequestsChange([data.request!, ...requests]);
      setModalOpen(false);
      resetForm();
    } catch {
      setError("Failed to create request");
    } finally {
      setSaving(false);
    }
  }

  async function handleFulfill(requestId: string) {
    setError(null);
    setFulfillingId(requestId);
    try {
      const res = await fetch(
        `/api/salesmen/${encodeURIComponent(salesmanId)}/item-requests/${encodeURIComponent(requestId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "fulfilled" }),
        },
      );
      const data = (await res.json()) as {
        request?: ItemRequest;
        error?: string;
      };
      if (!res.ok || !data.request) {
        setError(data.error ?? "Failed to fulfill request");
        return;
      }
      onRequestsChange(
        requests.map((r) => (r.id === requestId ? data.request! : r)),
      );
    } catch {
      setError("Failed to fulfill request");
    } finally {
      setFulfillingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-medium tracking-tight">
            Item Request(s) ({openCount} open)
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            Urgent items the salesman needs when stock arrives
          </p>
        </div>
        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-foreground px-3.5 py-2 text-sm font-medium text-surface hover:bg-foreground/90"
        >
          <span className="text-base leading-none">+</span>
          Add request
        </button>
      </div>

      {error && !modalOpen && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-4 py-12 text-center text-sm text-muted">
          No item requests yet
        </div>
      ) : (
        <div className="space-y-6">
          {openGroups.length > 0 && (
            <RequestSection
              title="Open"
              groups={openGroups}
              fulfillingId={fulfillingId}
              onFulfill={handleFulfill}
            />
          )}
          {fulfilledGroups.length > 0 && (
            <RequestSection
              title="Fulfilled"
              groups={fulfilledGroups}
              fulfillingId={fulfillingId}
              onFulfill={handleFulfill}
            />
          )}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title="Add item request"
        footer={
          <div className="flex w-full flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={closeModal}
              disabled={saving}
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm hover:bg-sidebar disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="item-request-form"
              disabled={saving}
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-surface hover:bg-foreground/90 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save request"}
            </button>
          </div>
        }
      >
        <form id="item-request-form" onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs text-muted">Item name</label>
            <ItemNameCombobox
              items={priceList}
              value={itemName}
              showPrice={false}
              onChange={(value) => {
                setItemName(value);
                setPriceListItemId(undefined);
                setItemType("");
              }}
              onSelect={(item) => {
                setItemName(item.item_name);
                setPriceListItemId(item.id);
                setItemType(item.item_type);
              }}
              onTabToQty={() => qtyRef.current?.focus()}
              placeholder="Type or pick from price list"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-muted">Item type</label>
            <input
              type="text"
              value={formatItemType(itemType) ?? ""}
              readOnly
              placeholder="Select an item to auto-fill"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs text-muted">Quantity</label>
              <input
                ref={qtyRef}
                type="number"
                min="0.01"
                step="any"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-muted">Urgency</label>
              <select
                value={urgency}
                onChange={(e) =>
                  setUrgency(e.target.value as ItemRequestUrgency)
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-muted">
              Request date
            </label>
            <input
              type="date"
              value={requestedAt}
              onChange={(e) => setRequestedAt(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-muted">
              Notes (shade, size…)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="Shade, size, or other details"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}
        </form>
      </Modal>
    </div>
  );
}

function RequestSection({
  title,
  groups,
  fulfillingId,
  onFulfill,
}: {
  title: string;
  groups: { label: string; items: ItemRequest[] }[];
  fulfillingId: string | null;
  onFulfill: (id: string) => void;
}) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      <div className="space-y-5">
        {groups.map((group) => (
          <section key={`${title}-${group.label}`}>
            <h4 className="mb-2 px-1 text-xs font-medium tracking-wide text-muted uppercase">
              {group.label}
            </h4>
            <ul className="space-y-1 rounded-xl border border-border bg-surface p-1">
              {group.items.map((req) => {
                const date = formatInvoiceDate(req.requestedAt);
                const typeLabel = formatItemType(req.itemType);
                const days =
                  req.status === "fulfilled" && req.fulfilledAt
                    ? daysToFulfill(req.requestedAt, req.fulfilledAt)
                    : null;

                return (
                  <li
                    key={req.id}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 sm:gap-4 sm:px-3.5"
                  >
                    <div className="flex w-11 shrink-0 flex-col items-center sm:w-12">
                      <span className="text-[11px] text-muted">
                        {date.weekday}
                      </span>
                      <span className="text-xl font-semibold tracking-tight tabular-nums">
                        {date.day}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {req.itemName}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        Qty {req.qty}
                        {typeLabel ? (
                          <>
                            <span className="mx-1.5 text-border">·</span>
                            {typeLabel}
                          </>
                        ) : null}
                        <span className="mx-1.5 text-border">·</span>
                        <span className={urgencyClass(req.urgency)}>
                          {ITEM_REQUEST_URGENCY_LABELS[req.urgency]}
                        </span>
                        {req.notes ? (
                          <>
                            <span className="mx-1.5 text-border">·</span>
                            {req.notes}
                          </>
                        ) : null}
                      </p>
                      {req.status === "fulfilled" && req.fulfilledAt ? (
                        <p className="mt-0.5 text-xs text-muted">
                          Fulfilled {formatShortDate(req.fulfilledAt)}
                          {days !== null ? (
                            <>
                              <span className="mx-1.5 text-border">·</span>
                              {days === 0
                                ? "Same day"
                                : `${days} day${days === 1 ? "" : "s"}`}
                            </>
                          ) : null}
                        </p>
                      ) : null}
                    </div>
                    {req.status === "open" ? (
                      <button
                        type="button"
                        onClick={() => onFulfill(req.id)}
                        disabled={fulfillingId === req.id}
                        className="shrink-0 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-sidebar disabled:opacity-60"
                      >
                        {fulfillingId === req.id
                          ? "Saving…"
                          : "Mark fulfilled"}
                      </button>
                    ) : (
                      <span className="shrink-0 text-xs font-medium text-emerald-700">
                        Fulfilled
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
