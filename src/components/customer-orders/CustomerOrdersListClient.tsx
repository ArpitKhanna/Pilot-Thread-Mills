"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppContext } from "@/app/(app)/layout";
import {
  CustomerOrderInvoiceModal,
  type CustomerOrderInvoiceCreated,
  type CustomerOrderInvoiceSubmitPayload,
} from "@/components/customer-orders/CustomerOrderInvoiceModal";
import { NewCustomerOrderModal } from "@/components/customer-orders/NewCustomerOrderModal";
import { CustomerOrderSidebar } from "@/components/customer-orders/CustomerOrderSidebar";
import { TopBar } from "@/components/layout/AppShell";
import { ItemNameCombobox } from "@/components/salesmen/ItemNameCombobox";
import { Modal } from "@/components/ui/Modal";
import type { PriceListItem } from "@/lib/auth/types";
import {
  CUSTOMER_ORDER_STATUS_LABELS,
  KANBAN_COLUMNS,
  ORDER_LINE_UNIT_LABELS,
  type CustomerOrder,
  type CustomerOrderLineUnit,
  type CustomerOrderStatus,
  type DeliveryStaff,
} from "@/lib/customer-orders/types";
import { formatShortDate, formatShortTime } from "@/lib/salesmen/mock-data";
import { useSyncedState } from "@/lib/realtime/use-synced-state";
import {
  MARKET_DAY_LABELS,
  type Invoice,
  type MarketDay,
  type Salesman,
} from "@/lib/salesmen/types";

/** Direct status drops (no modal). Special cases: packed→invoiced, invoiced→out. */
const DIRECT_DROP_TARGET: Partial<
  Record<CustomerOrderStatus, CustomerOrderStatus[]>
> = {
  picking: ["packed"],
  packed: ["picking"],
  out_for_delivery: ["invoiced", "delivered"],
};

type CustomerOrdersListClientProps = {
  context: AppContext;
  initialOrders: CustomerOrder[];
  customers: Salesman[];
  priceList: PriceListItem[];
  deliveryStaff: DeliveryStaff[];
};

const WEEKDAY_TO_MARKET: Record<number, MarketDay> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

const BULK_TARGET: Partial<Record<CustomerOrderStatus, CustomerOrderStatus>> = {
  picking: "packed",
  invoiced: "out_for_delivery",
  out_for_delivery: "delivered",
};

const BULK_LABEL: Partial<Record<CustomerOrderStatus, string>> = {
  picking: "Mark packed",
  packed: "Generate invoices",
  invoiced: "Mark out for delivery",
  out_for_delivery: "Mark delivered",
};

const BULK_BACK_TARGET: Partial<
  Record<CustomerOrderStatus, CustomerOrderStatus>
> = {
  packed: "picking",
  out_for_delivery: "invoiced",
};

const BULK_BACK_LABEL: Partial<Record<CustomerOrderStatus, string>> = {
  packed: "Back to picking",
  out_for_delivery: "Back to invoiced",
};

type MissingDraft = {
  key: string;
  customerId: string;
  priceListItemId: string | null;
  itemName: string;
  shadeCode: string;
  qty: string;
  unit: CustomerOrderLineUnit;
};

function todayLocalDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function emptyMissingLine(customerId = ""): MissingDraft {
  return {
    key: crypto.randomUUID(),
    customerId,
    priceListItemId: null,
    itemName: "",
    shadeCode: "",
    qty: "1",
    unit: "box",
  };
}

type SortBy = "order_time_desc" | "order_time_asc";

function sortOrders(a: CustomerOrder, b: CustomerOrder, sortBy: SortBy): number {
  if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
  const timeA = a.createdAt || a.orderDate;
  const timeB = b.createdAt || b.orderDate;
  const cmp = timeA.localeCompare(timeB);
  return sortBy === "order_time_asc" ? cmp : -cmp;
}

