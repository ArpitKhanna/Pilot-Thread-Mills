"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ItemNameCombobox } from "@/components/salesmen/ItemNameCombobox";
import type { PriceListItem } from "@/lib/auth/types";
import {
  CUSTOMER_ORDER_STATUS_LABELS,
  ORDER_LINE_UNIT_LABELS,
  type CustomerOrder,
  type CustomerOrderLineUnit,
  type CustomerOrderStatus,
} from "@/lib/customer-orders/types";
import { formatINR, formatShortDate } from "@/lib/salesmen/mock-data";

type DraftLine = {
  key: string;
  priceListItemId: string | null;
  itemName: string;
  shadeCode: string;
  qty: string;
  unit: CustomerOrderLineUnit;
  isUrgent: boolean;
};

type CustomerOrderSidebarProps = {
  orderId: string | null;
  priceList: PriceListItem[];
  onClose: () => void;
  onOrderChange?: (order: CustomerOrder) => void;
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

function statusTone(status: CustomerOrderStatus): string {
  switch (status) {
    case "picking":
      return "bg-amber-50 text-amber-900";
    case "packed":
      return "bg-sky-50 text-sky-900";
    case "invoiced":
      return "bg-emerald-50 text-emerald-900";
    case "out_for_delivery":
      return "bg-indigo-50 text-indigo-900";
    case "delivered":
      return "bg-teal-50 text-teal-900";
    case "cancelled":
      return "bg-red-50 text-red-800";
    default:
      return "bg-sidebar text-muted";
  }
}

export function CustomerOrderSidebar({
  orderId,
  priceList,
  onClose,
  onOrderChange,
}: CustomerOrderSidebarProps) {
  const router = useRouter();
  const open = Boolean(orderId);
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orderId) {
      setOrder(null);
      setLines([]);
      setError("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
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
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function applyOrder(next: CustomerOrder) {
    setOrder(next);
    setLines(linesFromOrder(next));
    onOrderChange?.(next);
  }

  const locked =
    order != null &&
    (order.status === "invoiced" ||
      order.status === "out_for_delivery" ||
      order.status === "delivered" ||
      order.status === "cancelled");

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
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save lines");
    } finally {
      setBusy("");
    }
  }

  async function setStatus(status: CustomerOrderStatus) {
    if (!order) return;
    setBusy("status");
    setError("");
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
      router.refresh();
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
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update urgency");
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
  const slips =
    order?.attachments.filter((a) => a.kind === "order_slip") ?? [];
  const patches =
    order?.attachments.filter((a) => a.kind === "cloth_patch") ?? [];

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
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3 print:border-0">
          <div className="min-w-0">
            <h2 className="truncate text-base font-medium">
              {loading
                ? "Loading…"
                : (order?.customerName ?? "Order")}
            </h2>
            {order ? (
              <p className="mt-0.5 text-xs text-muted">
                {formatShortDate(order.orderDate)} · {area}
                {order.deliveryByName
                  ? ` · ${order.deliveryByName}`
                  : ""}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted hover:bg-sidebar hover:text-foreground print:hidden"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 print:overflow-visible">
          {error ? (
            <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}

          {loading ? (
            <p className="text-sm text-muted">Loading order…</p>
          ) : order ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${statusTone(order.status)}`}
                >
                  {CUSTOMER_ORDER_STATUS_LABELS[order.status]}
                </span>
                {order.isUrgent ? (
                  <span className="inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
                    Urgent
                  </span>
                ) : null}
                <span className="ml-auto text-sm tabular-nums text-muted">
                  {formatINR(order.amount)}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 print:hidden">
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void toggleUrgent()}
                  className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-sidebar disabled:opacity-50"
                >
                  {order.isUrgent ? "Clear urgent" : "Mark urgent"}
                </button>
                {order.status === "picking" || order.status === "packed" ? (
                  <button
                    type="button"
                    onClick={printPickSheet}
                    className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-sidebar"
                  >
                    Print pick sheet
                  </button>
                ) : null}
                {order.status === "picking" ? (
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => void setStatus("packed")}
                    className="rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-medium text-surface disabled:opacity-50"
                  >
                    Mark packed
                  </button>
                ) : null}
                {order.status === "packed" ? (
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => void setStatus("picking")}
                    className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-sidebar disabled:opacity-50"
                  >
                    Back to picking
                  </button>
                ) : null}
                {order.status === "invoiced" ? (
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => void setStatus("out_for_delivery")}
                    className="rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-medium text-surface disabled:opacity-50"
                  >
                    Out for delivery
                  </button>
                ) : null}
                {order.status === "out_for_delivery" ? (
                  <>
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => void setStatus("invoiced")}
                      className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-sidebar disabled:opacity-50"
                    >
                      Back to invoiced
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => void setStatus("delivered")}
                      className="rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-medium text-surface disabled:opacity-50"
                    >
                      Mark delivered
                    </button>
                  </>
                ) : null}
              </div>

              <section className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium">Lines</h3>
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
                <div className="space-y-2">
                  {lines.map((line) => (
                    <div
                      key={line.key}
                      className="grid gap-1.5 rounded-lg border border-border p-2"
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
                                updateLine(line.key, { qty: e.target.value })
                              }
                              placeholder="Qty"
                              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none"
                            />
                            <select
                              value={line.unit}
                              onChange={(e) =>
                                updateLine(line.key, {
                                  unit: e.target.value as CustomerOrderLineUnit,
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
              </section>

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
      </aside>
    </div>
  );
}
