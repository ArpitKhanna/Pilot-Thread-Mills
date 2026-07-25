"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ItemNameCombobox } from "@/components/salesmen/ItemNameCombobox";
import { InvoicePrintChoiceModal } from "@/components/salesmen/InvoicePrintChoiceModal";
import { Modal } from "@/components/ui/Modal";
import { PendingLink } from "@/components/ui/PendingLink";
import type { PriceListItem } from "@/lib/auth/types";
import {
  CUSTOMER_ORDER_STATUS_LABELS,
  ORDER_LINE_UNIT_LABELS,
  PENDING_ITEM_STATUS_LABELS,
  type CustomerOrder,
  type CustomerOrderEvent,
  type CustomerOrderLineUnit,
  type CustomerOrderStatus,
  type CustomerPendingItem,
} from "@/lib/customer-orders/types";
import {
  formatINR,
  formatShortDate,
  formatShortTime,
} from "@/lib/salesmen/mock-data";
import type { Invoice, Salesman } from "@/lib/salesmen/types";

/** Forward-only next column on the board. */
const NEXT_STATUS: Partial<
  Record<CustomerOrderStatus, CustomerOrderStatus>
> = {
  picking: "packed",
  packed: "invoiced",
  invoiced: "out_for_delivery",
  out_for_delivery: "delivered",
};

type DraftLine = {
  key: string;
  priceListItemId: string | null;
  itemName: string;
  shadeCode: string;
  qty: string;
  unit: CustomerOrderLineUnit;
  isUrgent: boolean;
};

type SidebarTab = "timeline" | "details" | "pending" | "invoices";

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