export function CustomerOrdersListClient({
  context,
  initialOrders,
  customers,
  priceList,
  deliveryStaff,
}: CustomerOrdersListClientProps) {
  const router = useRouter();
  const [dateFilter, setDateFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortBy>("order_time_desc");
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [initialCustomerId, setInitialCustomerId] = useState<
    string | undefined
  >();
  const [selectColumn, setSelectColumn] = useState<CustomerOrderStatus | null>(
    null,
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [runOpen, setRunOpen] = useState(false);
  const [runBusy, setRunBusy] = useState(false);
  const [runError, setRunError] = useState("");
  const [invoiceOrders, setInvoiceOrders] = useState<CustomerOrder[]>([]);
  const [outOpen, setOutOpen] = useState(false);
  const [outDeliveryBy, setOutDeliveryBy] = useState("");
  const [outBusy, setOutBusy] = useState(false);
  const [outError, setOutError] = useState("");
  const [actionOrderIds, setActionOrderIds] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<CustomerOrderStatus | null>(
    null,
  );
  const suppressCardClickRef = useRef(false);
  const [missingOpen, setMissingOpen] = useState(false);
  const [missingDate, setMissingDate] = useState(todayLocalDate);
  const [missingLines, setMissingLines] = useState<MissingDraft[]>([
    emptyMissingLine(),
  ]);
  const [missingBusy, setMissingBusy] = useState(false);
  const [missingError, setMissingError] = useState("");
  const [whatsappUrls, setWhatsappUrls] = useState<
    Array<{ customerName: string; url: string }>
  >([]);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);

  const pauseOrdersSync =
    Boolean(draggingId) ||
    bulkBusy ||
    runBusy ||
    outBusy ||
    missingBusy ||
    invoiceOrders.length > 0;
  const [orders, setOrders] = useSyncedState(initialOrders, !pauseOrdersSync);

  const actionOrders = useMemo(
    () => orders.filter((o) => actionOrderIds.includes(o.id)),
    [orders, actionOrderIds],
  );

  const areas = useMemo(() => {
    const set = new Set<string>();
    for (const order of orders) {
      const area = (order.areaSnapshot || order.customerArea || "").trim();
      if (area) set.add(area);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [orders]);

  const todayMarket = WEEKDAY_TO_MARKET[new Date().getDay()]!;
  const marketCustomers = useMemo(
    () => customers.filter((c) => c.isActive && c.marketDay === todayMarket),
    [customers, todayMarket],
  );

  const filtered = useMemo(() => {
    return orders.filter((order) => {
      if (dateFilter && order.orderDate.slice(0, 10) !== dateFilter) {
        return false;
      }
      const area = (order.areaSnapshot || order.customerArea || "").trim();
      if (areaFilter !== "all" && area !== areaFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase().trim();
      return (
        (order.customerName ?? "").toLowerCase().includes(q) ||
        area.toLowerCase().includes(q) ||
        order.id.toLowerCase().includes(q)
      );
    });
  }, [orders, dateFilter, areaFilter, search]);

  const columns = useMemo(() => {
    const map = Object.fromEntries(
      KANBAN_COLUMNS.map((status) => [status, [] as CustomerOrder[]]),
    ) as Record<(typeof KANBAN_COLUMNS)[number], CustomerOrder[]>;
    for (const order of filtered) {
      if (order.status in map) {
        map[order.status as (typeof KANBAN_COLUMNS)[number]].push(order);
      }
    }
    for (const status of KANBAN_COLUMNS) {
      map[status].sort((a, b) => sortOrders(a, b, sortBy));
    }
    return map;
  }, [filtered, sortBy]);

  const selectedOrders = useMemo(
    () =>
      filtered.filter(
        (o) =>
          selected.has(o.id) &&
          selectColumn != null &&
          o.status === selectColumn,
      ),
    [filtered, selected, selectColumn],
  );

  function toggleSelect(column: CustomerOrderStatus, id: string) {
    if (selectColumn !== column) {
      setSelectColumn(column);
      setSelected(new Set([id]));
      return;
    }
    setSelected((ids) => {
      const next = new Set(ids);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) setSelectColumn(null);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
    setSelectColumn(null);
    setBulkError("");
  }

  function openNewOrder(customerId?: string) {
    setInitialCustomerId(customerId);
    setNewOpen(true);
  }

  function applyLocalStatus(
    ids: string[],
    status: CustomerOrderStatus,
    extras?: Partial<Pick<CustomerOrder, "deliveryBy" | "deliveryByName">>,
  ) {
    const idSet = new Set(ids);
    setOrders((prev) =>
      prev.map((o) =>
        idSet.has(o.id)
          ? {
              ...o,
              status,
              ...(extras?.deliveryBy !== undefined
                ? { deliveryBy: extras.deliveryBy }
                : {}),
              ...(extras?.deliveryByName !== undefined
                ? { deliveryByName: extras.deliveryByName }
                : {}),
            }
          : o,
      ),
    );
  }

  function snapshotStatuses(ids: string[]) {
    const idSet = new Set(ids);
    return orders
      .filter((o) => idSet.has(o.id))
      .map((o) => ({
        id: o.id,
        status: o.status,
        deliveryBy: o.deliveryBy,
        deliveryByName: o.deliveryByName,
      }));
  }

  function restoreSnapshots(
    snapshots: Array<{
      id: string;
      status: CustomerOrderStatus;
      deliveryBy: string | null;
      deliveryByName: string | null;
    }>,
  ) {
    const byId = new Map(snapshots.map((s) => [s.id, s]));
    setOrders((prev) =>
      prev.map((o) => {
        const snap = byId.get(o.id);
        return snap
          ? {
              ...o,
              status: snap.status,
              deliveryBy: snap.deliveryBy,
              deliveryByName: snap.deliveryByName,
            }
          : o;
      }),
    );
  }

  async function patchStatuses(
    ids: string[],
    status: CustomerOrderStatus,
    extras?: { deliveryBy?: string | null },
  ): Promise<void> {
    const results = await Promise.all(
      ids.map(async (id) => {
        const res = await fetch(`/api/customer-orders/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            ...(extras?.deliveryBy !== undefined
              ? { deliveryBy: extras.deliveryBy }
              : {}),
          }),
        });
        const json = (await res.json()) as {
          error?: string;
          order?: CustomerOrder;
        };
        if (!res.ok) throw new Error(json.error ?? "Failed to update order");
        return json.order;
      }),
    );
    const byId = new Map(
      results.filter(Boolean).map((o) => [o!.id, o!] as const),
    );
    if (byId.size === 0) return;
    setOrders((prev) =>
      prev.map((o) => {
        const next = byId.get(o.id);
        return next ? { ...o, ...next } : o;
      }),
    );
  }

  async function submitBulkStatus(targetOverride?: CustomerOrderStatus) {
    if (!selectColumn || selectedOrders.length === 0) return;
    const target = targetOverride ?? BULK_TARGET[selectColumn];
    if (!target) return;
    if (selectColumn === "invoiced" && target === "out_for_delivery") {
      openAssignOutModal(selectedOrders.map((o) => o.id));
      return;
    }
    const ids = selectedOrders.map((o) => o.id);
    const snapshots = snapshotStatuses(ids);
    setBulkError("");
    applyLocalStatus(ids, target);
    clearSelection();
    setBulkBusy(true);
    try {
      await patchStatuses(ids, target);
    } catch (e) {
      restoreSnapshots(snapshots);
      setBulkError(e instanceof Error ? e.message : "Bulk update failed");
    } finally {
      setBulkBusy(false);
    }
  }

  function openInvoiceModal(ids: string[]) {
    setActionOrderIds(ids);
    setRunError("");
    setInvoiceOrders(
      orders.filter((o) => ids.includes(o.id) && o.status === "packed"),
    );
    setRunOpen(true);
  }

  function openAssignOutModal(ids: string[]) {
    setActionOrderIds(ids);
    setOutError("");
    setOutDeliveryBy("");
    setOutOpen(true);
  }

  function idsForDrag(order: CustomerOrder): string[] {
    if (
      selectColumn === order.status &&
      selected.has(order.id) &&
      selected.size > 0
    ) {
      return [...selected];
    }
    return [order.id];
  }

  function canDropOnColumn(
    from: CustomerOrderStatus,
    to: CustomerOrderStatus,
  ): boolean {
    if (from === to) return false;
    if (from === "packed" && to === "invoiced") return true;
    if (from === "invoiced" && to === "out_for_delivery") return true;
    return DIRECT_DROP_TARGET[from]?.includes(to) ?? false;
  }

  async function handleDropOnColumn(
    toStatus: CustomerOrderStatus,
    orderId: string,
  ) {
    const order = orders.find((o) => o.id === orderId);
    if (!order || !canDropOnColumn(order.status, toStatus)) return;

    const ids = idsForDrag(order).filter((id) => {
      const o = orders.find((x) => x.id === id);
      return o != null && o.status === order.status;
    });
    if (ids.length === 0) return;

    if (order.status === "packed" && toStatus === "invoiced") {
      openInvoiceModal(ids);
      return;
    }
    if (order.status === "invoiced" && toStatus === "out_for_delivery") {
      openAssignOutModal(ids);
      return;
    }

    const snapshots = snapshotStatuses(ids);
    setBulkError("");
    applyLocalStatus(ids, toStatus);
    clearSelection();
    try {
      await patchStatuses(ids, toStatus);
    } catch (e) {
      restoreSnapshots(snapshots);
      setBulkError(e instanceof Error ? e.message : "Could not move order");
    }
  }

  async function submitBulkDelete() {
    if (selectColumn !== "picking" || selectedOrders.length === 0) return;
    if (
      !window.confirm(
        `Delete ${selectedOrders.length} picking order${selectedOrders.length === 1 ? "" : "s"}? This cannot be undone.`,
      )
    ) {
      return;
    }
    setBulkBusy(true);
    setBulkError("");
    try {
      const ids = selectedOrders.map((o) => o.id);
      for (const id of ids) {
        const res = await fetch(`/api/customer-orders/${id}`, {
          method: "DELETE",
        });
        const json = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(json.error ?? "Failed to delete order");
      }
      setOrders((prev) => prev.filter((o) => !ids.includes(o.id)));
      clearSelection();
      router.refresh();
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : "Failed to delete orders");
    } finally {
      setBulkBusy(false);
    }
  }

  async function submitInvoices(
    payload: CustomerOrderInvoiceSubmitPayload,
  ): Promise<CustomerOrderInvoiceCreated[]> {
    if (payload.orderIds.length === 0) {
      throw new Error("Select at least one packed order");
    }
    setRunBusy(true);
    setRunError("");
    try {
      const created: CustomerOrderInvoiceCreated[] = [];
      for (const id of payload.orderIds) {
        const options = payload.invoicesByOrder[id];
        const order =
          invoiceOrders.find((o) => o.id === id) ??
          orders.find((o) => o.id === id);
        const res = await fetch(`/api/customer-orders/${id}/convert-invoice`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            discountAmount: options?.discountAmount ?? 0,
            paymentEntries: options?.paymentEntries ?? [],
            lineQtyOverrides: options?.lineQtyOverrides,
            lineUnitPriceOverrides: options?.lineUnitPriceOverrides,
          }),
        });
        const json = (await res.json()) as {
          invoice?: Invoice;
          error?: string;
        };
        if (!res.ok || !json.invoice) {
          throw new Error(json.error ?? "Failed to generate invoice");
        }
        created.push({
          invoice: json.invoice,
          customerId: order?.customerId ?? json.invoice.salesmanId,
          orderId: id,
        });
      }
      applyLocalStatus(payload.orderIds, "invoiced");
      clearSelection();
      router.refresh();
      return created;
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to generate invoice";
      setRunError(message);
      throw e instanceof Error ? e : new Error(message);
    } finally {
      setRunBusy(false);
    }
  }

  async function submitAssignOut() {
    const invoiced = actionOrders.filter((o) => o.status === "invoiced");
    if (invoiced.length === 0) {
      setOutError("Select at least one invoiced order");
      return;
    }
    if (!outDeliveryBy) {
      setOutError("Select a delivery person");
      return;
    }
    const ids = invoiced.map((o) => o.id);
    const assignedTo = outDeliveryBy;
    const snapshots = snapshotStatuses(ids);
    const person = deliveryStaff.find((p) => p.id === assignedTo);
    setOutError("");
    applyLocalStatus(ids, "out_for_delivery", {
      deliveryBy: assignedTo,
      deliveryByName: person?.fullName ?? null,
    });
    setOutOpen(false);
    setOutDeliveryBy("");
    setActionOrderIds([]);
    clearSelection();
    setOutBusy(true);
    try {
      await patchStatuses(ids, "out_for_delivery", {
        deliveryBy: assignedTo,
      });
    } catch (e) {
      restoreSnapshots(snapshots);
      setOutError(
        e instanceof Error ? e.message : "Could not mark out for delivery",
      );
      setOutOpen(true);
      setActionOrderIds(ids);
      setOutDeliveryBy(assignedTo);
    } finally {
      setOutBusy(false);
    }
  }

  async function submitMissing() {
    const items = missingLines
      .filter(
        (l) =>
          l.customerId &&
          l.shadeCode.trim() &&
          Number(l.qty) > 0,
      )
      .map((l) => ({
        customerId: l.customerId,
        priceListItemId: l.priceListItemId,
        shadeCode: l.shadeCode.trim(),
        qty: Number(l.qty),
        unit: l.unit,
        invoiceDate: missingDate,
      }));
    if (items.length === 0) {
      setMissingError("Add at least one line with customer, shade, and qty");
      return;
    }
    setMissingBusy(true);
    setMissingError("");
    setWhatsappUrls([]);
    try {
      const res = await fetch("/api/customer-pending-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceDate: missingDate,
          items,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        whatsappUrls?: Array<{ customerName: string; url: string }>;
        whatsappUrl?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      if (json.whatsappUrls?.length) {
        setWhatsappUrls(json.whatsappUrls);
      } else if (json.whatsappUrl) {
        setWhatsappUrls([{ customerName: "Customer", url: json.whatsappUrl }]);
      }
      setMissingLines([emptyMissingLine()]);
      router.refresh();
    } catch (e) {
      setMissingError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setMissingBusy(false);
    }
  }

  const bulkLabel =
    selectColumn != null ? BULK_LABEL[selectColumn] : undefined;
  const bulkBackLabel =
    selectColumn != null ? BULK_BACK_LABEL[selectColumn] : undefined;
  const bulkBackTarget =
    selectColumn != null ? BULK_BACK_TARGET[selectColumn] : undefined;

  return (
    <>
      <TopBar
        context={context}
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Orders" },
          { label: "Customers" },
        ]}
      />

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <div className="mb-5 flex shrink-0 flex-col gap-4 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-medium tracking-tight sm:text-2xl">
              Customer Orders
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setWhatsappUrls([]);
                setMissingError("");
                setMissingLines([emptyMissingLine()]);
                setMissingOpen(true);
              }}
              className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm font-medium hover:bg-sidebar"
            >
              Report Missing Items
            </button>
            <button
              type="button"
              onClick={() => openNewOrder()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-surface hover:bg-foreground/90"
            >
              <span className="text-lg leading-none">+</span>
              New Order
            </button>
          </div>
        </div>

        {marketCustomers.length > 0 ? (
          <section className="mb-5 shrink-0 rounded-xl border border-border bg-surface p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium">
                Daily market call list · {MARKET_DAY_LABELS[todayMarket]}
              </h2>
              <span className="text-xs text-muted">
                {marketCustomers.length} customers
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {marketCustomers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openNewOrder(c.id)}
                  className="rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-sidebar"
                >
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted">
                    {c.phone || "No phone"} · New order
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <div className="mb-4 flex shrink-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 sm:w-auto">
            <span className="shrink-0 text-xs font-medium text-muted">Date</span>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none sm:w-36"
            />
            {dateFilter ? (
              <button
                type="button"
                onClick={() => setDateFilter("")}
                className="text-xs text-muted hover:text-foreground"
              >
                Clear
              </button>
            ) : null}
          </label>

          <label className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 sm:w-auto">
            <span className="shrink-0 text-xs font-medium text-muted">Area</span>
            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none sm:w-40"
            >
              <option value="all">All areas</option>
              {areas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </label>

          <label className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 sm:w-auto">
            <span className="shrink-0 text-xs font-medium text-muted">
              Sort by
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none sm:w-44"
            >
              <option value="order_time_desc">Order time (newest)</option>
              <option value="order_time_asc">Order time (oldest)</option>
            </select>
          </label>

          <div className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 sm:ml-auto sm:max-w-xs sm:py-2">
            <input
              type="search"
              placeholder="Search customer or area"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-x-auto pb-2">
          <div className="flex h-full min-w-max gap-3">
            {KANBAN_COLUMNS.map((status) => {
              const columnOrders = columns[status];
              const selectable = status !== "delivered";
              const dragFrom = draggingId
                ? orders.find((o) => o.id === draggingId)?.status
                : null;
              const dropActive =
                dragOverColumn === status &&
                dragFrom != null &&
                canDropOnColumn(dragFrom, status);
              return (
                <section
                  key={status}
                  className={`flex h-full max-h-full w-[280px] shrink-0 flex-col rounded-xl border bg-sidebar/40 ${
                    dropActive
                      ? "border-foreground ring-2 ring-foreground/15"
                      : "border-border"
                  }`}
                >
                  <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
                    <h2 className="text-sm font-medium">
                      {CUSTOMER_ORDER_STATUS_LABELS[status]}
                    </h2>
                    <span className="rounded-md bg-surface px-1.5 py-0.5 text-xs tabular-nums text-muted">
                      {columnOrders.length}
                    </span>
                  </header>
                  <div
                    className="flex-1 space-y-2 overflow-y-auto p-2"
                    onDragOver={(e) => {
                      if (!dragFrom || !canDropOnColumn(dragFrom, status)) {
                        return;
                      }
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (dragOverColumn !== status) {
                        setDragOverColumn(status);
                      }
                    }}
                    onDragLeave={(e) => {
                      if (
                        e.currentTarget.contains(e.relatedTarget as Node | null)
                      ) {
                        return;
                      }
                      if (dragOverColumn === status) setDragOverColumn(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id =
                        e.dataTransfer.getData("text/plain") || draggingId;
                      setDragOverColumn(null);
                      setDraggingId(null);
                      if (id) void handleDropOnColumn(status, id);
                    }}
                  >
                    {columnOrders.length === 0 ? (
                      <p className="px-2 py-6 text-center text-xs text-muted">
                        {dropActive ? "Drop here" : "No orders"}
                      </p>
                    ) : (
                      columnOrders.map((order) => {
                        const area =
                          order.areaSnapshot || order.customerArea || "—";
                        const checked = selected.has(order.id);
                        const orderTime = formatShortTime(order.createdAt);
                        const isDragging = draggingId === order.id;
                        return (
                          <article
                            key={order.id}
                            draggable={status !== "delivered"}
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/plain", order.id);
                              e.dataTransfer.effectAllowed = "move";
                              setDraggingId(order.id);
                            }}
                            onDragEnd={() => {
                              setDraggingId(null);
                              setDragOverColumn(null);
                              suppressCardClickRef.current = true;
                              window.setTimeout(() => {
                                suppressCardClickRef.current = false;
                              }, 0);
                            }}
                            className={`cursor-grab rounded-lg border border-border bg-surface p-3 shadow-sm active:cursor-grabbing ${
                              checked || detailOrderId === order.id
                                ? "ring-2 ring-foreground/20"
                                : ""
                            } ${isDragging ? "opacity-40" : ""}`}
                            onClick={() => {
                              if (suppressCardClickRef.current) return;
                              setDetailOrderId(order.id);
                            }}
                          >
                            <div className="flex items-start gap-2">
                              {selectable ? (
                                <input
                                  type="checkbox"
                                  className="mt-1"
                                  checked={checked}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={() =>
                                    toggleSelect(status, order.id)
                                  }
                                  aria-label={`Select ${order.customerName}`}
                                />
                              ) : null}
                              <div className="min-w-0 flex-1">
                                <div className="font-medium">
                                  {order.customerName ?? "Customer"}
                                </div>
                                {order.isUrgent ? (
                                  <span className="mt-1 inline-flex rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                                    Urgent
                                  </span>
                                ) : null}
                                <div className="mt-1 text-xs text-muted">
                                  {area}
                                </div>
                                <div className="text-xs text-muted">
                                  {formatShortDate(order.orderDate)}
                                  {orderTime ? ` · ${orderTime}` : ""}
                                </div>
                              </div>
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        <div className="mt-3 flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5">
          <span className="text-sm text-muted">
            {selectedOrders.length > 0 && selectColumn
              ? `${selectedOrders.length} selected in ${CUSTOMER_ORDER_STATUS_LABELS[selectColumn]}`
              : "Select orders in a column to act on them"}
          </span>
          {bulkError ? (
            <span className="text-sm text-red-700">{bulkError}</span>
          ) : null}
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              type="button"
              disabled={selectedOrders.length === 0}
              onClick={clearSelection}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium disabled:opacity-40"
            >
              Clear
            </button>
            {selectColumn === "packed" ? (
              <>
                <button
                  type="button"
                  disabled={bulkBusy || selectedOrders.length === 0}
                  onClick={() => void submitBulkStatus(bulkBackTarget)}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium disabled:opacity-40"
                >
                  {bulkBusy ? "Updating…" : (bulkBackLabel ?? "Back to picking")}
                </button>
                <button
                  type="button"
                  disabled={selectedOrders.length === 0}
                  onClick={() =>
                    openInvoiceModal(selectedOrders.map((o) => o.id))
                  }
                  className="rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-surface disabled:opacity-40"
                >
                  {bulkLabel ?? "Generate invoices"}
                </button>
              </>
            ) : selectColumn === "picking" ? (
              <>
                <button
                  type="button"
                  disabled={bulkBusy || selectedOrders.length === 0}
                  onClick={() => void submitBulkDelete()}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-40"
                >
                  {bulkBusy ? "Deleting…" : "Delete"}
                </button>
                <button
                  type="button"
                  disabled={bulkBusy || selectedOrders.length === 0}
                  onClick={() => void submitBulkStatus()}
                  className="rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-surface disabled:opacity-40"
                >
                  {bulkBusy ? "Updating…" : "Mark packed"}
                </button>
              </>
            ) : selectColumn === "out_for_delivery" ? (
              <>
                <button
                  type="button"
                  disabled={bulkBusy || selectedOrders.length === 0}
                  onClick={() => void submitBulkStatus(bulkBackTarget)}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium disabled:opacity-40"
                >
                  {bulkBusy
                    ? "Updating…"
                    : (bulkBackLabel ?? "Back to invoiced")}
                </button>
                <button
                  type="button"
                  disabled={bulkBusy || selectedOrders.length === 0}
                  onClick={() => void submitBulkStatus()}
                  className="rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-surface disabled:opacity-40"
                >
                  {bulkBusy ? "Updating…" : "Mark delivered"}
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={
                  bulkBusy ||
                  selectedOrders.length === 0 ||
                  !bulkLabel ||
                  selectColumn === "delivered"
                }
                onClick={() => void submitBulkStatus()}
                className="rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-surface disabled:opacity-40"
              >
                {bulkBusy
                  ? "Updating…"
                  : (bulkLabel ?? "Mark packed")}
              </button>
            )}
          </div>
        </div>
      </main>

      <CustomerOrderSidebar
        orderId={detailOrderId}
        priceList={priceList}
        customers={customers}
        onClose={() => setDetailOrderId(null)}
        onOrderChange={(updated) => {
          setOrders((prev) =>
            prev.map((o) =>
              o.id === updated.id
                ? {
                    ...o,
                    ...updated,
                    lineCount:
                      updated.lines.length ||
                      updated.lineCount ||
                      o.lineCount,
                    amount: updated.amount || o.amount,
                  }
                : o,
            ),
          );
        }}
        onDeleted={(id) => {
          setOrders((prev) => prev.filter((o) => o.id !== id));
          setDetailOrderId(null);
        }}
        onRequestInvoice={(id) => {
          setDetailOrderId(null);
          openInvoiceModal([id]);
        }}
        onRequestAssignOut={(id) => {
          setDetailOrderId(null);
          openAssignOutModal([id]);
        }}
      />

      <NewCustomerOrderModal
        open={newOpen}
        onClose={() => {
          setNewOpen(false);
          setInitialCustomerId(undefined);
        }}
        customers={customers}
        priceList={priceList}
        initialCustomerId={initialCustomerId}
      />

      <CustomerOrderInvoiceModal
        open={runOpen}
        onClose={() => {
          if (runBusy) return;
          setRunOpen(false);
          setActionOrderIds([]);
          setInvoiceOrders([]);
          setRunError("");
        }}
        orders={invoiceOrders}
        customers={customers}
        priceList={priceList}
        busy={runBusy}
        error={runError}
        onSubmit={submitInvoices}
      />

      <Modal
        open={outOpen}
        onClose={() => {
          setOutOpen(false);
          setActionOrderIds([]);
        }}
        title="Assign delivery"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Mark {actionOrders.length} order
            {actionOrders.length === 1 ? "" : "s"} out for delivery and assign
            a delivery person.
          </p>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
            {actionOrders.map((o) => (
              <li key={o.id}>
                {o.customerName}
                {o.deliveryByName ? ` · was ${o.deliveryByName}` : ""}
              </li>
            ))}
          </ul>
          {outError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {outError}
            </p>
          ) : null}
          {deliveryStaff.length === 0 ? (
            <p className="text-sm text-muted">
              No active delivery staff found. Add a delivery employee in Admin.
            </p>
          ) : (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Delivery by</span>
              <select
                value={outDeliveryBy}
                onChange={(e) => setOutDeliveryBy(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none"
              >
                <option value="">Select person…</option>
                {deliveryStaff.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setOutOpen(false);
                setActionOrderIds([]);
              }}
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={
                outBusy ||
                !outDeliveryBy ||
                actionOrders.length === 0 ||
                deliveryStaff.length === 0
              }
              onClick={() => void submitAssignOut()}
              className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-surface disabled:opacity-50"
            >
              {outBusy ? "Updating…" : "Mark out for delivery"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={missingOpen}
        onClose={() => setMissingOpen(false)}
        title="Report Missing Items"
        size="xl"
      >
        <div className="space-y-4">
          {missingError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {missingError}
            </p>
          ) : null}
          {whatsappUrls.length > 0 ? (
            <div className="space-y-2">
              {whatsappUrls.map((entry) => (
                <a
                  key={entry.url + entry.customerName}
                  href={entry.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900"
                >
                  WhatsApp {entry.customerName} →
                </a>
              ))}
            </div>
          ) : null}
          <label className="block max-w-xs space-y-1.5">
            <span className="text-sm font-medium">Invoice / order date</span>
            <input
              type="date"
              value={missingDate}
              onChange={(e) => setMissingDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none"
            />
          </label>
          <div className="space-y-2">
            {missingLines.map((line) => (
              <div
                key={line.key}
                className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-[1.2fr_1.2fr_0.7fr_0.45fr_0.55fr_auto]"
              >
                <select
                  value={line.customerId}
                  onChange={(e) =>
                    setMissingLines((prev) =>
                      prev.map((l) =>
                        l.key === line.key
                          ? { ...l, customerId: e.target.value }
                          : l,
                      ),
                    )
                  }
                  className="rounded-lg border border-border bg-background px-2 py-2 text-sm outline-none"
                  aria-label="Customer"
                >
                  <option value="">Customer…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <ItemNameCombobox
                  items={priceList}
                  value={line.itemName}
                  onChange={(value) =>
                    setMissingLines((prev) =>
                      prev.map((l) =>
                        l.key === line.key
                          ? { ...l, itemName: value, priceListItemId: null }
                          : l,
                      ),
                    )
                  }
                  onSelect={(item) =>
                    setMissingLines((prev) =>
                      prev.map((l) =>
                        l.key === line.key
                          ? {
                              ...l,
                              itemName: item.item_name,
                              priceListItemId: item.id,
                            }
                          : l,
                      ),
                    )
                  }
                  onTabToQty={() => undefined}
                  showPrice={false}
                  placeholder="Item"
                />
                <input
                  value={line.shadeCode}
                  onChange={(e) =>
                    setMissingLines((prev) =>
                      prev.map((l) =>
                        l.key === line.key
                          ? { ...l, shadeCode: e.target.value }
                          : l,
                      ),
                    )
                  }
                  placeholder="Shade"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
                />
                <input
                  value={line.qty}
                  onChange={(e) =>
                    setMissingLines((prev) =>
                      prev.map((l) =>
                        l.key === line.key
                          ? { ...l, qty: e.target.value }
                          : l,
                      ),
                    )
                  }
                  placeholder="Qty"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
                />
                <select
                  value={line.unit}
                  onChange={(e) =>
                    setMissingLines((prev) =>
                      prev.map((l) =>
                        l.key === line.key
                          ? {
                              ...l,
                              unit: e.target.value as CustomerOrderLineUnit,
                            }
                          : l,
                      ),
                    )
                  }
                  className="rounded-lg border border-border bg-background px-2 py-2 text-sm outline-none"
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
                  disabled={missingLines.length <= 1}
                  onClick={() =>
                    setMissingLines((prev) =>
                      prev.filter((l) => l.key !== line.key),
                    )
                  }
                  className="px-2 text-sm text-red-700 hover:underline disabled:opacity-30"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                const lastCustomer =
                  missingLines[missingLines.length - 1]?.customerId ?? "";
                setMissingLines((prev) => [
                  ...prev,
                  emptyMissingLine(lastCustomer),
                ]);
              }}
              className="text-sm font-medium text-muted hover:text-foreground"
            >
              + Add line
            </button>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setMissingOpen(false)}
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium"
            >
              Close
            </button>
            <button
              type="button"
              disabled={missingBusy}
              onClick={() => void submitMissing()}
              className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-surface disabled:opacity-50"
            >
              {missingBusy ? "Saving…" : "Save & queue dyeing"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
