"use client";

import { useMemo, useRef, useState } from "react";
import { ItemNameCombobox } from "@/components/salesmen/ItemNameCombobox";
import { Modal } from "@/components/ui/Modal";
import type { ItemType, PriceListItem } from "@/lib/auth/types";
import { ITEM_TYPE_LABELS } from "@/lib/auth/types";
import { daysToFulfill } from "@/lib/salesmen/item-requests";
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

function toDateInputValue(iso: string): string {
  const d = new Date(iso);
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<
    "delete" | "fulfill" | "undo" | null
  >(null);
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
    setEditingId(null);
    setError(null);
  }

  function openCreateModal() {
    resetForm();
    setModalOpen(true);
  }

  function openEditModal(req: ItemRequest) {
    setEditingId(req.id);
    setItemName(req.itemName);
    setItemType(req.itemType ?? "");
    setPriceListItemId(req.priceListItemId);
    setQty(String(req.qty));
    setUrgency(req.urgency);
    setRequestedAt(toDateInputValue(req.requestedAt));
    setNotes(req.notes ?? "");
    setError(null);
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    resetForm();
  }

  async function handleSave(e: React.FormEvent) {
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

    const payload = {
      itemName: itemName.trim(),
      itemType: itemType.trim() || undefined,
      priceListItemId,
      qty: qtyNum,
      urgency,
      requestedAt: new Date(`${requestedAt}T12:00:00`).toISOString(),
      notes: notes.trim() || undefined,
    };

    setSaving(true);
    try {
      const url = editingId
        ? `/api/salesmen/${encodeURIComponent(salesmanId)}/item-requests/${encodeURIComponent(editingId)}`
        : `/api/salesmen/${encodeURIComponent(salesmanId)}/item-requests`;
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        request?: ItemRequest;
        error?: string;
      };
      if (!res.ok || !data.request) {
        setError(
          data.error ??
            (editingId ? "Failed to update request" : "Failed to create request"),
        );
        return;
      }
      if (editingId) {
        onRequestsChange(
          requests.map((r) => (r.id === editingId ? data.request! : r)),
        );
      } else {
        onRequestsChange([data.request!, ...requests]);
      }
      setModalOpen(false);
      resetForm();
    } catch {
      setError(editingId ? "Failed to update request" : "Failed to create request");
    } finally {
      setSaving(false);
    }
  }

  async function patchStatus(
    requestId: string,
    status: "fulfilled" | "open",
  ) {
    if (busyId) return;
    setError(null);
    setBusyId(requestId);
    setBusyAction(status === "fulfilled" ? "fulfill" : "undo");
    try {
      const res = await fetch(
        `/api/salesmen/${encodeURIComponent(salesmanId)}/item-requests/${encodeURIComponent(requestId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      const data = (await res.json()) as {
        request?: ItemRequest;
        error?: string;
      };
      if (!res.ok || !data.request) {
        setError(
          data.error ??
            (status === "fulfilled"
              ? "Failed to fulfill request"
              : "Failed to undo fulfillment"),
        );
        return;
      }
      onRequestsChange(
        requests.map((r) => (r.id === requestId ? data.request! : r)),
      );
    } catch {
      setError(
        status === "fulfilled"
          ? "Failed to fulfill request"
          : "Failed to undo fulfillment",
      );
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  }

  async function handleDelete(requestId: string) {
    if (!confirm("Delete this item request?")) return;
    if (busyId) return;
    setError(null);
    setBusyId(requestId);
    setBusyAction("delete");
    try {
      const res = await fetch(
        `/api/salesmen/${encodeURIComponent(salesmanId)}/item-requests/${encodeURIComponent(requestId)}`,
        { method: "DELETE" },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to delete request");
        return;
      }
      onRequestsChange(requests.filter((r) => r.id !== requestId));
    } catch {
      setError("Failed to delete request");
    } finally {
      setBusyId(null);
      setBusyAction(null);
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
          onClick={openCreateModal}
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
              busyId={busyId}
              busyAction={busyAction}
              onEdit={openEditModal}
              onDelete={handleDelete}
              onFulfill={(id) => patchStatus(id, "fulfilled")}
            />
          )}
          {fulfilledGroups.length > 0 && (
            <RequestSection
              title="Fulfilled"
              groups={fulfilledGroups}
              busyId={busyId}
              busyAction={busyAction}
              onUndo={(id) => patchStatus(id, "open")}
            />
          )}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? "Edit item request" : "Add item request"}
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
              {saving ? "Saving…" : editingId ? "Save changes" : "Save request"}
            </button>
          </div>
        }
      >
        <form id="item-request-form" onSubmit={handleSave} className="space-y-4">
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
  busyId,
  busyAction,
  onEdit,
  onDelete,
  onFulfill,
  onUndo,
}: {
  title: string;
  groups: { label: string; items: ItemRequest[] }[];
  busyId: string | null;
  busyAction: "delete" | "fulfill" | "undo" | null;
  onEdit?: (req: ItemRequest) => void;
  onDelete?: (id: string) => void;
  onFulfill?: (id: string) => void;
  onUndo?: (id: string) => void;
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
                const busy = busyId === req.id;

                return (
                  <li
                    key={req.id}
                    className="flex flex-col gap-2 rounded-lg px-3 py-2.5 sm:flex-row sm:items-center sm:gap-4 sm:px-3.5"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
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
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-1.5 pl-14 sm:pl-0">
                      {req.status === "open" ? (
                        <>
                          <ActionButton
                            onClick={() => onEdit?.(req)}
                            disabled={busy}
                          >
                            Edit
                          </ActionButton>
                          <ActionButton
                            onClick={() => onDelete?.(req.id)}
                            disabled={busy}
                            danger
                          >
                            {busy && busyAction === "delete"
                              ? "Deleting…"
                              : "Delete"}
                          </ActionButton>
                          <ActionButton
                            onClick={() => onFulfill?.(req.id)}
                            disabled={busy}
                            primary
                          >
                            {busy && busyAction === "fulfill"
                              ? "Saving…"
                              : "Mark fulfilled"}
                          </ActionButton>
                        </>
                      ) : (
                        <ActionButton
                          onClick={() => onUndo?.(req.id)}
                          disabled={busy}
                        >
                          {busy && busyAction === "undo" ? "Saving…" : "Undo"}
                        </ActionButton>
                      )}
                    </div>
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

function ActionButton({
  children,
  onClick,
  disabled,
  danger,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-60 ${
        primary
          ? "border-foreground bg-foreground text-surface hover:bg-foreground/90"
          : danger
            ? "border-border bg-background text-red-700 hover:bg-red-50"
            : "border-border bg-background hover:bg-sidebar"
      }`}
    >
      {children}
    </button>
  );
}