function fallbackEvents(order: CustomerOrder): CustomerOrderEvent[] {
  const events: CustomerOrderEvent[] = [
    {
      id: `created-${order.id}`,
      orderId: order.id,
      kind: "created",
      message: `Order was created for ${order.customerName ?? "customer"}.`,
      fromStatus: null,
      toStatus: order.status,
      actorId: order.createdBy,
      actorName: null,
      createdAt: order.createdAt,
    },
  ];
  if (order.status !== "picking" && order.status !== "draft") {
    events.push({
      id: `status-${order.id}`,
      orderId: order.id,
      kind: "status_changed",
      message: `Moved to ${CUSTOMER_ORDER_STATUS_LABELS[order.status]}.`,
      fromStatus: null,
      toStatus: order.status,
      actorId: null,
      actorName: null,
      createdAt: order.updatedAt,
    });
  }
  return events.sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex w-full items-baseline justify-between gap-3 text-sm">
      <span className="text-[11px] font-medium tracking-wide text-muted uppercase">
        {label}
      </span>
      <span className="text-right font-medium text-foreground">{value}</span>
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
  const [events, setEvents] = useState<CustomerOrderEvent[]>([]);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<SidebarTab>("timeline");
  const [editingDetails, setEditingDetails] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingItems, setPendingItems] = useState<CustomerPendingItem[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [missingItemName, setMissingItemName] = useState("");
  const [missingPriceListItemId, setMissingPriceListItemId] = useState<
    string | null
  >(null);
  const [missingShade, setMissingShade] = useState("");
  const [missingQty, setMissingQty] = useState("1");
  const [missingUnit, setMissingUnit] =
    useState<CustomerOrderLineUnit>("box");
  const [editingMissingId, setEditingMissingId] = useState<string | null>(null);
  const [editMissingItemName, setEditMissingItemName] = useState("");
  const [editMissingPriceListItemId, setEditMissingPriceListItemId] = useState<
    string | null
  >(null);
  const [editMissingShade, setEditMissingShade] = useState("");
  const [editMissingQty, setEditMissingQty] = useState("1");
  const [editMissingUnit, setEditMissingUnit] =
    useState<CustomerOrderLineUnit>("box");
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState("");
  const [printOpen, setPrintOpen] = useState(false);

  useEffect(() => {
    if (!orderId) {
      setOrder(null);
      setEvents([]);
      setLines([]);
      setError("");
      setTab("timeline");
      setEditingDetails(false);
      setDeleteOpen(false);
      setPendingItems([]);
      setEditingMissingId(null);
      setMissingShade("");
      setMissingQty("1");
      setMissingItemName("");
      setMissingPriceListItemId(null);
      setInvoice(null);
      setInvoiceError("");
      setPrintOpen(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    setTab("timeline");
    setEditingDetails(false);
    setEditingMissingId(null);
    void (async () => {
      try {
        const res = await fetch(`/api/customer-orders/${orderId}`);
        const json = (await res.json()) as {
          order?: CustomerOrder;
          events?: CustomerOrderEvent[];
          error?: string;
        };
        if (!res.ok || !json.order) {
          throw new Error(json.error ?? "Failed to load order");
        }
        if (cancelled) return;
        setOrder(json.order);
        setEvents(json.events ?? []);
        setLines(linesFromOrder(json.order));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load order");
          setOrder(null);
          setEvents([]);
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
        if (deleteOpen) setDeleteOpen(false);
        else onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, deleteOpen]);

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

  useEffect(() => {
    const invoiceId = order?.invoiceId;
    if (!invoiceId) {
      setInvoice(null);
      setInvoiceError("");
      setInvoiceLoading(false);
      return;
    }
    let cancelled = false;
    setInvoiceLoading(true);
    setInvoiceError("");
    void (async () => {
      try {
        const res = await fetch(`/api/salesmen-invoices/${invoiceId}`);
        const json = (await res.json()) as {
          invoice?: Invoice;
          error?: string;
        };
        if (!res.ok || !json.invoice) {
          throw new Error(json.error ?? "Failed to load invoice");
        }
        if (!cancelled) setInvoice(json.invoice);
      } catch (e) {
        if (!cancelled) {
          setInvoice(null);
          setInvoiceError(
            e instanceof Error ? e.message : "Failed to load invoice",
          );
        }
      } finally {
        if (!cancelled) setInvoiceLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [order?.invoiceId]);

  async function addMissingItem() {
    if (!order) return;
    if (!missingShade.trim() || !(Number(missingQty) > 0)) {
      setError("Shade and qty are required");
      return;
    }
    setBusy("missing");
    setError("");
    try {
      const res = await fetch("/api/customer-pending-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: order.customerId,
          items: [
            {
              customerId: order.customerId,
              orderId: order.id,
              priceListItemId: missingPriceListItemId,
              shadeCode: missingShade.trim(),
              qty: Number(missingQty),
              unit: missingUnit,
              isUrgent: order.isUrgent,
            },
          ],
        }),
      });
      const json = (await res.json()) as {
        pending?: CustomerPendingItem[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to save missing item");
      if (json.pending?.length) {
        setPendingItems((prev) => [...json.pending!, ...prev]);
      }
      setMissingShade("");
      setMissingQty("1");
      setMissingItemName("");
      setMissingPriceListItemId(null);
      setMissingUnit("box");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save missing item");
    } finally {
      setBusy("");
    }
  }

  function beginEditMissing(item: CustomerPendingItem) {
    setEditingMissingId(item.id);
    setEditMissingItemName(item.itemName ?? "");
    setEditMissingPriceListItemId(item.priceListItemId);
    setEditMissingShade(item.shadeCode);
    setEditMissingQty(String(item.qty));
    setEditMissingUnit(item.unit);
    setError("");
  }

  function cancelEditMissing() {
    setEditingMissingId(null);
    setError("");
  }

  async function saveEditMissing() {
    if (!editingMissingId) return;
    if (!editMissingShade.trim() || !(Number(editMissingQty) > 0)) {
      setError("Shade and qty are required");
      return;
    }
    setBusy("missing-edit");
    setError("");
    try {
      const res = await fetch(
        `/api/customer-pending-items/${editingMissingId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            priceListItemId: editMissingPriceListItemId,
            shadeCode: editMissingShade.trim(),
            qty: Number(editMissingQty),
            unit: editMissingUnit,
          }),
        },
      );
      const json = (await res.json()) as {
        pending?: CustomerPendingItem;
        error?: string;
      };
      if (!res.ok || !json.pending) {
        throw new Error(json.error ?? "Failed to update missing item");
      }
      setPendingItems((prev) =>
        prev.map((item) =>
          item.id === json.pending!.id ? json.pending! : item,
        ),
      );
      setEditingMissingId(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to update missing item",
      );
    } finally {
      setBusy("");
    }
  }

  async function removeMissingItem(id: string) {
    if (!window.confirm("Remove this missing item?")) return;
    setBusy("missing-delete");
    setError("");
    try {
      const res = await fetch(`/api/customer-pending-items/${id}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to remove item");
      setPendingItems((prev) => prev.filter((item) => item.id !== id));
      if (editingMissingId === id) setEditingMissingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove item");
    } finally {
      setBusy("");
    }
  }

  function applyOrder(
    next: CustomerOrder,
    nextEvents?: CustomerOrderEvent[],
  ) {
    setOrder(next);
    setLines(linesFromOrder(next));
    if (nextEvents) setEvents(nextEvents);
    onOrderChange?.(next);
  }

  const customer = useMemo(
    () =>
      order
        ? (customers.find((c) => c.id === order.customerId) ?? null)
        : null,
    [customers, order],
  );

  const activity = useMemo(() => {
    if (!order) return [];
    if (events.length > 0) return events;
    return fallbackEvents(order);
  }, [order, events]);

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
        .filter(
          (l) =>
            Number(l.qty) > 0 &&
            (l.itemName.trim() || l.priceListItemId || l.shadeCode.trim()),
        )
        .map((l) => ({
          priceListItemId: l.priceListItemId,
          itemName: l.itemName.trim() || null,
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
      setEditingDetails(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save lines");
    } finally {
      setBusy("");
    }
  }

  async function uploadFiles(
    files: FileList | null,
    kind: "order_slip" | "cloth_patch",
  ) {
    if (!order || !files?.length) return;
    setBusy("upload");
    setError("");
    try {
      let latest: CustomerOrder | null = null;
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.set("file", file);
        form.set("kind", kind);
        const res = await fetch(`/api/customer-orders/${order.id}/attachments`, {
          method: "POST",
          body: form,
        });
        const json = (await res.json()) as {
          order?: CustomerOrder;
          error?: string;
        };
        if (!res.ok || !json.order) {
          throw new Error(json.error ?? "Upload failed");
        }
        latest = json.order;
      }
      if (latest) applyOrder(latest);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy("");
    }
  }

  async function removeAttachment(attachmentId: string) {
    if (!order) return;
    setBusy("upload");
    setError("");
    try {
      const res = await fetch(
        `/api/customer-orders/${order.id}/attachments?attachmentId=${attachmentId}`,
        { method: "DELETE" },
      );
      const json = (await res.json()) as {
        order?: CustomerOrder;
        error?: string;
      };
      if (!res.ok || !json.order) {
        throw new Error(json.error ?? "Delete failed");
      }
      applyOrder(json.order);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy("");
    }
  }

  function startEditingDetails() {
    if (!order || locked) return;
    setLines(linesFromOrder(order));
    setEditingDetails(true);
  }

  function cancelEditingDetails() {
    if (order) setLines(linesFromOrder(order));
    setEditingDetails(false);
    setError("");
  }

  async function setStatus(status: CustomerOrderStatus) {
    if (!order) return;
    if (order.status === "packed" && status === "invoiced") {
      onRequestInvoice?.(order.id);
      return;
    }
    if (order.status === "invoiced" && status === "out_for_delivery") {
      onRequestAssignOut?.(order.id);
      return;
    }
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
        events?: CustomerOrderEvent[];
        error?: string;
      };
      if (!res.ok || !json.order) {
        throw new Error(json.error ?? "Failed to update status");
      }
      applyOrder(json.order, json.events);
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
        events?: CustomerOrderEvent[];
        error?: string;
      };
      if (!res.ok || !json.order) {
        throw new Error(json.error ?? "Could not update urgency");
      }
      applyOrder(json.order, json.events);
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

  if (!open) return null;

  const area = order
    ? order.areaSnapshot || order.customerArea || "—"
    : "—";
  const orderTime = order ? formatShortTime(order.createdAt) : "";
  const slips =
    order?.attachments.filter((a) => a.kind === "order_slip") ?? [];
  const patches =
    order?.attachments.filter((a) => a.kind === "cloth_patch") ?? [];
  const filledLines = lines.filter(
    (l) => l.shadeCode.trim() || l.itemName.trim(),
  );
  const showSlips = editingDetails || slips.length > 0;
  const showPatches = editingDetails || patches.length > 0;
  const showManual = editingDetails || filledLines.length > 0;
  const pendingBalance = customer?.pendingBalance ?? null;
  const nextStatus = order ? (NEXT_STATUS[order.status] ?? null) : null;
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
                <h4 className="text-xl font-semibold tracking-tight">
                  {order.customerName ?? "Customer"}
                </h4>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 pt-1">
                  <span
                    className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase ${statusTone(order.status)}`}
                  >
                    {CUSTOMER_ORDER_STATUS_LABELS[order.status]}
                  </span>
                  {order.isUrgent ? (
                    <span className="inline-flex rounded-md bg-orange-50 px-2 py-0.5 text-[11px] font-medium tracking-wide text-orange-900 uppercase">
                      Urgent
                    </span>
                  ) : null}
                </div>
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

              <div className="print:hidden">
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void toggleUrgent()}
                  className="flex w-full items-center justify-center rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-sidebar disabled:opacity-50"
                >
                  {order.isUrgent ? "Clear urgent" : "Mark urgent"}
                </button>
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
                    pendingCount > 0 ? `Missing ${pendingCount}` : "Missing"
                  }
                />
                <TabButton
                  active={tab === "invoices"}
                  onClick={() => setTab("invoices")}
                  label="Invoice"
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
                activity.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted">
                    No activity yet
                  </p>
                ) : (
                  <ol className="relative">
                    {activity.map((event, index) => {
                      const isLast = index === activity.length - 1;
                      const isLatest = index === 0;
                      return (
                        <li
                          key={event.id}
                          className="relative flex gap-3"
                        >
                          <div className="relative flex w-3 shrink-0 flex-col items-center">
                            <span
                              className={`relative z-10 mt-1.5 h-2.5 w-2.5 rounded-full border-2 ${
                                isLatest
                                  ? "border-foreground bg-foreground"
                                  : "border-border bg-surface"
                              }`}
                              aria-hidden
                            />
                            {!isLast ? (
                              <span
                                className="absolute top-4 bottom-0 w-px bg-border"
                                aria-hidden
                              />
                            ) : null}
                          </div>
                          <div
                            className={`min-w-0 flex-1 overflow-hidden rounded-xl border border-border ${
                              isLast ? "" : "mb-3"
                            }`}
                          >
                            <div className="px-3.5 py-3">
                              <p className="text-sm text-foreground">
                                {event.message}
                              </p>
                              <p className="mt-2 text-xs text-muted">
                                {formatRelativeTime(event.createdAt)}
                              </p>
                            </div>
                            {event.actorName ? (
                              <div className="border-t border-border bg-sidebar/40 px-3.5 py-2 text-xs text-muted">
                                By{" "}
                                <span className="font-medium text-sky-700">
                                  @{event.actorName}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )
              ) : null}

              {tab === "invoices" ? (
                <div className="space-y-4">
                  {!order.invoiceId ? (
                    <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
                      <p className="text-sm text-muted">
                        No invoice yet for this order.
                      </p>
                      {order.status === "packed" && onRequestInvoice ? (
                        <button
                          type="button"
                          onClick={() => onRequestInvoice(order.id)}
                          className="mt-3 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-surface"
                        >
                          Generate invoice
                        </button>
                      ) : null}
                    </div>
                  ) : invoiceLoading ? (
                    <p className="py-8 text-center text-sm text-muted">
                      Loading invoice…
                    </p>
                  ) : invoiceError ? (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                      {invoiceError}
                    </p>
                  ) : invoice ? (
                    <>
                      <div className="rounded-xl border border-border px-3.5 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">
                              {invoice.number}
                            </p>
                            <p className="mt-1 text-xs text-muted">
                              {formatShortDate(invoice.issuedAt)}
                              {invoice.itemCount > 0
                                ? ` · ${invoice.itemCount} item${
                                    invoice.itemCount === 1 ? "" : "s"
                                  }`
                                : ""}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-medium tabular-nums">
                            {formatINR(invoice.totalAmount)}
                          </p>
                        </div>
                      </div>

                      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                        {invoice.lineItems.map((line) => (
                          <li
                            key={line.id}
                            className="flex items-start justify-between gap-3 px-3.5 py-2.5 text-sm"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium">{line.name}</p>
                              <p className="mt-0.5 text-xs text-muted">
                                Qty {line.qty}
                                {line.unitPrice > 0
                                  ? ` · ${formatINR(line.unitPrice)}`
                                  : ""}
                              </p>
                            </div>
                            <span className="shrink-0 tabular-nums">
                              {formatINR(line.amount)}
                            </span>
                          </li>
                        ))}
                      </ul>

                      {(invoice.discountAmount ?? 0) > 0 ? (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted">Discount</span>
                          <span className="tabular-nums">
                            −{formatINR(invoice.discountAmount!)}
                          </span>
                        </div>
                      ) : null}

                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => setPrintOpen(true)}
                          className="rounded-lg bg-foreground px-3 py-2.5 text-sm font-medium text-surface"
                        >
                          Print invoice
                        </button>
                        <PendingLink
                          href={`/orders/salesmen/${invoice.id}/edit`}
                          className="inline-flex items-center justify-center rounded-lg border border-border px-3 py-2.5 text-sm font-medium hover:bg-sidebar"
                        >
                          View / edit invoice
                        </PendingLink>
                      </div>
                    </>
                  ) : (
                    <p className="py-8 text-center text-sm text-muted">
                      Invoice not found
                    </p>
                  )}
                </div>
              ) : null}

              {tab === "pending" ? (
                <div className="space-y-4">
                  <section className="space-y-2 rounded-xl border border-border p-3">
                    <h3 className="text-sm font-medium">Add missing item</h3>
                    <p className="text-xs text-muted">
                      Saved to this customer’s profile (Missing tab).
                    </p>
                    <ItemNameCombobox
                      items={priceList}
                      value={missingItemName}
                      onChange={(value) => {
                        setMissingItemName(value);
                        setMissingPriceListItemId(null);
                      }}
                      onSelect={(item) => {
                        setMissingItemName(item.item_name);
                        setMissingPriceListItemId(item.id);
                      }}
                      onTabToQty={() => undefined}
                      showPrice={false}
                      placeholder="Item"
                    />
                    <div className="grid grid-cols-[1fr_0.55fr_0.7fr_auto] gap-1.5">
                      <input
                        value={missingShade}
                        onChange={(e) => setMissingShade(e.target.value)}
                        placeholder="Shade"
                        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none"
                      />
                      <input
                        value={missingQty}
                        onChange={(e) => setMissingQty(e.target.value)}
                        placeholder="Qty"
                        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none"
                      />
                      <select
                        value={missingUnit}
                        onChange={(e) =>
                          setMissingUnit(
                            e.target.value as CustomerOrderLineUnit,
                          )
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
                      <button
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() => void addMissingItem()}
                        className="rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-surface disabled:opacity-50"
                      >
                        {busy === "missing" ? "…" : "Add"}
                      </button>
                    </div>
                  </section>

                  {pendingLoading ? (
                    <p className="text-sm text-muted">Loading missing items…</p>
                  ) : pendingItems.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted">
                      No missing items yet
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {pendingItems.map((item) => {
                        const editing = editingMissingId === item.id;
                        const canEdit =
                          item.status === "open" ||
                          item.status === "in_dyeing" ||
                          item.status === "ready";
                        return (
                          <div
                            key={item.id}
                            className="rounded-xl border border-border px-3.5 py-3"
                          >
                            {editing ? (
                              <div className="space-y-2">
                                <ItemNameCombobox
                                  items={priceList}
                                  value={editMissingItemName}
                                  onChange={(value) => {
                                    setEditMissingItemName(value);
                                    setEditMissingPriceListItemId(null);
                                  }}
                                  onSelect={(row) => {
                                    setEditMissingItemName(row.item_name);
                                    setEditMissingPriceListItemId(row.id);
                                  }}
                                  onTabToQty={() => undefined}
                                  showPrice={false}
                                  placeholder="Item"
                                />
                                <div className="grid grid-cols-[1fr_0.55fr_0.7fr] gap-1.5">
                                  <input
                                    value={editMissingShade}
                                    onChange={(e) =>
                                      setEditMissingShade(e.target.value)
                                    }
                                    placeholder="Shade"
                                    className="rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none"
                                  />
                                  <input
                                    value={editMissingQty}
                                    onChange={(e) =>
                                      setEditMissingQty(e.target.value)
                                    }
                                    placeholder="Qty"
                                    className="rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none"
                                  />
                                  <select
                                    value={editMissingUnit}
                                    onChange={(e) =>
                                      setEditMissingUnit(
                                        e.target
                                          .value as CustomerOrderLineUnit,
                                      )
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
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    disabled={Boolean(busy)}
                                    onClick={cancelEditMissing}
                                    className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-sidebar disabled:opacity-50"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    disabled={Boolean(busy)}
                                    onClick={() => void saveEditMissing()}
                                    className="rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-surface disabled:opacity-50"
                                  >
                                    {busy === "missing-edit"
                                      ? "Saving…"
                                      : "Save"}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <p className="text-sm font-medium">
                                    {item.itemName ?? "Item"} —{" "}
                                    {item.shadeCode}
                                  </p>
                                  <p className="mt-0.5 text-xs text-muted">
                                    {item.qty}{" "}
                                    {ORDER_LINE_UNIT_LABELS[item.unit]}
                                    {item.invoiceDate
                                      ? ` · ${formatShortDate(item.invoiceDate)}`
                                      : ""}
                                    {item.isUrgent ? " · Urgent" : ""}
                                  </p>
                                </div>
                                <div className="flex flex-col items-end gap-1.5">
                                  <span className="text-[11px] font-medium tracking-wide text-muted uppercase">
                                    {PENDING_ITEM_STATUS_LABELS[item.status]}
                                  </span>
                                  {canEdit ? (
                                    <div className="flex gap-1.5">
                                      <button
                                        type="button"
                                        disabled={Boolean(busy)}
                                        onClick={() => beginEditMissing(item)}
                                        className="text-xs font-medium text-muted hover:text-foreground disabled:opacity-50"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        disabled={Boolean(busy)}
                                        onClick={() =>
                                          void removeMissingItem(item.id)
                                        }
                                        className="text-xs font-medium text-red-700 hover:text-red-800 disabled:opacity-50"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}

              {tab === "details" ? (
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm tabular-nums text-muted">
                      {formatINR(order.amount)}
                    </span>
                    {!locked ? (
                      editingDetails ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={Boolean(busy)}
                            onClick={cancelEditingDetails}
                            className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-sidebar disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(busy)}
                            onClick={() => void saveLines()}
                            className="rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-medium text-surface disabled:opacity-50"
                          >
                            {busy === "lines" ? "Saving…" : "Save"}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={Boolean(busy)}
                          onClick={startEditingDetails}
                          className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-sidebar disabled:opacity-50"
                        >
                          Edit
                        </button>
                      )
                    ) : null}
                  </div>

                  {!showSlips && !showPatches && !showManual ? (
                    <div className="space-y-3 py-6 text-center">
                      <p className="text-sm text-muted">No order details yet</p>
                      {!locked ? (
                        <button
                          type="button"
                          onClick={startEditingDetails}
                          className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
                        >
                          Add details
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  {showSlips ? (
                    <section className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-medium">Order slips</h3>
                        {editingDetails ? (
                          <label className="cursor-pointer rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-sidebar">
                            {busy === "upload" ? "Uploading…" : "Upload"}
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              multiple
                              className="hidden"
                              disabled={Boolean(busy)}
                              onChange={(e) => {
                                void uploadFiles(e.target.files, "order_slip");
                                e.target.value = "";
                              }}
                            />
                          </label>
                        ) : null}
                      </div>
                      {slips.length === 0 ? (
                        <p className="text-xs text-muted">No slips uploaded</p>
                      ) : (
                        <ul className="grid gap-2 sm:grid-cols-2">
                          {slips.map((slip) => (
                            <li
                              key={slip.id}
                              className="rounded-xl border border-border p-2"
                            >
                              {slip.signedUrl &&
                              slip.contentType?.startsWith("image/") ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={slip.signedUrl}
                                  alt={slip.fileName ?? "Order slip"}
                                  className="mb-2 max-h-36 w-full rounded-md bg-sidebar object-contain"
                                />
                              ) : (
                                <p className="mb-2 text-sm">
                                  {slip.fileName ?? "File"}
                                </p>
                              )}
                              {editingDetails ? (
                                <button
                                  type="button"
                                  disabled={Boolean(busy)}
                                  onClick={() =>
                                    void removeAttachment(slip.id)
                                  }
                                  className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-50"
                                >
                                  Remove
                                </button>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  ) : null}

                  {showPatches ? (
                    <section className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-medium">Cloth patches</h3>
                        {editingDetails ? (
                          <label className="cursor-pointer rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-sidebar">
                            {busy === "upload" ? "Uploading…" : "Upload"}
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              disabled={Boolean(busy)}
                              onChange={(e) => {
                                void uploadFiles(e.target.files, "cloth_patch");
                                e.target.value = "";
                              }}
                            />
                          </label>
                        ) : null}
                      </div>
                      {patches.length === 0 ? (
                        <p className="text-xs text-muted">No patches uploaded</p>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          {patches.map((patch) => (
                            <div
                              key={patch.id}
                              className="rounded-xl border border-border p-1"
                            >
                              {patch.signedUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={patch.signedUrl}
                                  alt={patch.fileName ?? "Cloth patch"}
                                  className="mb-1 h-20 w-full rounded object-cover"
                                />
                              ) : (
                                <p className="p-1 text-xs">
                                  {patch.fileName}
                                </p>
                              )}
                              {editingDetails ? (
                                <button
                                  type="button"
                                  disabled={Boolean(busy)}
                                  onClick={() =>
                                    void removeAttachment(patch.id)
                                  }
                                  className="w-full rounded-md border border-border px-1 py-0.5 text-[10px] disabled:opacity-50"
                                >
                                  Remove
                                </button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  ) : null}

                  {showManual ? (
                    <section className="space-y-2">
                      <h3 className="text-sm font-medium">Manual entry</h3>
                      <div className="space-y-2">
                        {(editingDetails ? lines : filledLines).map((line) => (
                          <div
                            key={line.key}
                            className="grid gap-1.5 rounded-xl border border-border p-3"
                          >
                            {editingDetails ? (
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
                                <div className="grid grid-cols-[1fr_0.55fr_0.7fr_auto] gap-1.5">
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
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setLines((prev) =>
                                        prev.length <= 1
                                          ? prev
                                          : prev.filter(
                                              (l) => l.key !== line.key,
                                            ),
                                      )
                                    }
                                    className="rounded-md border border-border px-2 py-1 text-xs text-red-700"
                                  >
                                    ×
                                  </button>
                                </div>
                              </>
                            ) : (
                              <div className="text-sm">
                                <div className="font-medium">
                                  {line.itemName || "Item"}
                                  {line.shadeCode
                                    ? ` · ${line.shadeCode}`
                                    : ""}
                                </div>
                                <div className="text-xs text-muted">
                                  {line.qty}{" "}
                                  {ORDER_LINE_UNIT_LABELS[line.unit]}
                                  {line.isUrgent ? " · Urgent" : ""}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        {editingDetails ? (
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
                            className="text-xs font-medium text-muted hover:text-foreground"
                          >
                            + Add items
                          </button>
                        ) : null}
                      </div>
                    </section>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="shrink-0 border-t border-border px-5 py-3 print:hidden">
              <div className="flex gap-2">
                {nextStatus ? (
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => void setStatus(nextStatus)}
                    className="min-w-0 flex-1 rounded-lg bg-foreground px-3 py-2.5 text-sm font-medium text-surface disabled:opacity-50"
                  >
                    {busy === "status"
                      ? "Updating…"
                      : `Move to ${CUSTOMER_ORDER_STATUS_LABELS[nextStatus]}`}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={!canDelete || Boolean(busy)}
                  onClick={() => setDeleteOpen(true)}
                  className={`rounded-lg border border-red-200 px-3 py-2.5 text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-40 ${
                    nextStatus ? "" : "flex-1"
                  }`}
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
              className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-50"
            >
              {busy === "delete" ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </Modal>

      <InvoicePrintChoiceModal
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        invoice={invoice}
        party={
          customer ??
          (order
            ? {
                id: order.customerId ?? "unknown",
                name: order.customerName ?? "Customer",
                phone: "",
                alternatePhone: "",
                entityType: "customer",
                isActive: true,
                openingBalance: 0,
                pendingBalance: 0,
                lastInvoiceAt: null,
                discountRules: [],
                marketDay: "",
                area: order.customerArea ?? order.areaSnapshot ?? "",
                isDefaulter: false,
                tier: "",
                balanceThreshold: null,
                contactName: "",
                addressBuilding: "",
                addressArea: "",
                addressCity: "",
                addressState: "",
                addressPincode: "",
                mapLat: null,
                mapLng: null,
                tierRubric: {
                  orderFrequency: null,
                  orderAmount: null,
                  paymentAmount: null,
                  paymentSpeed: null,
                },
                priceRules: [],
              }
            : null)
        }
        previousBalance={customer?.pendingBalance}
        title="Print invoice"
        description="Choose how the copy should look, then print. The preview updates live."
      />
    </div>
  );
}
