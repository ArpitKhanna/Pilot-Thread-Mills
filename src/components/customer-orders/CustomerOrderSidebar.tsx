"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ItemNameCombobox } from "@/components/salesmen/ItemNameCombobox";
import { Modal } from "@/components/ui/Modal";
import type { PriceListItem } from "@/lib/auth/types";
import {
  CUSTOMER_ORDER_STATUS_LABELS,
  KANBAN_COLUMNS,
  ORDER_LINE_UNIT_LABELS,
  ORDER_STATUS_MOVES,
  PENDING_ITEM_STATUS_LABELS,
  type CustomerOrder,
  type CustomerOrderLineUnit,
  type CustomerOrderStatus,
  type CustomerPendingItem,
} from "@/lib/customer-orders/types";
import {
  formatINR,
  formatShortDate,
  formatShortTime,
} from "@/lib/salesmen/mock-data";
import type { Salesman } from "@/lib/salesmen/types";

type DraftLine = {
  key: string;
  priceListItemId: string | null;
  itemName: string;
  shadeCode: string;
  qty: string;
  unit: CustomerOrderLineUnit;
  isUrgent: boolean;
};

type SidebarTab = "timeline" | "details" | "pending";

type ActivityEvent = {
  id: string;
  text: string;
  at: string | null;
};

type CustomerOrderSidebarProps = {
  orderId: string | null;
  priceList: PriceListItem[];
  customers: Salesman[];
  onClose: () => void;
  onOrderChange?: (order: CustomerOrder) => void;
  onDeleted?: (orderId: string) => void;
  onRequestInvoice?: (orderId: string) => void;
  onRequestAssignOut?: (orderId: string) => void;
};

function linesFromOrder(order: CustomerOrder): DraftLine[] {
  if (order.lines.length === 0) {
    return [
      {
        key: crypto.randomUUID(),
        priceListItemId: null,
        itemName: "",
        shadeCode: "",
        qty: "1",
        unit: "box",
        isUrgent: false,
      },
    ];
  }
  return order.lines.map((line) => ({
    key: line.id,
    priceListItemId: line.priceListItemId,
    itemName: line.itemName ?? "",
    shadeCode: line.shadeCode,
    qty: String(line.qty),
    unit: line.unit,
    isUrgent: Boolean(line.isUrgent),
  }));
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "";
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return formatShortDate(iso);
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatShortDate(iso);
}

function buildOrderActivity(order: CustomerOrder): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  const name = order.customerName ?? "customer";
  const lineBit =
    order.lineCount > 0
      ? ` with ${order.lineCount} line${order.lineCount === 1 ? "" : "s"}`
      : "";

  events.push({
    id: "created",
    text: `Order was created for ${name}${lineBit}.`,
    at: order.createdAt,
  });

  if (order.isUrgent) {
    events.push({
      id: "urgent",
      text: "Order was marked urgent.",
      at: null,
    });
  }

  if (order.status !== "picking" && order.status !== "draft") {
    events.push({
      id: "status",
      text: `Moved to ${CUSTOMER_ORDER_STATUS_LABELS[order.status]}.`,
      at: order.updatedAt !== order.createdAt ? order.updatedAt : null,
    });
  }

  if (order.invoiceId) {
    events.push({
      id: "invoice",
      text: "Invoice was generated for this order.",
      at: order.updatedAt,
    });
  }

  if (order.deliveryByName) {
    events.push({
      id: "delivery",
      text: `Delivery assigned to ${order.deliveryByName}.`,
      at: null,
    });
  }

  if (order.status === "cancelled") {
    events.push({
      id: "cancelled",
      text: "Order was cancelled.",
      at: order.updatedAt,
    });
  }

  return events;
}

function ChevronUpIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <path
        d="M4 10L8 6L12 10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] items-baseline gap-3 text-sm">
      <span className="text-[11px] font-medium tracking-wide text-muted uppercase">
        {label}
      </span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 border-b-2 px-1 pb-2.5 text-sm transition-colors ${
        active
          ? "border-foreground font-medium text-foreground"
          : "border-transparent text-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

export function CustomerOrderSidebar({
  orderId,
  priceList,
  customers,
  onClose,
  onOrderChange,
  onDeleted,
  onRequestInvoice,
  onRequestAssignOut,
}: CustomerOrderSidebarProps) {
  const router = useRouter();
  const open = Boolean(orderId);
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<SidebarTab>("timeline");
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingItems, setPendingItems] = useState<CustomerPendingItem[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const moveMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!orderId) {
      setOrder(null);
      setLines([]);
      setError("");
      setTab("timeline");
      setMoveOpen(false);
      setDeleteOpen(false);
      setPendingItems([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    setTab("timeline");
    void (async () => {
      try {
        const res = await fetch(`/api/customer-orders/${orderId}`);
        const json = (await res.json()) as {
          order?: CustomerOrder;
          error?: string;
        };
        if (!res.ok || !json.order) {
          throw new Error(json.error ?? "Failed to load order");
        }
        if (cancelled) return;
        setOrder(json.order);
        setLines(linesFromOrder(json.order));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load order");
          setOrder(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (moveOpen) setMoveOpen(false);
        else if (deleteOpen) setDeleteOpen(false);
        else onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, moveOpen, deleteOpen]);

  useEffect(() => {
    if (!moveOpen) return;
    function onPointer(e: MouseEvent) {
      if (!moveMenuRef.current?.contains(e.target as Node)) {
        setMoveOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [moveOpen]);

  useEffect(() => {
    if (!order?.customerId) return;
    const customerId = order.customerId;
    let cancelled = false;
    setPendingLoading(true);
    void (async () => {
      try {
        const res = await fetch(
          `/api/customer-pending-items?customerId=${encodeURIComponent(customerId)}`,
        );
        const json = (await res.json()) as {
          pending?: CustomerPendingItem[];
          error?: string;
        };
        if (!res.ok) throw new Error(json.error ?? "Failed to load pending");
        if (!cancelled) setPendingItems(json.pending ?? []);
      } catch {
        if (!cancelled) setPendingItems([]);
      } finally {
        if (!cancelled) setPendingLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [order?.customerId]);

  function applyOrder(next: CustomerOrder) {
    setOrder(next);
    setLines(linesFromOrder(next));
    onOrderChange?.(next);
  }

  const customer = useMemo(
    () =>
      order
        ? (customers.find((c) => c.id === order.customerId) ?? null)
        : null,
    [customers, order],
  );

  const activity = useMemo(
    () => (order ? buildOrderActivity(order) : []),
    [order],
  );

  const locked =
    order != null &&
    (order.status === "invoiced" ||
      order.status === "out_for_delivery" ||
      order.status === "delivered" ||
      order.status === "cancelled");

  const canDelete =
    order != null &&
    (order.status === "picking" || order.status === "draft") &&
    !order.invoiceId;

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  async function saveLines() {
    if (!order) return;
    setBusy("lines");
    setError("");
    try {
      const payload = lines
        .filter((l) => l.shadeCode.trim() && Number(l.qty) > 0)
        .map((l) => ({
          priceListItemId: l.priceListItemId,
          shadeCode: l.shadeCode.trim(),
          qty: Number(l.qty),
          unit: l.unit,
          source: "manual" as const,
          isUrgent: l.isUrgent,
        }));
      const res = await fetch(`/api/customer-orders/${order.id}/lines`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: payload, createMissingShades: true }),
      });
      const json = (await res.json()) as {
        order?: CustomerOrder;
        error?: string;
      };
      if (!res.ok || !json.order) {
        throw new Error(json.error ?? "Failed to save lines");
      }
      applyOrder(json.order);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save lines");
    } finally {
      setBusy("");
    }
  }

  async function setStatus(status: CustomerOrderStatus) {
    if (!order) return;
    if (order.status === "packed" && status === "invoiced") {
      setMoveOpen(false);
      onRequestInvoice?.(order.id);
      return;
    }
    if (order.status === "invoiced" && status === "out_for_delivery") {
      setMoveOpen(false);
      onRequestAssignOut?.(order.id);
      return;
    }
    setBusy("status");
    setError("");
    setMoveOpen(false);
    try {
      const res = await fetch(`/api/customer-orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = (await res.json()) as {
        order?: CustomerOrder;
        error?: string;
      };
      if (!res.ok || !json.order) {
        throw new Error(json.error ?? "Failed to update status");
      }
      applyOrder(json.order);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setBusy("");
    }
  }

  async function toggleUrgent() {
    if (!order) return;
    setBusy("urgent");
    setError("");
    try {
      const res = await fetch(`/api/customer-orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isUrgent: !order.isUrgent }),
      });
      const json = (await res.json()) as {
        order?: CustomerOrder;
        error?: string;
      };
      if (!res.ok || !json.order) {
        throw new Error(json.error ?? "Could not update urgency");
      }
      applyOrder(json.order);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update urgency");
    } finally {
      setBusy("");
    }
  }

  async function confirmDelete() {
    if (!order || !canDelete) return;
    setBusy("delete");
    setError("");
    try {
      const res = await fetch(`/api/customer-orders/${order.id}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to delete order");
      const id = order.id;
      setDeleteOpen(false);
      onDeleted?.(id);
      onClose();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete order");
    } finally {
      setBusy("");
    }
  }

  function printPickSheet() {
    window.print();
  }

  if (!open) return null;

  const area = order
    ? order.areaSnapshot || order.customerArea || "—"
    : "—";
  const orderTime = order ? formatShortTime(order.createdAt) : "";
  const slips =
    order?.attachments.filter((a) => a.kind === "order_slip") ?? [];
  const patches =
    order?.attachments.filter((a) => a.kind === "cloth_patch") ?? [];
  const pendingBalance = customer?.pendingBalance ?? null;
  const moveTargets = KANBAN_COLUMNS.filter((s) => s !== order?.status);
  const pendingCount = pendingItems.length;

  return (
    <div className="fixed inset-0 z-[55] print:static print:z-auto">
      <button
        type="button"
        aria-label="Close order details"
        className="absolute inset-0 bg-foreground/30 print:hidden"
        onClick={onClose}
      />
      <aside
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-border bg-surface shadow-xl print:relative print:max-w-none print:border-0 print:shadow-none"
        role="dialog"
        aria-modal="true"
        aria-label="Order details"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3.5 print:border-0">
          <h2 className="text-base font-medium">Order Details</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted hover:bg-sidebar hover:text-foreground print:hidden"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        {loading ? (
          <div className="flex-1 px-5 py-4 text-sm text-muted">
            Loading order…
          </div>
        ) : order ? (
          <>
            <div className="shrink-0 space-y-4 border-b border-border px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-xl font-semibold tracking-tight">
                  {order.customerName ?? "Customer"}
                </h3>
                <span className="shrink-0 pt-1 text-[11px] font-medium tracking-wide text-muted uppercase">
                  {CUSTOMER_ORDER_STATUS_LABELS[order.status]}
                  {order.isUrgent ? " · Urgent" : ""}
                </span>
              </div>

              <div className="space-y-2">
                <MetaRow label="Area" value={area} />
                <MetaRow
                  label="Order date"
                  value={formatShortDate(order.orderDate)}
                />
                <MetaRow
                  label="Order time"
                  value={orderTime || "—"}
                />
                <MetaRow
                  label="Pending bal."
                  value={
                    pendingBalance != null ? formatINR(pendingBalance) : "—"
                  }
                />
              </div>

              <div className="flex gap-2 print:hidden">
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void toggleUrgent()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-sidebar disabled:opacity-50"
                >
                  {order.isUrgent ? "Clear urgent" : "Mark urgent"}
                </button>
                {order.status === "picking" || order.status === "packed" ? (
                  <button
                    type="button"
                    onClick={printPickSheet}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-sidebar"
                  >
                    Print sheet
                  </button>
                ) : null}
              </div>

              <div className="flex gap-4 overflow-x-auto">
                <TabButton
                  active={tab === "timeline"}
                  onClick={() => setTab("timeline")}
                  label="Activity Timeline"
                />
                <TabButton
                  active={tab === "details"}
                  onClick={() => setTab("details")}
                  label="Details"
                />
                <TabButton
                  active={tab === "pending"}
                  onClick={() => setTab("pending")}
                  label={
                    pendingCount > 0 ? `Pending ${pendingCount}` : "Pending"
                  }
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 print:overflow-visible">
              {error ? (
                <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {error}
                </p>
              ) : null}

              {tab === "timeline" ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
                    <span className="text-sm font-medium">
                      {order.customerName ?? "Customer"}
                    </span>
                    <span className="text-xs font-medium tracking-wide text-muted uppercase">
                      {CUSTOMER_ORDER_STATUS_LABELS[order.status]}
                    </span>
                  </div>

                  {activity.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted">
                      No activity yet
                    </p>
                  ) : (
                    activity.map((event) => (
                      <div
                        key={event.id}
                        className="rounded-xl border border-border px-3.5 py-3"
                      >
                        <p className="text-sm text-foreground">{event.text}</p>
                        {event.at ? (
                          <p className="mt-2 text-xs text-muted">
                            {formatRelativeTime(event.at)}
                          </p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              ) : null}

              {tab === "pending" ? (
                pendingLoading ? (
                  <p className="text-sm text-muted">Loading pending…</p>
                ) : pendingItems.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted">
                    No pending items
                  </p>
                ) : (
                  <div className="space-y-2">
                    {pendingItems.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-border px-3.5 py-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">
                              {item.itemName ?? "Item"} — {item.shadeCode}
                            </p>
                            <p className="mt-0.5 text-xs text-muted">
                              {item.qty} {ORDER_LINE_UNIT_LABELS[item.unit]}
                              {item.invoiceDate
                                ? ` · ${formatShortDate(item.invoiceDate)}`
                                : ""}
                              {item.isUrgent ? " · Urgent" : ""}
                            </p>
                          </div>
                          <span className="shrink-0 text-[11px] font-medium tracking-wide text-muted uppercase">
                            {PENDING_ITEM_STATUS_LABELS[item.status]}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : null}

              {tab === "details" ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-medium">Lines</h3>
                    <div className="flex items-center gap-3">
                      <span className="text-sm tabular-nums text-muted">
                        {formatINR(order.amount)}
                      </span>
                      {!locked ? (
                        <button
                          type="button"
                          disabled={Boolean(busy)}
                          onClick={() => void saveLines()}
                          className="text-xs font-medium text-muted hover:text-foreground disabled:opacity-50 print:hidden"
                        >
                          {busy === "lines" ? "Saving…" : "Save"}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {lines.map((line) => (
                      <div
                        key={line.key}
                        className="grid gap-1.5 rounded-xl border border-border p-3"
                      >
                        {locked ? (
                          <div className="text-sm">
                            <div className="font-medium">
                              {line.itemName || "Item"} · {line.shadeCode}
                            </div>
                            <div className="text-xs text-muted">
                              {line.qty} {ORDER_LINE_UNIT_LABELS[line.unit]}
                              {line.isUrgent ? " · Urgent" : ""}
                            </div>
                          </div>
                        ) : (
                          <>
                            <ItemNameCombobox
                              items={priceList}
                              value={line.itemName}
                              onChange={(value) =>
                                updateLine(line.key, {
                                  itemName: value,
                                  priceListItemId: null,
                                })
                              }
                              onSelect={(item) =>
                                updateLine(line.key, {
                                  itemName: item.item_name,
                                  priceListItemId: item.id,
                                })
                              }
                              onTabToQty={() => undefined}
                              showPrice={false}
                              placeholder="Item"
                            />
                            <div className="grid grid-cols-[1fr_0.55fr_0.7fr] gap-1.5">
                              <input
                                value={line.shadeCode}
                                onChange={(e) =>
                                  updateLine(line.key, {
                                    shadeCode: e.target.value,
                                  })
                                }
                                placeholder="Shade"
                                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none"
                              />
                              <input
                                value={line.qty}
                                onChange={(e) =>
                                  updateLine(line.key, {
                                    qty: e.target.value,
                                  })
                                }
                                placeholder="Qty"
                                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none"
                              />
                              <select
                                value={line.unit}
                                onChange={(e) =>
                                  updateLine(line.key, {
                                    unit: e.target
                                      .value as CustomerOrderLineUnit,
                                  })
                                }
                                className="rounded-md border border-border bg-background px-1.5 py-1.5 text-sm outline-none"
                              >
                                {Object.entries(ORDER_LINE_UNIT_LABELS).map(
                                  ([value, label]) => (
                                    <option key={value} value={value}>
                                      {label}
                                    </option>
                                  ),
                                )}
                              </select>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                    {!locked ? (
                      <button
                        type="button"
                        onClick={() =>
                          setLines((prev) => [
                            ...prev,
                            {
                              key: crypto.randomUUID(),
                              priceListItemId: null,
                              itemName: "",
                              shadeCode: "",
                              qty: "1",
                              unit: "box",
                              isUrgent: false,
                            },
                          ])
                        }
                        className="text-xs font-medium text-muted hover:text-foreground print:hidden"
                      >
                        + Add line
                      </button>
                    ) : null}
                  </div>

                  {slips.length > 0 || patches.length > 0 ? (
                    <section className="space-y-2 print:hidden">
                      <h3 className="text-sm font-medium">Attachments</h3>
                      <div className="grid grid-cols-3 gap-2">
                        {[...slips, ...patches].map((att) =>
                          att.signedUrl &&
                          (att.contentType?.startsWith("image/") ||
                            att.kind === "cloth_patch") ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={att.id}
                              src={att.signedUrl}
                              alt={att.fileName ?? att.kind}
                              className="h-20 w-full rounded-md border border-border object-cover"
                            />
                          ) : (
                            <div
                              key={att.id}
                              className="flex h-20 items-center justify-center rounded-md border border-border bg-sidebar px-1 text-center text-[10px] text-muted"
                            >
                              {att.fileName ?? att.kind}
                            </div>
                          ),
                        )}
                      </div>
                    </section>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="shrink-0 border-t border-border px-5 py-3 print:hidden">
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1" ref={moveMenuRef}>
                  <button
                    type="button"
                    disabled={Boolean(busy) || order.status === "delivered"}
                    onClick={() => setMoveOpen((v) => !v)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-foreground px-3 py-2.5 text-sm font-medium text-surface disabled:opacity-50"
                  >
                    Move to
                    <ChevronUpIcon />
                  </button>
                  {moveOpen ? (
                    <div className="absolute bottom-full left-0 right-0 z-10 mb-1 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
                      {moveTargets.map((status) => {
                        const allowed =
                          ORDER_STATUS_MOVES[order.status]?.includes(status) ??
                          false;
                        return (
                          <button
                            key={status}
                            type="button"
                            disabled={!allowed || Boolean(busy)}
                            onClick={() => void setStatus(status)}
                            className="block w-full px-3 py-2.5 text-left text-sm hover:bg-sidebar disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {CUSTOMER_ORDER_STATUS_LABELS[status]}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={!canDelete || Boolean(busy)}
                  onClick={() => setDeleteOpen(true)}
                  className="rounded-lg border border-border px-3 py-2.5 text-sm font-medium hover:bg-sidebar disabled:opacity-40"
                  title={
                    canDelete
                      ? "Delete order"
                      : "Only picking orders can be deleted"
                  }
                >
                  Delete
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 px-5 py-4 text-sm text-muted">
            {error || "Order not found"}
          </div>
        )}
      </aside>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete order?"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Delete the order for{" "}
            <span className="font-medium text-foreground">
              {order?.customerName ?? "this customer"}
            </span>
            ? This cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteOpen(false)}
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy === "delete"}
              onClick={() => void confirmDelete()}
              className="rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy === "delete" ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
